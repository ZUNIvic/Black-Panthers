// Comunicación con el script de la hoja de Google (ver apps-script/Codigo.gs).

async function conTiempo(promesa, ms, ctrl) {
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promesa;
  } finally {
    clearTimeout(t);
  }
}

async function aJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('La hoja no ha devuelto datos válidos. ¿Está publicada como "Cualquier usuario"?');
  }
}

/**
 * Lee los datos de la hoja. Si el equipo tiene PIN, va en la petición:
 * sin él, el script no entrega nada.
 */
export async function leerHoja(url, pinEquipo = '') {
  const datos = await enviarHoja(url, { accion: 'datos', pinEquipo });
  if (!datos.ok) {
    const e = new Error(datos.error === 'pin_equipo' ? 'Hace falta el PIN del equipo' : 'La hoja devolvió un error');
    e.codigo = datos.error;
    throw e;
  }
  return datos;
}

/** Envía una acción del staff. El cuerpo va como texto para evitar la comprobación CORS previa. */
export async function enviarHoja(url, datos) {
  const ctrl = new AbortController();
  const r = await conTiempo(
    fetch(url, { method: 'POST', body: JSON.stringify(datos), signal: ctrl.signal }),
    30000,
    ctrl
  );
  return aJson(r);
}
