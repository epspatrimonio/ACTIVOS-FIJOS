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

  const INITIAL_CHUNK = 250;
  const SCROLL_CHUNK = 200;

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
    filteredCache: [],
    renderedCount: 0,
    activeSucursalId: "ALL",
    search: "",
    filterUnidad: "",
    filterPuesto: "",
    filterEstado: "",
    activePill: "ALL",
    sortMode: "JERARQUICO",
    colSortKey: null,
    colSortDir: "asc",
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

  function formatSucursalTitle(name) {
    const clean = String(name || "").trim();
    if (!clean) return "—";
    return clean.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
  }

  function getEstadoSelectClass(est) {
    const k = normText(est);
    if (k === "BUENO") return "est-bueno";
    if (k === "REGULAR") return "est-regular";
    if (k === "MALO") return "est-malo";
    if (k === "PARA BAJA" || k === "BAJA" || k === "FALTANTE") return "est-baja";
    return "";
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
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:40px; color:#e11d48; font-weight:700;">Error al cargar inventario: ${escapeHtml(err.message)}. Ejecute Sincronizar en el APP Activos Fijos.</td></tr>`;
      }
    }
  }

  function populateStaticSelects() {
    const estOpts = state.catalogos.estados.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
    document.getElementById("batchEstado").innerHTML = `<option value="">— Estado —</option>${estOpts}`;

    const sucOpts = state.catalogos.sucursales
      .map((s) => `<option value="${s.id_sucursal}">${escapeHtml(s.sucursal)} (${escapeHtml(s.localidad)})</option>`)
      .join("");
    document.getElementById("batchSucursal").innerHTML = `<option value="">— Cambiar Sucursal —</option>${sucOpts}`;
    refreshDynamicFilters();
    refreshBatchCascadeOptions();
  }

  const EMPTY_FILTER = "__EMPTY__";

  function filterItemsExcluding(exclude = {}) {
    const qTokens = exclude.search ? [] : normText(state.search).split(/\s+/).filter(Boolean);
    const activeSucId = state.activeSucursalId;

    return state.items
      .map(getEffectiveItem)
      .filter((it) => {
        if (!exclude.sucursal && activeSucId !== "ALL" && String(it.id_sucursal || "") !== String(activeSucId)) return false;

        if (!exclude.pill) {
          if (state.activePill === "ACTIVO" && it.origen_tabla !== "ACTIVO") return false;
          if (state.activePill === "OBRA" && it.tipo_origen !== "OBRA EN CURSO") return false;
          if (state.activePill === "CONCILIACION" && it.sub_modulo !== "CONCILIACION") return false;
          if (state.activePill === "SOBRANTE" && it.sub_modulo !== "SOBRANTE") return false;
          if (state.activePill === "SIN_RESP") {
            const resp = normText(it.responsable);
            if (resp && resp !== "SIN ASIGNAR" && resp !== "PENDIENTE DE UBICACION") return false;
          }
          if (state.activePill === "MODIFICADOS" && !it._isModified) return false;
        }

        if (!exclude.unidad && state.filterUnidad) {
          const uNorm = normText(it.unidad);
          if (state.filterUnidad === EMPTY_FILTER ? uNorm !== "" : uNorm !== normText(state.filterUnidad)) return false;
        }
        if (!exclude.puesto && state.filterPuesto) {
          const pNorm = normText(it.puesto);
          if (state.filterPuesto === EMPTY_FILTER ? pNorm !== "" : pNorm !== normText(state.filterPuesto)) return false;
        }
        if (!exclude.estado && state.filterEstado) {
          const eNorm = normText(it.estado_activo);
          if (state.filterEstado === EMPTY_FILTER ? eNorm !== "" : eNorm !== normText(state.filterEstado)) return false;
        }

        if (qTokens.length > 0) {
          const blob = normText([
            it.cod_patrimonial, it.denominacion, it.marca, it.modelo, it.numero_serie,
            it.color, it.placa, it.responsable, it.unidad, it.puesto, it.sucursal,
            it.observaciones, it.caracteristicas_accesorios
          ].join(" "));
          if (!qTokens.every((t) => blob.includes(t))) return false;
        }
        return true;
      });
  }

  function buildDynamicSelect(selectEl, items, getValue, allLabel, emptyLabel, currentVal) {
    const counts = new Map();
    let emptyCount = 0;

    items.forEach((it) => {
      const raw = String(getValue(it) || "").trim();
      const key = normText(raw);
      if (!key) {
        emptyCount += 1;
        return;
      }
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { value: raw, label: raw, count: 1 });
      }
    });

    let nextVal = currentVal || "";
    if (nextVal === EMPTY_FILTER) {
      if (emptyCount === 0) nextVal = "";
    } else if (nextVal) {
      const currNorm = normText(nextVal);
      if (!counts.has(currNorm)) nextVal = "";
      else nextVal = counts.get(currNorm).value;
    }

    const sorted = Array.from(counts.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" })
    );

    const opts = [`<option value="">${escapeHtml(allLabel)} (${items.length})</option>`]
      .concat(
        sorted.map(
          (entry) =>
            `<option value="${escapeHtml(entry.value)}" ${entry.value === nextVal ? "selected" : ""}>${escapeHtml(entry.label)} (${entry.count})</option>`
        )
      );
    if (emptyCount > 0) {
      opts.push(
        `<option value="${EMPTY_FILTER}" ${nextVal === EMPTY_FILTER ? "selected" : ""}>${escapeHtml(emptyLabel)} (${emptyCount})</option>`
      );
    }
    selectEl.innerHTML = opts.join("");
    return nextVal;
  }

  function refreshDynamicFilters() {
    // 1. Unidad Orgánica (según sucursal, búsqueda, píldora y estado)
    const unidadItems = filterItemsExcluding({ unidad: true, puesto: true });
    state.filterUnidad = buildDynamicSelect(
      document.getElementById("filterUnidad"),
      unidadItems,
      (it) => it.unidad,
      "Todas las Unidades Orgánicas",
      "(Sin Unidad Orgánica)",
      state.filterUnidad
    );

    // 2. Puesto (en cascada tras unidad)
    const puestoItems = filterItemsExcluding({ puesto: true });
    state.filterPuesto = buildDynamicSelect(
      document.getElementById("filterPuesto"),
      puestoItems,
      (it) => it.puesto,
      "Todos los Puestos",
      "(Sin Puesto)",
      state.filterPuesto
    );

    // 3. Estado real en la tabla filtrada
    const estadoItems = filterItemsExcluding({ estado: true });
    state.filterEstado = buildDynamicSelect(
      document.getElementById("filterEstado"),
      estadoItems,
      (it) => it.estado_activo,
      "Todos los Estados",
      "(Sin Estado)",
      state.filterEstado
    );

    // 4. Píldoras rápidas con conteos reales de la vista actual
    const pillItems = filterItemsExcluding({ pill: true });
    const pillCounts = {
      ALL: pillItems.length,
      ACTIVO: 0,
      OBRA: 0,
      CONCILIACION: 0,
      SOBRANTE: 0,
      SIN_RESP: 0,
      MODIFICADOS: 0,
    };
    pillItems.forEach((it) => {
      if (it.origen_tabla === "ACTIVO") pillCounts.ACTIVO += 1;
      if (it.tipo_origen === "OBRA EN CURSO") pillCounts.OBRA += 1;
      if (it.sub_modulo === "CONCILIACION") pillCounts.CONCILIACION += 1;
      if (it.sub_modulo === "SOBRANTE") pillCounts.SOBRANTE += 1;
      const resp = normText(it.responsable);
      if (!resp || resp === "SIN ASIGNAR" || resp === "PENDIENTE DE UBICACION") pillCounts.SIN_RESP += 1;
      if (it._isModified) pillCounts.MODIFICADOS += 1;
    });

    document.querySelectorAll("#quickPills .q-pill[data-pill]").forEach((btn) => {
      const key = btn.dataset.pill;
      const cnt = pillCounts[key] ?? 0;
      const cntSpan = btn.querySelector(".q-pill-cnt");
      if (cntSpan) cntSpan.textContent = `(${cnt})`;
      btn.disabled = cnt === 0 && key !== "ALL" && key !== "MODIFICADOS" && state.activePill !== key;
    });
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

  // ── Filtrado, Ordenamiento Jerárquico y Conteos ────────────────────────────
  function cmpText(a, b, emptyLast = true) {
    const sa = String(a || "").trim();
    const sb = String(b || "").trim();
    if (emptyLast) {
      const ea = !sa || sa === "—" || sa.toUpperCase() === "SIN ASIGNAR";
      const eb = !sb || sb === "—" || sb.toUpperCase() === "SIN ASIGNAR";
      if (ea && !eb) return 1;
      if (!ea && eb) return -1;
      if (ea && eb) return 0;
    }
    return sa.localeCompare(sb, "es", { numeric: true, sensitivity: "base" });
  }

  function compareJerarquico(a, b) {
    return (
      cmpText(a.sucursal, b.sucursal) ||
      cmpText(a.unidad, b.unidad) ||
      cmpText(a.puesto, b.puesto) ||
      cmpText(a.responsable, b.responsable) ||
      cmpText(a.denominacion, b.denominacion) ||
      cmpText(a.cod_patrimonial, b.cod_patrimonial)
    );
  }

  function sortItems(list) {
    const arr = [...list];
    if (state.colSortKey) {
      const k = state.colSortKey;
      const dir = state.colSortDir === "desc" ? -1 : 1;
      arr.sort((a, b) => {
        const c = cmpText(a[k], b[k], true);
        if (c !== 0) return c * dir;
        return compareJerarquico(a, b);
      });
      return arr;
    }

    switch (state.sortMode) {
      case "UNIDAD_PUESTO":
        arr.sort((a, b) =>
          cmpText(a.unidad, b.unidad) ||
          cmpText(a.puesto, b.puesto) ||
          cmpText(a.denominacion, b.denominacion) ||
          cmpText(a.cod_patrimonial, b.cod_patrimonial)
        );
        break;
      case "RESPONSABLE":
        arr.sort((a, b) =>
          cmpText(a.responsable, b.responsable) ||
          cmpText(a.puesto, b.puesto) ||
          cmpText(a.denominacion, b.denominacion)
        );
        break;
      case "CODIGO_ASC":
        arr.sort((a, b) => cmpText(a.cod_patrimonial, b.cod_patrimonial));
        break;
      case "CODIGO_DESC":
        arr.sort((a, b) => -cmpText(a.cod_patrimonial, b.cod_patrimonial));
        break;
      case "DENOMINACION":
        arr.sort((a, b) => cmpText(a.denominacion, b.denominacion) || cmpText(a.cod_patrimonial, b.cod_patrimonial));
        break;
      case "ESTADO":
        arr.sort((a, b) => cmpText(a.estado_activo, b.estado_activo) || compareJerarquico(a, b));
        break;
      case "MODIFICADOS":
        arr.sort((a, b) => (Number(Boolean(b._isModified)) - Number(Boolean(a._isModified))) || compareJerarquico(a, b));
        break;
      case "JERARQUICO":
      default:
        arr.sort(compareJerarquico);
        break;
    }
    return arr;
  }

  function updateSortHeaderIndicators() {
    document.querySelectorAll("thead th.sortable-th").forEach((th) => {
      const ind = th.querySelector(".sort-ind");
      if (!ind) return;
      if (state.colSortKey === th.dataset.sort) {
        ind.textContent = state.colSortDir === "asc" ? "▲" : "▼";
      } else {
        ind.textContent = "";
      }
    });
  }

  function getFilteredItems() {
    return sortItems(filterItemsExcluding());
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

    const modPillCntEl = document.getElementById("modPillCount");
    if (modPillCntEl) modPillCntEl.textContent = `(${totalMod})`;
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

  function createRowOptionBuilders() {
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

    return { buildSucOpts, buildEstOpts };
  }

  let cachedOptionBuilders = null;
  function getOptionBuilders() {
    if (!cachedOptionBuilders) cachedOptionBuilders = createRowOptionBuilders();
    return cachedOptionBuilders;
  }

  function renderRowHtml(it, buildSucOpts, buildEstOpts) {
    const draft = state.drafts[it.uid];
    const chSet = new Set(it._changedFields || []);
    const isSelected = state.selectedUids.has(it.uid);

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
    const estClass = getEstadoSelectClass(it.estado_activo);

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
          <div style="font-weight:800; color:#0f172a; line-height:1.28;">${escapeHtml(it.denominacion)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:3px; display:flex; flex-wrap:wrap; align-items:center; gap:5px;">
            ${it.placa ? `<span style="background:#fef3c7; padding:1px 5px; border-radius:4px; font-weight:800; color:#92400e; border:1px solid #fde68a;">PLACA: ${escapeHtml(it.placa)}</span>` : ""}
            ${it.subcategoria ? `<span>${escapeHtml(it.subcategoria)}</span>` : ""}
          </div>
        </td>
        <td>
          <div class="spec-grid">
            <div class="spec-field">
              <span class="spec-lbl">Marca</span>
              <input type="text" class="cell-input spec-input ${chSet.has("marca") ? "cell-changed" : ""}" data-field="marca" value="${escapeHtml(it.marca || "")}" placeholder="S/M" />
            </div>
            <div class="spec-field">
              <span class="spec-lbl">Modelo</span>
              <input type="text" class="cell-input spec-input ${chSet.has("modelo") ? "cell-changed" : ""}" data-field="modelo" value="${escapeHtml(it.modelo || "")}" placeholder="S/M" />
            </div>
            <div class="spec-field">
              <span class="spec-lbl">Serie</span>
              <input type="text" class="cell-input spec-input spec-mono ${chSet.has("numero_serie") ? "cell-changed" : ""}" data-field="numero_serie" value="${escapeHtml(it.numero_serie || "")}" placeholder="S/S" />
            </div>
            <div class="spec-field">
              <span class="spec-lbl">Color</span>
              <input type="text" class="cell-input spec-input ${chSet.has("color") ? "cell-changed" : ""}" data-field="color" value="${escapeHtml(it.color || "")}" placeholder="Color" />
            </div>
          </div>
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
          <select class="cell-select ${estClass} ${chSet.has("estado_activo") ? "cell-changed" : ""}" data-field="estado_activo">
            ${buildEstOpts(it.estado_activo)}
          </select>
        </td>
        <td>
          <input
            type="text"
            class="cell-input ${chSet.has(obsFieldKey) ? "cell-changed" : ""}"
            data-field="${obsFieldKey}"
            value="${escapeHtml(obsValue)}"
            placeholder="Observación..."
          />
        </td>
      </tr>
    `;
  }

  function updateFooterInfo() {
    const total = state.filteredCache.length;
    const shown = state.renderedCount;
    const infoEl = document.getElementById("tableCountInfo");
    const loadAllBtn = document.getElementById("btnLoadAllRows");
    if (infoEl) {
      if (total === 0) {
        infoEl.textContent = "Mostrando 0 de 0 registros";
      } else if (shown < total) {
        infoEl.textContent = `Mostrando ${shown} de ${total} registros (deslice hacia abajo para ver los demás)`;
      } else {
        infoEl.textContent = `Mostrando todos los ${total} registros`;
      }
    }
    if (loadAllBtn) {
      const rem = total - shown;
      loadAllBtn.classList.toggle("hidden", rem <= 0);
      if (rem > 0) loadAllBtn.textContent = `⬇ Cargar todos los ${rem} restantes`;
    }

    const checkAll = document.getElementById("checkPageAll");
    if (checkAll) {
      checkAll.checked = total > 0 && state.filteredCache.every((x) => state.selectedUids.has(x.uid));
    }
  }

  function renderTable() {
    cachedOptionBuilders = null;
    state.filteredCache = getFilteredItems();
    const tbody = document.getElementById("tableBody");
    const scrollBox = document.getElementById("tableScroll");
    if (scrollBox) scrollBox.scrollTop = 0;

    if (state.filteredCache.length === 0) {
      state.renderedCount = 0;
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:42px; color:#64748b; font-weight:600;">No se encontraron bienes con los filtros actuales.</td></tr>`;
      updateFooterInfo();
      return;
    }

    const { buildSucOpts, buildEstOpts } = getOptionBuilders();
    const firstChunk = state.filteredCache.slice(0, INITIAL_CHUNK);
    state.renderedCount = firstChunk.length;
    tbody.innerHTML = firstChunk.map((it) => renderRowHtml(it, buildSucOpts, buildEstOpts)).join("");
    updateFooterInfo();
  }

  function appendMoreRows(limit = SCROLL_CHUNK) {
    if (state.renderedCount >= state.filteredCache.length) return;
    const nextEnd = limit === Infinity
      ? state.filteredCache.length
      : Math.min(state.renderedCount + limit, state.filteredCache.length);
    const slice = state.filteredCache.slice(state.renderedCount, nextEnd);
    if (slice.length === 0) return;
    const { buildSucOpts, buildEstOpts } = getOptionBuilders();
    const tbody = document.getElementById("tableBody");
    tbody.insertAdjacentHTML("beforeend", slice.map((it) => renderRowHtml(it, buildSucOpts, buildEstOpts)).join(""));
    state.renderedCount = nextEnd;
    updateFooterInfo();
  }

  function rerenderSingleRow(uid) {
    const base = state.items.find((x) => x.uid === uid);
    if (!base) return;
    const eff = getEffectiveItem(base);
    const idx = state.filteredCache.findIndex((x) => x.uid === uid);
    if (idx !== -1) state.filteredCache[idx] = eff;

    const tbody = document.getElementById("tableBody");
    const tr = Array.from(tbody.querySelectorAll("tr[data-uid]")).find((el) => el.dataset.uid === uid);
    if (!tr) {
      updateFooterInfo();
      return;
    }
    const { buildSucOpts, buildEstOpts } = getOptionBuilders();
    const tmp = document.createElement("tbody");
    tmp.innerHTML = renderRowHtml(eff, buildSucOpts, buildEstOpts).trim();
    if (tmp.firstElementChild) {
      tr.replaceWith(tmp.firstElementChild);
    }
    refreshDynamicFilters();
    updateFooterInfo();
  }

  function renderAll() {
    renderHeaderAndTabs();
    renderBatchBar();
    refreshDynamicFilters();
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
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
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
      "COLOR": it.color || "",
      "PLACA": it.placa || "",
      "SUCURSAL": it.sucursal || "",
      "UNIDAD ORGÁNICA": it.unidad || "",
      "PUESTO": it.puesto || "",
      "RESPONSABLE": it.responsable || "",
      "ESTADO": it.estado_activo || "",
      "OBSERVACIONES": (it.origen_tabla === "REGULARIZACION" ? it.observaciones : it.caracteristicas_accesorios) || "",
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

  function loadLogoBase64() {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.9));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = "./logo.jpg";
    });
  }

  async function exportVerificationPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast("Librería PDF no cargada.");
      return;
    }
    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      showToast("No hay registros filtrados para exportar a PDF.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 10;

    const logoData = await loadLogoBase64();
    const sucObj = state.activeSucursalId !== "ALL" ? state.sucursalById.get(Number(state.activeSucursalId)) : null;
    const sucTitle = sucObj ? formatSucursalTitle(sucObj.sucursal) : "Todas las Sucursales";
    const modCount = filtered.filter((x) => x._isModified).length;

    const filterBadges = [`Sucursal: ${sucTitle}`];
    if (state.filterUnidad) filterBadges.push(`Unidad: ${state.filterUnidad}`);
    if (state.filterPuesto) filterBadges.push(`Puesto: ${state.filterPuesto}`);
    if (state.filterEstado) filterBadges.push(`Estado: ${state.filterEstado}`);
    if (state.activePill !== "ALL") filterBadges.push(`Filtro: ${state.activePill}`);
    const nowStr = new Date().toLocaleString("es-PE");

    const drawPageHeader = () => {
      if (logoData) {
        try { doc.addImage(logoData, "JPEG", marginX, 7, 13, 13); } catch (e) {}
      }
      const xTxt = logoData ? marginX + 16 : marginX;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 80, 157);
      doc.text('E.P.S. "SELVA CENTRAL" S.A. — CONTROL PATRIMONIAL', xTxt, 11.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("RELACIÓN DE BIENES PARA VERIFICACIÓN FÍSICA DE INVENTARIO", xTxt, 16.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(filterBadges.join("   |   "), xTxt, 21);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(0, 119, 182);
      doc.text(`Total: ${filtered.length} bien(es)  ·  Modificados: ${modCount}`, pageW - marginX, 11.5, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Emisión: ${nowStr}`, pageW - marginX, 16.5, { align: "right" });

      doc.setDrawColor(0, 176, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, 23.5, pageW - marginX, 23.5);
    };

    const bodyRows = filtered.map((it, idx) => {
      const denomText = `${it.denominacion || "—"}${it.placa ? `\nPlaca: ${it.placa}` : ""}`;
      const specsText = [
        `Marca: ${it.marca || "—"}`,
        `Modelo: ${it.modelo || "—"}`,
        `Serie: ${it.numero_serie || "—"}`,
        `Color: ${it.color || "—"}`,
      ].join("\n");

      const ubicLines = [formatSucursalTitle(it.sucursal)];
      const up = [it.unidad, it.puesto].filter(Boolean).join(" · ");
      if (up) ubicLines.push(up);

      const rawObs = (it.origen_tabla === "REGULARIZACION" ? it.observaciones : it.caracteristicas_accesorios) || "";
      const obsText = `${it._isModified ? "[MOD] " : ""}${rawObs}`;

      return {
        num: String(idx + 1),
        cod: `${it.cod_patrimonial || "—"}\n[${it.tipo_origen || it.origen_tabla}]`,
        denom: denomText,
        specs: specsText,
        ubic: ubicLines.join("\n"),
        resp: it.responsable || "Sin Asignar",
        est: it.estado_activo || "—",
        check: "",
        obs: obsText,
        _isModified: Boolean(it._isModified),
      };
    });

    doc.autoTable({
      startY: 26,
      margin: { top: 26, left: marginX, right: marginX, bottom: 14 },
      rowPageBreak: "avoid",
      columns: [
        { header: "N°", dataKey: "num" },
        { header: "Código / Origen", dataKey: "cod" },
        { header: "Denominación", dataKey: "denom" },
        { header: "Marca / Modelo / Serie / Color", dataKey: "specs" },
        { header: "Sucursal / Unidad / Puesto", dataKey: "ubic" },
        { header: "Responsable", dataKey: "resp" },
        { header: "Estado", dataKey: "est" },
        { header: "Verif.", dataKey: "check" },
        { header: "Observaciones", dataKey: "obs" },
      ],
      body: bodyRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.0,
        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42],
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [0, 80, 157],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.3,
        halign: "center",
        valign: "middle",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        num: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        cod: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        denom: { cellWidth: 46, fontStyle: "bold" },
        specs: { cellWidth: 56 },
        ubic: { cellWidth: 44 },
        resp: { cellWidth: 36 },
        est: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        check: { cellWidth: 10, halign: "center" },
        obs: { cellWidth: 35 },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.row.raw && data.row.raw._isModified) {
            data.cell.styles.fillColor = [254, 249, 195];
          }
          if (data.column.dataKey === "est") {
            const estVal = normText(data.cell.raw);
            if (estVal === "BUENO") data.cell.styles.textColor = [5, 150, 105];
            else if (estVal === "MALO") data.cell.styles.textColor = [194, 65, 12];
            else if (estVal === "PARA BAJA" || estVal === "BAJA" || estVal === "FALTANTE") data.cell.styles.textColor = [190, 18, 60];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.dataKey === "check") {
          const boxSize = 3.6;
          const x = data.cell.x + (data.cell.width - boxSize) / 2;
          const y = data.cell.y + (data.cell.height - boxSize) / 2;
          doc.setDrawColor(100, 116, 139);
          doc.setLineWidth(0.3);
          doc.rect(x, y, boxSize, boxSize);
        }
      },
      didDrawPage: () => {
        drawPageHeader();
      },
    });

    // Bloque de firmas al final del documento
    let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 14 : 50;
    if (finalY + 24 > pageH - 12) {
      doc.addPage();
      drawPageHeader();
      finalY = 42;
    }
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);
    const sigWidth = 68;
    const leftX = 48;
    const rightX = pageW - 48 - sigWidth;
    doc.line(leftX, finalY, leftX + sigWidth, finalY);
    doc.line(rightX, finalY, rightX + sigWidth, finalY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("VERIFICADOR / CONTROL PATRIMONIAL", leftX + sigWidth / 2, finalY + 4.5, { align: "center" });
    doc.text("RESPONSABLE DE SUCURSAL / UNIDAD", rightX + sigWidth / 2, finalY + 4.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Nombre, Firma y Fecha", leftX + sigWidth / 2, finalY + 8.5, { align: "center" });
    doc.text("Nombre, Firma y Sello", rightX + sigWidth / 2, finalY + 8.5, { align: "center" });

    // Numeración total de páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Portal de Inventario de Campo — ${sucTitle}`, marginX, pageH - 5.5);
      doc.text(`Página ${i} de ${totalPages}`, pageW - marginX, pageH - 5.5, { align: "right" });
    }

    const slug = sucObj ? normText(sucObj.sucursal).replace(/[^A-Z0-9]+/g, "_") : "TODAS";
    doc.save(`Verificacion_Inventario_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast(`PDF generado con ${filtered.length} bien(es).`);
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
      state.selectedUids.clear();
      refreshDynamicFilters();
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
        refreshDynamicFilters();
        renderTable();
      }, 150);
    });
    document.getElementById("searchClear").addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.add("hidden");
      state.search = "";
      refreshDynamicFilters();
      renderTable();
    });
    document.getElementById("filterUnidad").addEventListener("change", (e) => {
      state.filterUnidad = e.target.value;
      state.filterPuesto = "";
      refreshDynamicFilters();
      renderTable();
    });
    document.getElementById("filterPuesto").addEventListener("change", (e) => {
      state.filterPuesto = e.target.value;
      refreshDynamicFilters();
      renderTable();
    });
    document.getElementById("filterEstado").addEventListener("change", (e) => {
      state.filterEstado = e.target.value;
      refreshDynamicFilters();
      renderTable();
    });
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      state.sortMode = e.target.value;
      state.colSortKey = null;
      updateSortHeaderIndicators();
      renderTable();
    });
    document.querySelector("thead").addEventListener("click", (e) => {
      const th = e.target.closest("th.sortable-th");
      if (!th) return;
      const key = th.dataset.sort;
      if (state.colSortKey === key) {
        state.colSortDir = state.colSortDir === "asc" ? "desc" : "asc";
      } else {
        state.colSortKey = key;
        state.colSortDir = "asc";
      }
      updateSortHeaderIndicators();
      renderTable();
    });
    document.getElementById("btnResetFilters").addEventListener("click", () => {
      state.search = "";
      state.filterUnidad = "";
      state.filterPuesto = "";
      state.filterEstado = "";
      state.activePill = "ALL";
      state.sortMode = "JERARQUICO";
      state.colSortKey = null;
      state.colSortDir = "asc";
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.add("hidden");
      document.getElementById("sortSelect").value = "JERARQUICO";
      document.querySelectorAll("#quickPills .q-pill").forEach((b) => b.classList.toggle("active", b.dataset.pill === "ALL"));
      updateSortHeaderIndicators();
      refreshDynamicFilters();
      renderTable();
    });

    // Píldoras
    document.getElementById("quickPills").addEventListener("click", (e) => {
      const pill = e.target.closest(".q-pill");
      if (!pill || pill.disabled) return;
      state.activePill = pill.dataset.pill;
      document.querySelectorAll("#quickPills .q-pill").forEach((b) => b.classList.toggle("active", b === pill));
      refreshDynamicFilters();
      renderTable();
    });

    // Edición inline en tabla (delegación de eventos)
    const tbody = document.getElementById("tableBody");
    tbody.addEventListener("click", (e) => {
      const undoBtn = e.target.closest("[data-undo]");
      if (undoBtn) {
        revertItem(undoBtn.dataset.undo);
      }
    });

    tbody.addEventListener("change", (e) => {
      if (e.target.classList.contains("row-check")) {
        const uid = e.target.dataset.uid;
        if (e.target.checked) state.selectedUids.add(uid);
        else state.selectedUids.delete(uid);
        renderBatchBar();
        const tr = e.target.closest("tr[data-uid]");
        if (tr) tr.classList.toggle("row-selected", e.target.checked);
        updateFooterInfo();
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
        if (state.activeSucursalId !== "ALL" && String(newSucId || "") !== String(state.activeSucursalId)) {
          refreshDynamicFilters();
          renderTable();
        } else {
          rerenderSingleRow(uid);
        }
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
        rerenderSingleRow(uid);
      } else if (field === "puesto_id") {
        const pid = val ? Number(val) : null;
        const pObj = pid ? state.puestoById.get(pid) : null;
        const upd = {
          puesto_id: pid,
          puesto: pObj ? pObj.puesto : "",
        };
        if (pObj && pObj.departamento) upd.unidad = pObj.departamento;
        updateField(uid, upd);
        rerenderSingleRow(uid);
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
        rerenderSingleRow(uid);
      } else {
        updateField(uid, { [field]: val });
        if (state.activePill === "MODIFICADOS" && !state.drafts[uid]) {
          refreshDynamicFilters();
          renderTable();
        } else {
          rerenderSingleRow(uid);
        }
      }
    });

    // Selección global de visibles / Lote
    document.getElementById("checkPageAll").addEventListener("change", (e) => {
      const checked = e.target.checked;
      state.filteredCache.forEach((it) => {
        if (checked) state.selectedUids.add(it.uid);
        else state.selectedUids.delete(it.uid);
      });
      document.querySelectorAll("#tableBody tr[data-uid]").forEach((tr) => {
        tr.classList.toggle("row-selected", checked);
        const chk = tr.querySelector(".row-check");
        if (chk) chk.checked = checked;
      });
      renderBatchBar();
      updateFooterInfo();
    });

    document.getElementById("btnSelectAllFiltered").addEventListener("click", () => {
      state.filteredCache.forEach((it) => state.selectedUids.add(it.uid));
      document.querySelectorAll("#tableBody tr[data-uid]").forEach((tr) => {
        tr.classList.add("row-selected");
        const chk = tr.querySelector(".row-check");
        if (chk) chk.checked = true;
      });
      renderBatchBar();
      updateFooterInfo();
    });
    document.getElementById("btnClearSelection").addEventListener("click", () => {
      state.selectedUids.clear();
      document.querySelectorAll("#tableBody tr[data-uid]").forEach((tr) => {
        tr.classList.remove("row-selected");
        const chk = tr.querySelector(".row-check");
        if (chk) chk.checked = false;
      });
      renderBatchBar();
      updateFooterInfo();
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
    document.getElementById("btnExportPdf").addEventListener("click", exportVerificationPDF);
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

    // Scroll continuo sin paginación
    const scrollBox = document.getElementById("tableScroll");
    if (scrollBox) {
      scrollBox.addEventListener("scroll", () => {
        if (scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 500) {
          appendMoreRows(SCROLL_CHUNK);
        }
      });
    }
    document.getElementById("btnLoadAllRows").addEventListener("click", () => appendMoreRows(Infinity));
    document.getElementById("btnScrollTop").addEventListener("click", () => {
      if (scrollBox) scrollBox.scrollTo({ top: 0, behavior: "smooth" });
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
