const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export function getDashboardUrl() {
  return API_BASE_URL.replace('/api', '/public/');
}

async function handleResponseError(response, defaultMsg) {
  const errorData = await response.json().catch(() => ({}));
  let msg = errorData.detail;
  if (msg && typeof msg === 'object') {
    if (Array.isArray(msg)) {
      msg = msg.map(e => {
        const fieldName = e.loc ? e.loc[e.loc.length - 1] : 'campo';
        return `${fieldName}: ${e.msg}`;
      }).join(', ');
    } else {
      msg = JSON.stringify(msg);
    }
  }
  throw new Error(msg || defaultMsg);
}

/**
 * Obtiene la lista de activos del backend local.
 * Soporta filtros opcionales de estado_activo e id_sucursal.
 */
export async function fetchActivos(filters = {}) {
  const url = new URL(`${API_BASE_URL}/activos`, window.location.origin);
  
  if (filters.estado_activo) {
    url.searchParams.append('estado_activo', filters.estado_activo);
  }
  if (filters.id_sucursal) {
    url.searchParams.append('id_sucursal', filters.id_sucursal);
  }
  if (filters.cuenta_contable) {
    url.searchParams.append('cuenta_contable', filters.cuenta_contable);
  }
  if (filters.centro_costo) {
    url.searchParams.append('centro_costo', filters.centro_costo);
  }
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    await handleResponseError(response, 'Error al cargar los activos.');
  }
  return response.json();
}

export async function fetchUltimasActas() {
  const response = await fetch(`${API_BASE_URL}/activos/ultimas-actas`);
  if (!response.ok) throw new Error('Error al cargar las últimas actas.');
  return response.json();
}

/**
 * Registra un nuevo activo en la base de datos local.
 */
export async function createActivo(activoData) {
  const response = await fetch(`${API_BASE_URL}/activos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activoData),
  });
  
  if (!response.ok) {
    await handleResponseError(response, 'Error al registrar el activo.');
  }
  return response.json();
}

/**
 * Desencadena la sincronización pública (exportación de activos.json).
 */
export async function sincronizarPublico() {
  const response = await fetch(`${API_BASE_URL}/activos/sincronizar-publico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    await handleResponseError(response, 'Error al sincronizar el dashboard público.');
  }
  return response.json();
}

// ── Listas de dimensiones (para selectores del formulario) ──────────────────

export async function fetchSucursales() {
  const response = await fetch(`${API_BASE_URL}/listas/sucursales`);
  if (!response.ok) throw new Error('Error al cargar sucursales.');
  return response.json();
}

export async function fetchSubcategorias() {
  const response = await fetch(`${API_BASE_URL}/listas/subcategorias`);
  if (!response.ok) throw new Error('Error al cargar subcategorías.');
  return response.json();
}

export async function fetchPuestos(id_sucursal = null) {
  const url = new URL(`${API_BASE_URL}/listas/puestos`, window.location.origin);
  if (id_sucursal) url.searchParams.append('id_sucursal', id_sucursal);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Error al cargar puestos.');
  return response.json();
}

export async function fetchPersonal() {
  const response = await fetch(`${API_BASE_URL}/listas/personal`);
  if (!response.ok) throw new Error('Error al cargar personal.');
  return response.json();
}

export async function fetchLocalidades() {
  const response = await fetch(`${API_BASE_URL}/listas/localidades`);
  if (!response.ok) throw new Error('Error al cargar localidades.');
  return response.json();
}

export async function fetchCuentasContables() {
  const response = await fetch(`${API_BASE_URL}/listas/cuentas-contables`);
  if (!response.ok) throw new Error('Error al cargar cuentas contables.');
  return response.json();
}

export async function fetchCentrosCosto() {
  const response = await fetch(`${API_BASE_URL}/listas/centros-costo`);
  if (!response.ok) throw new Error('Error al cargar centros de costo.');
  return response.json();
}

export async function fetchFuentes() {
  const response = await fetch(`${API_BASE_URL}/listas/fuentes`);
  if (!response.ok) throw new Error('Error al cargar fuentes de financiamiento.');
  return response.json();
}

/**
 * Actualiza un activo existente en el backend.
 */
export async function updateActivo(cod_patrimonial, activoData) {
  const response = await fetch(`${API_BASE_URL}/activos/${cod_patrimonial}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activoData),
  });
  
  if (!response.ok) {
    await handleResponseError(response, 'Error al actualizar el activo.');
  }
  return response.json();
}

/**
 * Elimina un activo del backend.
 */
export async function deleteActivo(cod_patrimonial) {
  const response = await fetch(`${API_BASE_URL}/activos/${cod_patrimonial}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    await handleResponseError(response, 'Error al eliminar el activo.');
  }
  return true;
}

export async function fetchCompra(n_doc) {
  const response = await fetch(`${API_BASE_URL}/compras/${encodeURIComponent(n_doc)}`);
  if (!response.ok) throw new Error('Expediente de compra no encontrado.');
  return response.json();
}

export async function fetchIncorporacion(n_doc) {
  const response = await fetch(`${API_BASE_URL}/incorporaciones/${encodeURIComponent(n_doc)}`);
  if (!response.ok) throw new Error('Documento de incorporación no encontrado.');
  return response.json();
}

export async function fetchCompras() {
  const response = await fetch(`${API_BASE_URL}/compras`);
  if (!response.ok) throw new Error('Error al cargar expedientes de compra.');
  return response.json();
}

export async function fetchIncorporaciones() {
  const response = await fetch(`${API_BASE_URL}/incorporaciones`);
  if (!response.ok) throw new Error('Error al cargar documentos de incorporación.');
  return response.json();
}

export async function createCompra(compraData) {
  const response = await fetch(`${API_BASE_URL}/compras`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(compraData),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al registrar el expediente de compra.');
  }
  return response.json();
}

export async function createIncorporacion(incData) {
  const response = await fetch(`${API_BASE_URL}/incorporaciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(incData),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al registrar la incorporación.');
  }
  return response.json();
}

export async function renameCompra(oldNDoc, newNDoc) {
  const response = await fetch(`${API_BASE_URL}/compras/${encodeURIComponent(oldNDoc)}/rename`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_n_doc: newNDoc }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al renombrar la orden de compra.');
  }
  return response.json();
}

export async function renameIncorporacion(oldNDoc, newNDoc) {
  const response = await fetch(`${API_BASE_URL}/incorporaciones/${encodeURIComponent(oldNDoc)}/rename`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_n_doc: newNDoc }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al renombrar la resolución de incorporación.');
  }
  return response.json();
}

export async function fetchObra(n_doc) {
  const response = await fetch(`${API_BASE_URL}/obras/${encodeURIComponent(n_doc)}`);
  if (!response.ok) throw new Error('Expediente de obra no encontrado.');
  return response.json();
}

export async function fetchObras() {
  const response = await fetch(`${API_BASE_URL}/obras`);
  if (!response.ok) throw new Error('Error al cargar expedientes de obra.');
  return response.json();
}

export async function createObra(obraData) {
  const response = await fetch(`${API_BASE_URL}/obras`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(obraData),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al registrar el expediente de obra.');
  }
  return response.json();
}

export async function renameObra(oldNDoc, newNDoc) {
  const response = await fetch(`${API_BASE_URL}/obras/${encodeURIComponent(oldNDoc)}/rename`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_n_doc: newNDoc }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al renombrar el expediente de obra.');
  }
  return response.json();
}

export async function fetchCodigoPatrimonialObra(idLocalidad) {
  const response = await fetch(`${API_BASE_URL}/obras/generar-codigo-patrimonial/${idLocalidad}`);
  if (!response.ok) throw new Error('Error al generar el código patrimonial automático para la obra.');
  return response.json();
}

export async function deleteCompra(nDoc) {
  const response = await fetch(`${API_BASE_URL}/compras/${encodeURIComponent(nDoc)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al eliminar la orden de compra.');
  }
}

export async function deleteIncorporacion(nDoc) {
  const response = await fetch(`${API_BASE_URL}/incorporaciones/${encodeURIComponent(nDoc)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al eliminar la incorporación.');
  }
}

export async function deleteObra(nDoc) {
  const response = await fetch(`${API_BASE_URL}/obras/${encodeURIComponent(nDoc)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Error al eliminar el expediente de obra.');
  }
}

// ── Celulares (activos sujetos a control) ────────────────────────────────────

export async function fetchCelulares(filters = {}) {
  const url = new URL(`${API_BASE_URL}/celulares`, window.location.origin);
  if (filters.id_sucursal) url.searchParams.append('id_sucursal', filters.id_sucursal);
  if (filters.estado) url.searchParams.append('estado', filters.estado);
  if (filters.cod_personal) url.searchParams.append('cod_personal', filters.cod_personal);
  const response = await fetch(url.toString());
  if (!response.ok) await handleResponseError(response, 'Error al cargar celulares.');
  return response.json();
}

export async function createCelular(data) {
  const response = await fetch(`${API_BASE_URL}/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) await handleResponseError(response, 'Error al registrar el celular.');
  return response.json();
}

export async function updateCelular(id_celular, data) {
  const response = await fetch(`${API_BASE_URL}/celulares/${id_celular}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) await handleResponseError(response, 'Error al actualizar el celular.');
  return response.json();
}

export async function deleteCelular(id_celular) {
  const response = await fetch(`${API_BASE_URL}/celulares/${id_celular}`, { method: 'DELETE' });
  if (!response.ok) await handleResponseError(response, 'Error al eliminar el celular.');
  return true;
}

export async function fetchGenerarCodigoCelular(id_sucursal) {
  const response = await fetch(`${API_BASE_URL}/celulares/generar-codigo/${id_sucursal}`);
  if (!response.ok) throw new Error('Error al generar código de celular.');
  return response.json(); // { codigo, prefijo, siguiente }
}

export async function fetchGenerarCodigoVehiculo(id_sucursal) {
  const response = await fetch(`${API_BASE_URL}/vehiculos/generar-codigo/${id_sucursal}`);
  if (!response.ok) throw new Error('Error al generar código de vehículo.');
  return response.json();
}

// ── Vehículos: Detalle particular ────────────────────────────────────────────

export async function fetchVehiculoDetalle(cod_patrimonial) {
  const response = await fetch(`${API_BASE_URL}/vehiculos/${encodeURIComponent(cod_patrimonial)}/detalle`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Error al cargar detalle del vehículo.');
  return response.json();
}

export async function upsertVehiculoDetalle(cod_patrimonial, data) {
  const response = await fetch(`${API_BASE_URL}/vehiculos/${encodeURIComponent(cod_patrimonial)}/detalle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) await handleResponseError(response, 'Error al guardar detalle del vehículo.');
  return response.json();
}

export async function fetchVehiculos() {
  const response = await fetch(`${API_BASE_URL}/vehiculos`);
  if (!response.ok) throw new Error('Error al cargar detalles de vehículos.');
  return response.json();
}

// ── SOAT ─────────────────────────────────────────────────────────────────────

export async function fetchSoat() {
  const response = await fetch(`${API_BASE_URL}/soat`);
  if (!response.ok) await handleResponseError(response, 'Error al cargar registros SOAT.');
  return response.json();
}

export async function fetchSoatPorVehiculo(cod_patrimonial) {
  const response = await fetch(`${API_BASE_URL}/soat/vehiculo/${encodeURIComponent(cod_patrimonial)}`);
  if (!response.ok) await handleResponseError(response, 'Error al cargar SOAT del vehículo.');
  return response.json();
}

export async function createSoat(data) {
  const response = await fetch(`${API_BASE_URL}/soat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) await handleResponseError(response, 'Error al registrar el SOAT.');
  return response.json();
}

export async function updateSoat(id_soat, data) {
  const response = await fetch(`${API_BASE_URL}/soat/${id_soat}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) await handleResponseError(response, 'Error al actualizar el SOAT.');
  return response.json();
}

export async function deleteSoat(id_soat) {
  const response = await fetch(`${API_BASE_URL}/soat/${id_soat}`, { method: 'DELETE' });
  if (!response.ok) await handleResponseError(response, 'Error al eliminar el SOAT.');
  return true;
}


// ── Inventario Físico (Faltantes y Sobrantes) ──────────────────────────────────

export async function fetchInventarioFisico(tipo = '') {
  const url = new URL(`${API_BASE_URL}/inventario-fisico`, window.location.origin);
  if (tipo) url.searchParams.append('tipo', tipo);
  const response = await fetch(url.toString());
  if (!response.ok) await handleResponseError(response, 'Error al cargar inventario físico.');
  return response.json();
}

export async function saveInventarioFisico(cod_patrimonial, data, isEdit = false) {
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit 
    ? `${API_BASE_URL}/inventario-fisico/${encodeURIComponent(cod_patrimonial)}` 
    : `${API_BASE_URL}/inventario-fisico`;
  
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleResponseError(response, isEdit ? 'Error al actualizar inventario físico.' : 'Error al registrar inventario físico.');
  }
  return response.json();
}

export async function deleteInventarioFisico(cod_patrimonial) {
  const response = await fetch(`${API_BASE_URL}/inventario-fisico/${encodeURIComponent(cod_patrimonial)}`, {
    method: 'DELETE',
  });
  if (!response.ok) await handleResponseError(response, 'Error al eliminar registro de inventario físico.');
  return true;
}

export async function fetchGenerarCodigoSobrante(cod_categoria) {
  const response = await fetch(`${API_BASE_URL}/inventario-fisico/generar-codigo/${cod_categoria}`);
  if (!response.ok) throw new Error('Error al generar código de sobrante.');
  return response.json(); // { codigo, siguiente }
}

// ── Bienes de Terceros y Control ─────────────────────────────────────────────

export async function fetchBienesTerceros(tipo = '') {
  const url = new URL(`${API_BASE_URL}/bienes-terceros`, window.location.origin);
  if (tipo) url.searchParams.append('tipo', tipo);
  const response = await fetch(url.toString());
  if (!response.ok) await handleResponseError(response, 'Error al cargar bienes de terceros/control.');
  return response.json();
}

export async function saveBienTercero(cod_patrimonial, data, isEdit = false) {
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit 
    ? `${API_BASE_URL}/bienes-terceros/${encodeURIComponent(cod_patrimonial)}` 
    : `${API_BASE_URL}/bienes-terceros`;
  
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleResponseError(response, isEdit ? 'Error al actualizar bien.' : 'Error al registrar bien.');
  }
  return response.json();
}

export async function deleteBienTercero(cod_patrimonial) {
  const response = await fetch(`${API_BASE_URL}/bienes-terceros/${encodeURIComponent(cod_patrimonial)}`, {
    method: 'DELETE',
  });
  if (!response.ok) await handleResponseError(response, 'Error al eliminar bien.');
  return true;
}

export async function fetchGenerarCodigoTerceroControl(tipo) {
  const response = await fetch(`${API_BASE_URL}/bienes-terceros/generar-codigo/${tipo}`);
  if (!response.ok) throw new Error('Error al generar código.');
  return response.json(); // { codigo, siguiente }
}

