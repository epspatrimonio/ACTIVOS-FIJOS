(function () {
  "use strict";

  const SESSION_AUTH_KEY = "eps_inv_campo_auth_ok";
  const DRAFT_STORAGE_KEY = "eps_inventario_campo_v1";
  const GH_TOKEN_SESSION_KEY = "eps_inv_gh_pat_sess";
  const GH_TOKEN_LOCAL_KEY = "eps_inv_gh_pat_local";
  const GH_OWNER = "epspatrimonio";
  const GH_REPO = "ACTIVOS-FIJOS";
  const GH_BRANCH = "master";
  // Hash SHA-256 de la clave autorizada + validación directa para entornos HTTP LAN sin crypto.subtle
  const ACCESS_KEY_SHA256 = "6b4d18a060d1833674da885839e68ccf44ed05c0de1f610b13ce56bc0f614180";
  const ACCESS_FALLBACK_PLAIN = "patrimonio1996";

  function getGhToken() {
    return sessionStorage.getItem(GH_TOKEN_SESSION_KEY) || localStorage.getItem(GH_TOKEN_LOCAL_KEY) || "";
  }
  function saveGhToken(token, remember) {
    const clean = String(token || "").trim();
    sessionStorage.setItem(GH_TOKEN_SESSION_KEY, clean);
    if (remember) localStorage.setItem(GH_TOKEN_LOCAL_KEY, clean);
    else localStorage.removeItem(GH_TOKEN_LOCAL_KEY);
  }
  function clearGhToken() {
    sessionStorage.removeItem(GH_TOKEN_SESSION_KEY);
    localStorage.removeItem(GH_TOKEN_LOCAL_KEY);
  }
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  const state = {
    catalogos: { sucursales: [], puestos: [], personal: [], estados: ["BUENO", "REGULAR", "MALO", "PARA BAJA", "BAJA"] },
    items: [],
    drafts: {}, // uid -> { uid, origen_tabla, id_regularizacion, cod_patrimonial, ..., campos_modificados: [] }
    selectedUids: new Set(),
    expandedCharUids: new Set(),
    activeSucursalId: "ALL",
    search: "",
    filterUnidad: "",
    filterPuesto: "",
    filterEstado: "",
    activePill: "ALL",
    page: 1,
    pageSize: 50,
    personalLookup: new Map(), // norm(name) -> { cod_personal, personal }
    sucursalById: new Map(),
    puestoById: new Map(),
  };

  function normText(v) {
    if (v === undefined || v === null) return "";
    return String(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  async function verifyAccessKey(inputVal) {
    const clean = String(inputVal || "").trim();
    if (window.crypto && window.crypto.subtle) {
      try {
        const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(clean));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        if (hex === ACCESS_KEY_SHA256) return true;
      } catch (e) {}
    }
    return clean === ACCESS_FALLBACK_PLAIN;
  }

  // ── Persistencia de Borradores en localStorage ─────────────────────────────
  function loadDrafts() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.drafts) {
          state.drafts = parsed.drafts;
        }
      }
    } catch (e) {
      state.drafts = {};
    }
  }

  function persistDrafts() {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ saved_at: new Date().toISOString(), drafts: state.drafts })
      );
    } catch (e) {
      showToast("Aviso: No se pudo guardar en localStorage.");
    }
  }

  function getEffectiveItem(baseItem) {
    const draft = state.drafts[baseItem.uid];
    if (!draft) return baseItem;
    return { ...baseItem, ...draft, _isModified: true, _changedFields: draft.campos_modificados || [] };
  }

  function getContextForSucursal(idSucursal) {
    return Number(idSucursal) === 1 ? "SEDE_CENTRAL" : "UNIDAD_OPERATIVA";
  }

  function getUnidadesForContext(ctx) {
    const set = new Set();
    state.catalogos.puestos.forEach((p) => {
      if (!ctx || p.tipo_contexto === ctx) {
        if (p.departamento) set.add(p.departamento);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function getPuestosFor(ctx, unidad) {
    return state.catalogos.puestos.filter((p) => {
      if (ctx && p.tipo_contexto !== ctx) return false;
      if (unidad && p.departamento !== unidad) return false;
      return true;
    });
  }

  // ── Carga de Datos Unificados desde JSON ───────────────────────────────────
  async function fetchJsonWithFallback(filename) {
    const ts = `v=${Date.now()}`;
    const candidates = [`./${filename}?${ts}`, `../${filename}?${ts}`, `../public_dashboard/${filename}?${ts}`];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    throw new Error(`No se pudo cargar ${filename}`);
  }

  async function initData() {
    loadDrafts();
    try {
      const [catData, invData] = await Promise.all([
        fetchJsonWithFallback("catalogos_inventario.json"),
        fetchJsonWithFallback("inventario_unificado.json"),
      ]);
      state.catalogos = {
        sucursales: Array.isArray(catData.sucursales) ? catData.sucursales : [],
        puestos: Array.isArray(catData.puestos) ? catData.puestos : [],
        personal: Array.isArray(catData.personal) ? catData.personal : [],
        estados: Array.isArray(catData.estados) && catData.estados.length ? catData.estados : ["BUENO", "REGULAR", "MALO", "PARA BAJA", "BAJA"],
        generado_en: catData.generado_en || null,
      };
      state.items = Array.isArray(invData) ? invData : [];

      state.sucursalById.clear();
      state.catalogos.sucursales.forEach((s) => state.sucursalById.set(Number(s.id_sucursal), s));

      state.puestoById.clear();
      state.catalogos.puestos.forEach((p) => state.puestoById.set(Number(p.puesto_id), p));

      state.personalLookup.clear();
      const dl = document.getElementById("dl-personal");
      if (dl) {
        dl.innerHTML = `<option value="Sin Asignar"></option>` + state.catalogos.personal
          .map((p) => {
            state.personalLookup.set(normText(p.personal), p);
            return `<option value="${escapeHtml(p.personal)}"></option>`;
          })
          .join("");
      }

      // Seleccionar primera sucursal real por defecto o ALL
      if (state.catalogos.sucursales.length > 0 && state.activeSucursalId === "ALL") {
        // Mantener ALL o permitir cambiar con 1 clic en pestañas
      }

      const metaEl = document.getElementById("catalogMeta");
      if (metaEl) {
        const fechaTxt = state.catalogos.generado_en
          ? new Date(state.catalogos.generado_en).toLocaleString("es-PE")
          : "actualizado";
        metaEl.textContent = `${state.items.length} bienes inventariados · ${state.catalogos.sucursales.length} sucursales activas · Corte: ${fechaTxt}`;
      }

      populateStaticSelects();
      renderAll();
    } catch (err) {
      const tbody = document.getElementById("tableBody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#e11d48; font-weight:700;">Error al cargar inventario: ${escapeHtml(err.message)}. Ejecute Sincronizar en el APP Activos Fijos.</td></tr>`;
      }
    }
  }

  function populateStaticSelects() {
    const estOpts = state.catalogos.estados.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
    document.getElementById("filterEstado").innerHTML = `<option value="">Todos los Estados</option>${estOpts}`;
    document.getElementById("batchEstado").innerHTML = `<option value="">— Estado —</option>${estOpts}`;

    const sucOpts = state.catalogos.sucursales
      .map((s) => `<option value="${s.id_sucursal}">${escapeHtml(s.sucursal)} (${escapeHtml(s.localidad)})</option>`)
      .join("");
    document.getElementById("batchSucursal").innerHTML = `<option value="">— Cambiar Sucursal —</option>${sucOpts}`;
    refreshCascadeFilterOptions();
    refreshBatchCascadeOptions();
  }

  function refreshCascadeFilterOptions() {
    const ctx = state.activeSucursalId === "ALL" ? null : getContextForSucursal(state.activeSucursalId);
    const unidades = getUnidadesForContext(ctx);
    const fUni = document.getElementById("filterUnidad");
    if (state.filterUnidad && !unidades.includes(state.filterUnidad)) state.filterUnidad = "";
    fUni.innerHTML = `<option value="">Todas las Unidades Orgánicas</option>` +
      unidades.map((u) => `<option value="${escapeHtml(u)}" ${u === state.filterUnidad ? "selected" : ""}>${escapeHtml(u)}</option>`).join("");

    const puestos = getPuestosFor(ctx, state.filterUnidad || null);
    const fPst = document.getElementById("filterPuesto");
    const uniquePuestos = Array.from(new Set(puestos.map((p) => p.puesto)));
    if (state.filterPuesto && !uniquePuestos.includes(state.filterPuesto)) state.filterPuesto = "";
    fPst.innerHTML = `<option value="">Todos los Puestos</option>` +
      uniquePuestos.map((p) => `<option value="${escapeHtml(p)}" ${p === state.filterPuesto ? "selected" : ""}>${escapeHtml(p)}</option>`).join("");
  }

  function refreshBatchCascadeOptions() {
    const sucVal = document.getElementById("batchSucursal").value;
    const ctx = sucVal ? getContextForSucursal(sucVal) : (state.activeSucursalId !== "ALL" ? getContextForSucursal(state.activeSucursalId) : null);
    const bUni = document.getElementById("batchUnidad");
    const prevU = bUni.value;
    const unidades = getUnidadesForContext(ctx);
    const nextU = unidades.includes(prevU) ? prevU : "";
    bUni.innerHTML = `<option value="">— Unidad Orgánica —</option>` +
      unidades.map((u) => `<option value="${escapeHtml(u)}" ${u === nextU ? "selected" : ""}>${escapeHtml(u)}</option>`).join("");

    const bPst = document.getElementById("batchPuesto");
    const prevP = bPst.value;
    const puestos = getPuestosFor(ctx, nextU || null);
    bPst.innerHTML = `<option value="">— Puesto —</option>` +
      puestos.map((p) => `<option value="${p.puesto_id}" ${String(p.puesto_id) === String(prevP) ? "selected" : ""}>${nextU ? escapeHtml(p.puesto) : `${escapeHtml(p.departamento)} · ${escapeHtml(p.puesto)}`}</option>`).join("");
  }

  // ── Filtrado y Conteos ─────────────────────────────────────────────────────
  function getFilteredItems() {
    const qTokens = normText(state.search).split(/\s+/).filter(Boolean);
    const activeSucId = state.activeSucursalId;

    return state.items
      .map(getEffectiveItem)
      .filter((it) => {
        if (activeSucId !== "ALL" && String(it.id_sucursal || "") !== String(activeSucId)) return false;

        if (state.activePill === "ACTIVO" && it.origen_tabla !== "ACTIVO") return false;
        if (state.activePill === "OBRA" && it.tipo_origen !== "OBRA EN CURSO") return false;
        if (state.activePill === "CONCILIACION" && it.sub_modulo !== "CONCILIACION") return false;
        if (state.activePill === "SOBRANTE" && it.sub_modulo !== "SOBRANTE") return false;
        if (state.activePill === "SIN_RESP") {
          const resp = normText(it.responsable);
          if (resp && resp !== "SIN ASIGNAR" && resp !== "PENDIENTE DE UBICACION") return false;
        }
        if (state.activePill === "MODIFICADOS" && !it._isModified) return false;

        if (state.filterUnidad && normText(it.unidad) !== normText(state.filterUnidad)) return false;
        if (state.filterPuesto && normText(it.puesto) !== normText(state.filterPuesto)) return false;
        if (state.filterEstado && normText(it.estado_activo) !== normText(state.filterEstado)) return false;

        if (qTokens.length > 0) {
          const blob = normText([
            it.cod_patrimonial, it.denominacion, it.marca, it.modelo, it.numero_serie,
            it.placa, it.responsable, it.unidad, it.puesto, it.sucursal, it.observaciones, it.caracteristicas_accesorios
          ].join(" "));
          if (!qTokens.every((t) => blob.includes(t))) return false;
        }
        return true;
      });
  }

  // ── Mutación de Borradores ─────────────────────────────────────────────────
  function updateField(uid, fieldUpdates) {
    const base = state.items.find((x) => x.uid === uid);
    if (!base) return;
    const prevDraft = state.drafts[uid] || {
      uid: base.uid,
      origen_tabla: base.origen_tabla,
      id_regularizacion: base.id_regularizacion || null,
      cod_patrimonial: base.cod_patrimonial,
      sucursal_original: base.sucursal || "",
    };

    const nextDraft = { ...prevDraft, ...fieldUpdates, updated_at: new Date().toISOString() };

    // Comparar cada campo editable contra el valor original de base
    const trackedKeys = [
      "id_sucursal", "sucursal", "unidad", "puesto_id", "puesto",
      "cod_personal", "responsable", "estado_activo", "observaciones",
      "caracteristicas_accesorios", "marca", "modelo", "numero_serie", "color"
    ];
    const changedFields = [];
    trackedKeys.forEach((k) => {
      if (k in nextDraft) {
        const origVal = base[k] ?? "";
        const newVal = nextDraft[k] ?? "";
        if (String(origVal).trim() !== String(newVal).trim()) {
          changedFields.push(k);
        } else {
          delete nextDraft[k];
        }
      }
    });

    if (changedFields.length === 0) {
      delete state.drafts[uid];
    } else {
      nextDraft.campos_modificados = changedFields;
      state.drafts[uid] = nextDraft;
    }
    persistDrafts();
    renderHeaderAndTabs();
    renderBatchBar();
  }

  function revertItem(uid) {
    if (state.drafts[uid]) {
      delete state.drafts[uid];
      persistDrafts();
      renderAll();
      showToast("Registro restaurado a su valor original.");
    }
  }

  // ── Renderizado ────────────────────────────────────────────────────────────
  function renderHeaderAndTabs() {
    const allDrafts = Object.values(state.drafts);
    const totalMod = allDrafts.length;

    const branchModCount = (sucId) => {
      if (sucId === "ALL") return totalMod;
      return state.items.reduce((acc, base) => {
        const d = state.drafts[base.uid];
        if (!d) return acc;
        const effSuc = d.id_sucursal !== undefined ? d.id_sucursal : base.id_sucursal;
        if (String(effSuc) === String(sucId) || String(base.id_sucursal) === String(sucId)) return acc + 1;
        return acc;
      }, 0);
    };

    const currentSucMod = branchModCount(state.activeSucursalId);

    const statusPill = document.getElementById("statusPill");
    if (totalMod > 0) {
      statusPill.className = "pill-status dirty";
      statusPill.textContent = `✏️ ${totalMod} bien(es) modificado(s) (Guardado automático)`;
    } else {
      statusPill.className = "pill-status";
      statusPill.textContent = "💾 Sin cambios pendientes";
    }

    document.getElementById("modPillCount").textContent = String(totalMod);
    document.getElementById("btnDownloadBranchJson").disabled = currentSucMod === 0;
    document.getElementById("btnDownloadBranchJson").textContent =
      state.activeSucursalId === "ALL"
        ? `📥 Descargar Cambios (${totalMod}) (.json)`
        : `📥 Descargar Cambios Sucursal (${currentSucMod}) (.json)`;
    document.getElementById("btnDownloadAllJson").disabled = totalMod === 0;
    document.getElementById("btnDownloadAllJson").textContent = `📥 Descargar Todos (${totalMod}) (.json)`;
    document.getElementById("btnClearDraft").classList.toggle("hidden", totalMod === 0);

    const hasToken = Boolean(getGhToken());
    const tokBtn = document.getElementById("btnTokenConfig");
    if (tokBtn) {
      tokBtn.textContent = hasToken ? "🟢 GitHub Conectado" : "🔑 Token GitHub";
      tokBtn.style.background = hasToken ? "rgba(16, 185, 129, 0.28)" : "rgba(255,255,255,0.12)";
    }
    const pushBtn = document.getElementById("btnPushGithub");
    if (pushBtn) {
      pushBtn.disabled = currentSucMod === 0;
      pushBtn.textContent =
        state.activeSucursalId === "ALL"
          ? `☁️ Enviar a GitHub (${totalMod})`
          : `☁️ Enviar Sucursal a GitHub (${currentSucMod})`;
    }

    // Tabs de Sucursales dinámicas
    const sucCounts = new Map();
    state.items.forEach((base) => {
      const eff = getEffectiveItem(base);
      const sid = String(eff.id_sucursal || "");
      sucCounts.set(sid, (sucCounts.get(sid) || 0) + 1);
    });

    const tabsHtml = [
      `<button type="button" class="suc-tab ${state.activeSucursalId === "ALL" ? "active" : ""}" data-suc="ALL">
        <span>TODAS LAS SUCURSALES</span>
        <span class="suc-count">${state.items.length}</span>
        ${totalMod > 0 ? `<span class="suc-mod-badge">✏️ ${totalMod}</span>` : ""}
      </button>`,
      ...state.catalogos.sucursales.map((s) => {
        const sid = String(s.id_sucursal);
        const cnt = sucCounts.get(sid) || 0;
        const mCnt = branchModCount(sid);
        return `<button type="button" class="suc-tab ${state.activeSucursalId === sid ? "active" : ""}" data-suc="${sid}">
          <span>${escapeHtml(s.sucursal)}</span>
          <span class="suc-count">${cnt}</span>
          ${mCnt > 0 ? `<span class="suc-mod-badge">✏️ ${mCnt}</span>` : ""}
        </button>`;
      }),
    ].join("");
    document.getElementById("sucursalTabs").innerHTML = tabsHtml;
  }

  function renderBatchBar() {
    const bar = document.getElementById("batchBar");
    const cnt = state.selectedUids.size;
    bar.classList.toggle("hidden", cnt === 0);
    if (cnt > 0) {
      document.getElementById("batchCountLabel").textContent = `${cnt} bien(es) seleccionado(s)`;
    }
  }

  function renderTable() {
    const filtered = getFilteredItems();
    const pageSize = state.pageSize;
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const startIdx = pageSize === 0 ? 0 : (state.page - 1) * pageSize;
    const endIdx = pageSize === 0 ? filtered.length : Math.min(startIdx + pageSize, filtered.length);
    const pageItems = filtered.slice(startIdx, endIdx);

    const tbody = document.getElementById("tableBody");
    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:42px; color:#64748b; font-weight:600;">No se encontraron bienes con los filtros actuales.</td></tr>`;
    } else {
      const sucOptionsCache = new Map();
      const buildSucOpts = (currId) => {
        const key = String(currId || "");
        if (!sucOptionsCache.has(key)) {
          const opts = [`<option value="">— Seleccionar —</option>`].concat(
            state.catalogos.sucursales.map(
              (s) => `<option value="${s.id_sucursal}" ${String(s.id_sucursal) === key ? "selected" : ""}>${escapeHtml(s.sucursal)}</option>`
            )
          ).join("");
          sucOptionsCache.set(key, opts);
        }
        return sucOptionsCache.get(key);
      };

      const estOptionsCache = new Map();
      const buildEstOpts = (currEst) => {
        const key = normText(currEst);
        if (!estOptionsCache.has(key)) {
          const list = [...state.catalogos.estados];
          if (key && !list.includes(key)) list.push(key);
          estOptionsCache.set(
            key,
            list.map((e) => `<option value="${escapeHtml(e)}" ${normText(e) === key ? "selected" : ""}>${escapeHtml(e)}</option>`).join("")
          );
        }
        return estOptionsCache.get(key);
      };

      tbody.innerHTML = pageItems.map((it) => {
        const draft = state.drafts[it.uid];
        const chSet = new Set(it._changedFields || []);
        const isSelected = state.selectedUids.has(it.uid);
        const isCharOpen = state.expandedCharUids.has(it.uid);

        const ctx = getContextForSucursal(it.id_sucursal);
        const unidades = getUnidadesForContext(ctx);
        const currUni = (it.unidad || "").trim();
        const unitList = currUni && !unidades.includes(currUni) ? [currUni, ...unidades] : unidades;
        const puestos = getPuestosFor(ctx, currUni || null);

        let originClass = "origin-ACTIVO";
        if (it.tipo_origen === "OBRA EN CURSO") originClass = "origin-OBRA";
        else if (it.sub_modulo === "CONCILIACION") originClass = "origin-CONC";
        else if (it.sub_modulo === "SOBRANTE") originClass = "origin-SOB";
        else if (it.sub_modulo === "FALTANTE" || it.estado_activo === "FALTANTE") originClass = "origin-FALT";

        const obsFieldKey = it.origen_tabla === "REGULARIZACION" ? "observaciones" : "caracteristicas_accesorios";
        const obsValue = it[obsFieldKey] || it.observaciones || "";

        const respNorm = normText(it.responsable);
        const respValid = !respNorm || respNorm === "SIN ASIGNAR" || respNorm === "PENDIENTE DE UBICACION" || state.personalLookup.has(respNorm);

        return `
          <tr data-uid="${escapeHtml(it.uid)}" class="${draft ? "row-modified" : ""} ${isSelected ? "row-selected" : ""}">
            <td style="text-align:center;">
              <input type="checkbox" class="row-check" data-uid="${escapeHtml(it.uid)}" ${isSelected ? "checked" : ""} />
            </td>
            <td>
              <span class="code-badge">${escapeHtml(it.cod_patrimonial)}</span><br/>
              <span class="origin-tag ${originClass}">${escapeHtml(it.tipo_origen || it.origen_tabla)}</span>
              ${draft ? `<div><span class="mod-tag">MODIFICADO</span> <button type="button" class="undo-btn" data-undo="${escapeHtml(it.uid)}" title="Deshacer cambios de esta fila">↺</button></div>` : ""}
            </td>
            <td>
              <div style="font-weight:800; color:#0f172a; line-height:1.25;">${escapeHtml(it.denominacion)}</div>
              <div style="font-size:10.5px; color:#475569; margin-top:2px;">
                ${it.placa ? `<span style="background:#fef3c7; padding:0 4px; border-radius:4px; font-weight:800; color:#92400e;">${escapeHtml(it.placa)}</span> · ` : ""}
                Marca: <strong>${escapeHtml(it.marca || "S/M")}</strong> · Mod: ${escapeHtml(it.modelo || "—")} · Serie: <span style="font-family:monospace;">${escapeHtml(it.numero_serie || "S/S")}</span>
                <button type="button" class="char-toggle-btn" data-char="${escapeHtml(it.uid)}">${isCharOpen ? "Ocultar caract." : "Editar serie/marca"}</button>
              </div>
              ${isCharOpen ? `
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:5px;">
                  <input type="text" class="cell-input ${chSet.has("marca") ? "cell-changed" : ""}" data-field="marca" value="${escapeHtml(it.marca || "")}" placeholder="Marca" />
                  <input type="text" class="cell-input ${chSet.has("modelo") ? "cell-changed" : ""}" data-field="modelo" value="${escapeHtml(it.modelo || "")}" placeholder="Modelo" />
                  <input type="text" class="cell-input ${chSet.has("numero_serie") ? "cell-changed" : ""}" data-field="numero_serie" value="${escapeHtml(it.numero_serie || "")}" placeholder="N° Serie" />
                </div>
              ` : ""}
            </td>
            <td>
              <select class="cell-select ${chSet.has("id_sucursal") ? "cell-changed" : ""}" data-field="id_sucursal">
                ${buildSucOpts(it.id_sucursal)}
              </select>
            </td>
            <td>
              <select class="cell-select ${chSet.has("unidad") ? "cell-changed" : ""}" data-field="unidad">
                <option value="">— Seleccionar Unidad —</option>
                ${unitList.map((u) => `<option value="${escapeHtml(u)}" ${u === currUni ? "selected" : ""}>${escapeHtml(u)}</option>`).join("")}
              </select>
            </td>
            <td>
              <select class="cell-select ${chSet.has("puesto_id") ? "cell-changed" : ""}" data-field="puesto_id">
                <option value="">— Seleccionar Puesto —</option>
                ${puestos.map((p) => `<option value="${p.puesto_id}" ${String(p.puesto_id) === String(it.puesto_id || "") ? "selected" : ""}>${currUni ? escapeHtml(p.puesto) : `${escapeHtml(p.departamento)} · ${escapeHtml(p.puesto)}`}</option>`).join("")}
              </select>
            </td>
            <td>
              <input
                type="text"
                list="dl-personal"
                class="cell-input ${chSet.has("cod_personal") || chSet.has("responsable") ? "cell-changed" : ""} ${!respValid ? "cell-warn" : ""}"
                data-field="responsable"
                value="${escapeHtml(it.responsable || "")}"
                placeholder="Buscar personal..."
                title="${respValid ? "Seleccione del padrón oficial" : "Nombre no coincide exactamente con el padrón oficial"}"
              />
            </td>
            <td>
              <select class="cell-select ${chSet.has("estado_activo") ? "cell-changed" : ""}" data-field="estado_activo">
                ${buildEstOpts(it.estado_activo)}
              </select>
            </td>
            <td>
              <input
                type="text"
                class="cell-input ${chSet.has(obsFieldKey) ? "cell-changed" : ""}"
                data-field="${obsFieldKey}"
                value="${escapeHtml(obsValue)}"
                placeholder="Observación o especificación..."
              />
            </td>
          </tr>
        `;
      }).join("");
    }

    document.getElementById("pageInfo").textContent =
      filtered.length === 0
        ? "Mostrando 0 de 0 registros"
        : `Mostrando ${startIdx + 1}–${endIdx} de ${filtered.length} registros`;
    document.getElementById("pgLabel").textContent = `Pág. ${state.page} / ${totalPages}`;
    document.getElementById("pgFirst").disabled = state.page <= 1;
    document.getElementById("pgPrev").disabled = state.page <= 1;
    document.getElementById("pgNext").disabled = state.page >= totalPages;
    document.getElementById("pgLast").disabled = state.page >= totalPages;

    const checkAll = document.getElementById("checkPageAll");
    if (checkAll) {
      checkAll.checked = pageItems.length > 0 && pageItems.every((x) => state.selectedUids.has(x.uid));
    }
  }

  function renderAll() {
    renderHeaderAndTabs();
    renderBatchBar();
    renderTable();
  }

  // ── Exportaciones y Envío Seguro a GitHub ─────────────────────────────────
  function buildChangesPayload(onlyActiveSucursal, extraMeta = {}) {
    const allDrafts = Object.values(state.drafts);
    let targetDrafts = allDrafts;
    let sucLabel = "TODAS";
    if (onlyActiveSucursal && state.activeSucursalId !== "ALL") {
      const sucObj = state.sucursalById.get(Number(state.activeSucursalId));
      sucLabel = sucObj ? sucObj.sucursal : state.activeSucursalId;
      targetDrafts = allDrafts.filter((d) => {
        const base = state.items.find((x) => x.uid === d.uid);
        if (!base) return false;
        const effSuc = d.id_sucursal !== undefined ? d.id_sucursal : base.id_sucursal;
        return String(effSuc) === String(state.activeSucursalId) || String(base.id_sucursal) === String(state.activeSucursalId);
      });
    }
    if (targetDrafts.length === 0) return null;

    const payload = {
      version: "1.0",
      origen: "PORTAL_INVENTARIO_CAMPO",
      generado_en: new Date().toISOString(),
      sucursal_origen_paquete: sucLabel,
      total_cambios: targetDrafts.length,
      ...extraMeta,
      cambios: targetDrafts.map((d) => {
        const copy = { ...d };
        delete copy.sucursal_original;
        return copy;
      }),
    };
    return { payload, sucLabel, targetDrafts };
  }

  function downloadJsonPackage(onlyActiveSucursal) {
    const built = buildChangesPayload(onlyActiveSucursal);
    if (!built) {
      showToast("No hay cambios registrados para descargar.");
      return;
    }
    const { payload, sucLabel, targetDrafts } = built;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const slug = normText(sucLabel).replace(/[^A-Z0-9]+/g, "_");
    const dt = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `Cambios_Inventario_${slug}_${dt}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast(`Descargado paquete con ${targetDrafts.length} cambio(s).`);
  }

  function openTokenModal() {
    const modal = document.getElementById("tokenModal");
    const inp = document.getElementById("ghTokenInput");
    const rem = document.getElementById("ghTokenRemember");
    const fb = document.getElementById("tokenFeedback");
    const rmBtn = document.getElementById("btnRemoveToken");
    const existing = getGhToken();
    inp.value = existing;
    rem.checked = Boolean(localStorage.getItem(GH_TOKEN_LOCAL_KEY));
    fb.className = "hidden";
    fb.textContent = "";
    rmBtn.classList.toggle("hidden", !existing);
    modal.classList.remove("hidden");
  }

  async function saveAndTestToken() {
    const inp = document.getElementById("ghTokenInput");
    const rem = document.getElementById("ghTokenRemember");
    const fb = document.getElementById("tokenFeedback");
    const btn = document.getElementById("btnSaveTestToken");
    const token = inp.value.trim();
    if (!token) {
      fb.className = "err-box";
      fb.textContent = "Ingrese un token válido.";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Verificando...";
    try {
      const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!res.ok) {
        const errJ = await res.json().catch(() => ({}));
        throw new Error(errJ.message || `GitHub rechazó el token (HTTP ${res.status})`);
      }
      const repoInfo = await res.json();
      if (repoInfo.permissions && repoInfo.permissions.push === false) {
        throw new Error("El token es solo lectura. Debe tener permiso Contents: Read & Write.");
      }
      saveGhToken(token, rem.checked);
      fb.className = "ok-box";
      fb.textContent = `✓ Token verificado correctamente para ${GH_OWNER}/${GH_REPO}.`;
      document.getElementById("btnRemoveToken").classList.remove("hidden");
      renderHeaderAndTabs();
      setTimeout(() => document.getElementById("tokenModal").classList.add("hidden"), 900);
    } catch (e) {
      fb.className = "err-box";
      fb.textContent = e.message || "Error al validar token con GitHub.";
    } finally {
      btn.disabled = false;
      btn.textContent = "✓ Probar y Guardar Token";
    }
  }

  function openPushConfirmModal() {
    if (!getGhToken()) {
      openTokenModal();
      showToast("Primero configura tu Token GitHub para enviar en línea.");
      return;
    }
    const built = buildChangesPayload(true);
    if (!built) {
      showToast("No hay cambios en esta vista para enviar.");
      return;
    }
    const { sucLabel, targetDrafts } = built;
    const summaryBox = document.getElementById("pushSummaryBox");
    summaryBox.innerHTML =
      `<strong>Sucursal / Vista:</strong> ${escapeHtml(sucLabel)}<br/>` +
      `<strong>Registros modificados a enviar:</strong> ${targetDrafts.length}<br/>` +
      `<strong>Destino seguro:</strong> <code>INVENTARIO/pendientes/</code> en GitHub (no sobreescribe datos oficiales hasta que Sede Central revise el comparador).`;
    const fb = document.getElementById("pushFeedback");
    fb.className = "hidden";
    fb.textContent = "";
    document.getElementById("btnConfirmPush").disabled = false;
    document.getElementById("pushConfirmModal").classList.remove("hidden");
  }

  async function confirmPushToGithub() {
    const token = getGhToken();
    if (!token) { openTokenModal(); return; }
    const note = document.getElementById("pushNoteInput").value.trim();
    const clearAfter = document.getElementById("pushClearAfter").checked;
    const fb = document.getElementById("pushFeedback");
    const btn = document.getElementById("btnConfirmPush");

    const built = buildChangesPayload(true, note ? { nota_envio: note } : {});
    if (!built) { showToast("No hay cambios para enviar."); return; }

    const { payload, sucLabel, targetDrafts } = built;
    const slug = normText(sucLabel).replace(/[^A-Z0-9]+/g, "_") || "CAMPO";
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15); // YYYYMMDDHHMMSS
    const filename = `cambios_${slug}_${stamp}.json`;
    const repoPath = `INVENTARIO/pendientes/${filename}`;

    btn.disabled = true;
    btn.textContent = "Subiendo a GitHub...";
    fb.className = "hidden";

    try {
      const contentB64 = utf8ToBase64(JSON.stringify(payload, null, 2));
      const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${repoPath}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message: `Verificación de campo ${sucLabel}: ${targetDrafts.length} cambio(s)${note ? " - " + note : ""}`,
          content: contentB64,
          branch: GH_BRANCH,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error GitHub API HTTP ${res.status}`);
      }

      if (clearAfter) {
        targetDrafts.forEach((d) => { delete state.drafts[d.uid]; });
        persistDrafts();
        renderAll();
      }
      fb.className = "ok-box";
      fb.innerHTML = `✓ Enviado a GitHub: <code>${escapeHtml(filename)}</code> (${targetDrafts.length} cambio(s)). Ya puedes importarlo en la pestaña Inventario del APP Activos Fijos.`;
      setTimeout(() => {
        document.getElementById("pushConfirmModal").classList.add("hidden");
      }, 2400);
    } catch (e) {
      fb.className = "err-box";
      fb.textContent = `Error al subir a GitHub: ${e.message}`;
      btn.disabled = false;
    } finally {
      btn.textContent = "☁️ Confirmar y Subir a GitHub";
    }
  }

  function exportExcelTable() {
    if (!window.XLSX) {
      showToast("Librería Excel no disponible.");
      return;
    }
    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      showToast("No hay registros filtrados para exportar.");
      return;
    }
    const rows = filtered.map((it) => ({
      "CÓDIGO PATRIMONIAL": it.cod_patrimonial,
      "ORIGEN": it.tipo_origen || it.origen_tabla,
      "DENOMINACIÓN": it.denominacion || "",
      "MARCA": it.marca || "",
      "MODELO": it.modelo || "",
      "SERIE": it.numero_serie || "",
      "PLACA": it.placa || "",
      "SUCURSAL": it.sucursal || "",
      "UNIDAD ORGÁNICA": it.unidad || "",
      "PUESTO": it.puesto || "",
      "RESPONSABLE": it.responsable || "",
      "ESTADO": it.estado_activo || "",
      "OBSERVACIONES / ESPEC.": (it.origen_tabla === "REGULARIZACION" ? it.observaciones : it.caracteristicas_accesorios) || "",
      "MODIFICADO": it._isModified ? "SI" : "NO",
      "CAMPOS MODIFICADOS": (it._changedFields || []).join(", "),
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "InventarioCampo");
    const sucObj = state.activeSucursalId !== "ALL" ? state.sucursalById.get(Number(state.activeSucursalId)) : null;
    const slug = sucObj ? normText(sucObj.sucursal).replace(/[^A-Z0-9]+/g, "_") : "TODAS";
    window.XLSX.writeFile(wb, `Inventario_Campo_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Listeners de Eventos ───────────────────────────────────────────────────
  function bindEvents() {
    // Login
    document.getElementById("authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("authPassword");
      const err = document.getElementById("authError");
      const ok = await verifyAccessKey(input.value);
      if (ok) {
        err.classList.add("hidden");
        sessionStorage.setItem(SESSION_AUTH_KEY, "1");
        document.getElementById("authScreen").classList.add("hidden");
        document.getElementById("appShell").classList.remove("hidden");
        initData();
      } else {
        err.classList.remove("hidden");
        input.select();
      }
    });

    document.getElementById("btnLogout").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("authScreen").classList.remove("hidden");
      document.getElementById("authPassword").value = "";
    });

    // Sucursal Tabs
    document.getElementById("sucursalTabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".suc-tab");
      if (!btn) return;
      state.activeSucursalId = btn.dataset.suc;
      state.page = 1;
      state.selectedUids.clear();
      refreshCascadeFilterOptions();
      refreshBatchCascadeOptions();
      renderAll();
    });

    // Filtros
    let searchTimeout = null;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      const val = e.target.value;
      document.getElementById("searchClear").classList.toggle("hidden", !val);
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = val;
        state.page = 1;
        renderTable();
      }, 150);
    });
    document.getElementById("searchClear").addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.add("hidden");
      state.search = "";
      state.page = 1;
      renderTable();
    });
    document.getElementById("filterUnidad").addEventListener("change", (e) => {
      state.filterUnidad = e.target.value;
      state.filterPuesto = "";
      state.page = 1;
      refreshCascadeFilterOptions();
      renderTable();
    });
    document.getElementById("filterPuesto").addEventListener("change", (e) => {
      state.filterPuesto = e.target.value;
      state.page = 1;
      renderTable();
    });
    document.getElementById("filterEstado").addEventListener("change", (e) => {
      state.filterEstado = e.target.value;
      state.page = 1;
      renderTable();
    });
    document.getElementById("btnResetFilters").addEventListener("click", () => {
      state.search = "";
      state.filterUnidad = "";
      state.filterPuesto = "";
      state.filterEstado = "";
      state.activePill = "ALL";
      state.page = 1;
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.add("hidden");
      document.getElementById("filterEstado").value = "";
      document.querySelectorAll("#quickPills .q-pill").forEach((b) => b.classList.toggle("active", b.dataset.pill === "ALL"));
      refreshCascadeFilterOptions();
      renderTable();
    });

    // Píldoras
    document.getElementById("quickPills").addEventListener("click", (e) => {
      const pill = e.target.closest(".q-pill");
      if (!pill) return;
      state.activePill = pill.dataset.pill;
      state.page = 1;
      document.querySelectorAll("#quickPills .q-pill").forEach((b) => b.classList.toggle("active", b === pill));
      renderTable();
    });

    // Edición inline en tabla (delegación de eventos)
    const tbody = document.getElementById("tableBody");
    tbody.addEventListener("click", (e) => {
      const undoBtn = e.target.closest("[data-undo]");
      if (undoBtn) {
        revertItem(undoBtn.dataset.undo);
        return;
      }
      const charBtn = e.target.closest("[data-char]");
      if (charBtn) {
        const uid = charBtn.dataset.char;
        if (state.expandedCharUids.has(uid)) state.expandedCharUids.delete(uid);
        else state.expandedCharUids.add(uid);
        renderTable();
      }
    });

    tbody.addEventListener("change", (e) => {
      if (e.target.classList.contains("row-check")) {
        const uid = e.target.dataset.uid;
        if (e.target.checked) state.selectedUids.add(uid);
        else state.selectedUids.delete(uid);
        renderBatchBar();
        renderTable();
        return;
      }

      const tr = e.target.closest("tr[data-uid]");
      if (!tr) return;
      const uid = tr.dataset.uid;
      const field = e.target.dataset.field;
      if (!field) return;

      const base = state.items.find((x) => x.uid === uid);
      if (!base) return;
      const eff = getEffectiveItem(base);
      const val = e.target.value;

      if (field === "id_sucursal") {
        const newSucId = val ? Number(val) : null;
        const sucObj = newSucId ? state.sucursalById.get(newSucId) : null;
        const upd = { id_sucursal: newSucId, sucursal: sucObj ? sucObj.sucursal : "" };
        if (newSucId) {
          const newCtx = getContextForSucursal(newSucId);
          const currP = eff.puesto_id ? state.puestoById.get(Number(eff.puesto_id)) : null;
          if (!currP || currP.tipo_contexto !== newCtx) {
            upd.puesto_id = null;
            upd.puesto = "";
            upd.unidad = "";
          }
        }
        updateField(uid, upd);
        renderTable();
      } else if (field === "unidad") {
        const ctx = getContextForSucursal(eff.id_sucursal);
        const validPuestos = getPuestosFor(ctx, val);
        const upd = { unidad: val };
        if (validPuestos.length === 1) {
          upd.puesto_id = validPuestos[0].puesto_id;
          upd.puesto = validPuestos[0].puesto;
        } else {
          const currP = eff.puesto_id ? state.puestoById.get(Number(eff.puesto_id)) : null;
          if (!currP || currP.departamento !== val) {
            upd.puesto_id = null;
            upd.puesto = "";
          }
        }
        updateField(uid, upd);
        renderTable();
      } else if (field === "puesto_id") {
        const pid = val ? Number(val) : null;
        const pObj = pid ? state.puestoById.get(pid) : null;
        const upd = {
          puesto_id: pid,
          puesto: pObj ? pObj.puesto : "",
        };
        if (pObj && pObj.departamento) upd.unidad = pObj.departamento;
        updateField(uid, upd);
        renderTable();
      } else if (field === "responsable") {
        const clean = normText(val);
        if (!clean || clean === "SIN ASIGNAR") {
          updateField(uid, { cod_personal: "", responsable: "Sin Asignar" });
        } else if (state.personalLookup.has(clean)) {
          const pers = state.personalLookup.get(clean);
          updateField(uid, { cod_personal: pers.cod_personal, responsable: pers.personal });
        } else {
          updateField(uid, { cod_personal: "", responsable: val.trim().toUpperCase() });
        }
        renderTable();
      } else {
        updateField(uid, { [field]: val });
        renderTable();
      }
    });

    // Selección de página / todos filtrados / Lote
    document.getElementById("checkPageAll").addEventListener("change", (e) => {
      const checks = document.querySelectorAll("#tableBody .row-check");
      checks.forEach((chk) => {
        if (e.target.checked) state.selectedUids.add(chk.dataset.uid);
        else state.selectedUids.delete(chk.dataset.uid);
      });
      renderBatchBar();
      renderTable();
    });

    document.getElementById("btnSelectAllFiltered").addEventListener("click", () => {
      getFilteredItems().forEach((it) => state.selectedUids.add(it.uid));
      renderBatchBar();
      renderTable();
    });
    document.getElementById("btnClearSelection").addEventListener("click", () => {
      state.selectedUids.clear();
      renderBatchBar();
      renderTable();
    });

    document.getElementById("batchSucursal").addEventListener("change", refreshBatchCascadeOptions);
    document.getElementById("batchUnidad").addEventListener("change", refreshBatchCascadeOptions);

    document.getElementById("btnApplyBatch").addEventListener("click", () => {
      const sucVal = document.getElementById("batchSucursal").value;
      const uniVal = document.getElementById("batchUnidad").value;
      const pstVal = document.getElementById("batchPuesto").value;
      const respVal = document.getElementById("batchResponsable").value;
      const estVal = document.getElementById("batchEstado").value;

      if (!sucVal && !uniVal && !pstVal && !respVal.trim() && !estVal) {
        showToast("Elija al menos un campo para aplicar en lote.");
        return;
      }

      const upd = {};
      if (sucVal) {
        const sObj = state.sucursalById.get(Number(sucVal));
        upd.id_sucursal = Number(sucVal);
        upd.sucursal = sObj ? sObj.sucursal : "";
      }
      if (uniVal) upd.unidad = uniVal;
      if (pstVal) {
        const pObj = state.puestoById.get(Number(pstVal));
        if (pObj) {
          upd.puesto_id = pObj.puesto_id;
          upd.puesto = pObj.puesto;
          if (!upd.unidad && pObj.departamento) upd.unidad = pObj.departamento;
        }
      }
      if (respVal.trim()) {
        const rNorm = normText(respVal);
        if (rNorm === "SIN ASIGNAR") {
          upd.cod_personal = "";
          upd.responsable = "Sin Asignar";
        } else if (state.personalLookup.has(rNorm)) {
          const p = state.personalLookup.get(rNorm);
          upd.cod_personal = p.cod_personal;
          upd.responsable = p.personal;
        } else {
          showToast("El responsable debe coincidir con el padrón oficial.");
          return;
        }
      }
      if (estVal) upd.estado_activo = estVal;

      let count = 0;
      state.selectedUids.forEach((uid) => {
        const base = state.items.find((x) => x.uid === uid);
        if (!base) return;
        const rowUpd = { ...upd };
        if (rowUpd.id_sucursal && !rowUpd.puesto_id) {
          const eff = getEffectiveItem(base);
          const ctx = getContextForSucursal(rowUpd.id_sucursal);
          const currP = eff.puesto_id ? state.puestoById.get(Number(eff.puesto_id)) : null;
          if (!currP || currP.tipo_contexto !== ctx) {
            rowUpd.puesto_id = null;
            rowUpd.puesto = "";
            if (!rowUpd.unidad) rowUpd.unidad = "";
          }
        }
        updateField(uid, rowUpd);
        count++;
      });

      document.getElementById("batchSucursal").value = "";
      document.getElementById("batchUnidad").value = "";
      document.getElementById("batchPuesto").value = "";
      document.getElementById("batchResponsable").value = "";
      document.getElementById("batchEstado").value = "";
      state.selectedUids.clear();
      refreshBatchCascadeOptions();
      renderAll();
      showToast(`Cambios aplicados a ${count} bien(es).`);
    });

    // Descargas, Envío GitHub y Borrador
    document.getElementById("btnTokenConfig").addEventListener("click", openTokenModal);
    document.getElementById("btnCloseTokenModal").addEventListener("click", () => document.getElementById("tokenModal").classList.add("hidden"));
    document.getElementById("btnCancelToken").addEventListener("click", () => document.getElementById("tokenModal").classList.add("hidden"));
    document.getElementById("btnSaveTestToken").addEventListener("click", saveAndTestToken);
    document.getElementById("btnRemoveToken").addEventListener("click", () => {
      clearGhToken();
      renderHeaderAndTabs();
      document.getElementById("tokenModal").classList.add("hidden");
      showToast("Token eliminado del navegador.");
    });

    document.getElementById("btnPushGithub").addEventListener("click", openPushConfirmModal);
    document.getElementById("btnClosePushModal").addEventListener("click", () => document.getElementById("pushConfirmModal").classList.add("hidden"));
    document.getElementById("btnCancelPush").addEventListener("click", () => document.getElementById("pushConfirmModal").classList.add("hidden"));
    document.getElementById("btnConfirmPush").addEventListener("click", confirmPushToGithub);

    document.getElementById("btnDownloadBranchJson").addEventListener("click", () => downloadJsonPackage(true));
    document.getElementById("btnDownloadAllJson").addEventListener("click", () => downloadJsonPackage(false));
    document.getElementById("btnExportExcel").addEventListener("click", exportExcelTable);
    document.getElementById("btnClearDraft").addEventListener("click", () => {
      const cnt = Object.keys(state.drafts).length;
      if (cnt === 0) return;
      if (!confirm(`¿Descartar los ${cnt} cambios guardados en el borrador local de este navegador?`)) return;
      state.drafts = {};
      persistDrafts();
      renderAll();
      showToast("Borrador local limpiado.");
    });

    // Paginación
    document.getElementById("pageSizeSelect").addEventListener("change", (e) => {
      state.pageSize = Number(e.target.value);
      state.page = 1;
      renderTable();
    });
    document.getElementById("pgFirst").addEventListener("click", () => { state.page = 1; renderTable(); });
    document.getElementById("pgPrev").addEventListener("click", () => { state.page = Math.max(1, state.page - 1); renderTable(); });
    document.getElementById("pgNext").addEventListener("click", () => { state.page += 1; renderTable(); });
    document.getElementById("pgLast").addEventListener("click", () => {
      const total = getFilteredItems().length;
      state.page = state.pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / state.pageSize));
      renderTable();
    });
  }

  // Arranque
  bindEvents();
  if (sessionStorage.getItem(SESSION_AUTH_KEY) === "1") {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    initData();
  }
})();
