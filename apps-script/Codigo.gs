/**
 * Black Panthers FC — script de la hoja de Google.
 *
 * Hace dos cosas:
 *  1. Entrega a la web SOLO los datos marcados como "Mostrar" (la hoja sigue siendo privada).
 *  2. Guarda lo que el staff edita desde la web. Hay tres PIN, guardados fuera de la hoja:
 *     - PIN del míster: convocatorias y comentarios de los partidos.
 *     - PIN del tesorero: cuotas y multas.
 *     - PIN de administrador (el propietario): todo, incluidos los tres PIN.
 *
 * Instalación: ver GUIA-HOJA.md. Tras cambiar este código hay que publicar una versión nueva
 * (Implementar → Gestionar implementaciones → Editar → Versión: nueva).
 */

const COPAFACIL = {
  base: 'https://copafacil-web.firebaseio.com/events',
  evento: '-o2nrr@1e38',
  equipo: '-OwzuKi8TTHWdaqkVAho',
};

const NARANJA = '#ff6b00';

// Estados de un jugador en un partido (antes: convocado; después: si vino o no).
const ESTADOS = { convocado: 'Convocado', no_viene: 'No viene', no_convocado: 'No convocado' };
const CACHE_SEGUNDOS = 60;
const MAX_FALLOS_PIN = 20; // intentos fallidos permitidos cada 15 minutos
const FILAS = 300; // filas preparadas con casillas y formatos

const HOJAS = {
  LEEME: 'LEEME',
  AJUSTES: 'AJUSTES',
  ANUNCIOS: 'ANUNCIOS',
  JUGADORES: 'JUGADORES',
  LESIONES: 'LESIONES',
  ENTRENOS: 'ENTRENOS',
  MENSAJES: 'MENSAJES',
  MEJORAR: 'MEJORAR',
  FUERTES: 'FUERTES',
  COMENTARIOS: 'COMENTARIOS',
  NORMATIVA: 'NORMATIVA',
  QUEDADAS: 'QUEDADAS',
  FOTOS: 'FOTOS',
  CONVOCATORIAS: 'CONVOCATORIAS',
  VOTOS: 'VOTOS',
  MVP: 'MVP',
  ESTRATEGIA: 'ESTRATEGIA',
  ENTRADAS: 'ENTRADAS',
  PRELISTA: 'PRELISTA',
};

// Roles del equipo (se pueden poner varios por jugador, separados por comas).
// Presidente, Vicepresidente, Delegado, Tesorero y Vocal forman la junta directiva.
const ROLES = ['Míster', 'Segundo entrenador', 'Tercer entrenador', 'Cuarto entrenador', 'Capitán', 'Segundo capitán',
  'Presidente', 'Vicepresidente', 'Delegado', 'Tesorero', 'Vocal', 'Miembro fundador'];
const ENTRENADORES = ['Segundo entrenador', 'Tercer entrenador', 'Cuarto entrenador'];

// Roles de partida al preparar la hoja (por ID de CopaFácil). Luego se cambian desde la web o la hoja.
const ROLES_INICIALES = {
  '1757268017978': 'Miembro fundador, Presidente, Delegado, Cuarto entrenador', // Victor David Mota
  '1757267746823': 'Miembro fundador, Tesorero', // Lisandro Andres Zamora
  '1757268066398': 'Miembro fundador, Vicepresidente, Segundo entrenador', // Victor Zuñiga
  '1788983476294': 'Míster', // Bolney Castro
  '1775278164805': 'Capitán, Vocal', // Sergi Fernandez
  '1755147860637': 'Segundo capitán', // Jon Ander Uriguen
  '1757267487227': 'Vocal', // David Sancho
  '1757267383909': 'Vocal', // Cristian Segura
};

// Nombre corto (para Roles del equipo). Si está vacío, la web usa la inicial y el apellido.
const NOMBRES_CORTOS_INICIALES = {
  '1757268017978': 'V. Mota',
  '1757268066398': 'V. Zúñiga',
  '1757267746823': 'Lisandro Andrés',
};

// Entrenadores que no están en la plantilla de CopaFácil: solo nombre, en AJUSTES.
const CUERPO_TECNICO_INICIAL = [['Segundo entrenador', ''], ['Tercer entrenador', 'Sergi Bartel'], ['Cuarto entrenador', '']];

// Columnas fijas de ENTRENOS; detrás van los jugadores (una columna cada uno).
const ENTRENOS_FIJAS = ['Fecha', 'Hora', 'Lugar', 'Mostrar'];

const ESTRUCTURA = {
  LEEME: { cabecera: ['Cómo usar esta hoja'], anchos: [820] },
  AJUSTES: { cabecera: ['Ajuste', 'Valor'], anchos: [240, 260] },
  ANUNCIOS: {
    cabecera: ['Fecha', 'Título', 'Texto', 'Importante', 'Caduca', 'Mostrar'],
    anchos: [110, 240, 460, 110, 110, 90],
  },
  JUGADORES: {
    cabecera: ['ID CopaFácil', 'Dorsal', 'Nombre', 'Apodo', 'Nombre corto', 'Activo', 'Roles', 'Cuotas pendientes', 'Multas pendientes', 'Cumpleaños', 'Mostrar cumpleaños'],
    anchos: [130, 70, 240, 170, 140, 70, 260, 140, 140, 120, 150],
  },
  LESIONES: {
    cabecera: ['Jugador', 'Estado', 'Detalle', 'Vuelta prevista', 'Mostrar', 'Mostrar detalle'],
    anchos: [220, 110, 260, 130, 90, 130],
  },
  ENTRENOS: { cabecera: ENTRENOS_FIJAS, anchos: [110, 80, 200, 90] },
  MENSAJES: { cabecera: ['Fecha', 'Tipo', 'Texto', 'Firma', 'Mostrar'], anchos: [110, 150, 460, 160, 90] },
  MEJORAR: { cabecera: ['Para', 'Aspecto', 'Detalle', 'Mostrar'], anchos: [200, 240, 420, 90] },
  FUERTES: { cabecera: ['Para', 'Punto fuerte', 'Detalle', 'Mostrar'], anchos: [200, 240, 420, 90] },
  COMENTARIOS: { cabecera: ['Jornada', 'Para', 'Comentario', 'Firma', 'Mostrar'], anchos: [90, 220, 520, 150, 90] },
  NORMATIVA: { cabecera: ['Norma', 'Detalle', 'Mostrar'], anchos: [260, 520, 90] },
  QUEDADAS: {
    cabecera: ['Fecha', 'Hora', 'Plan', 'Lugar', 'Organiza', 'Enlace', 'Mostrar'],
    anchos: [110, 80, 260, 200, 150, 220, 90],
  },
  FOTOS: { cabecera: ['Fecha', 'Título', 'Enlace foto', 'Mostrar'], anchos: [110, 240, 420, 90] },
  CONVOCATORIAS: {
    cabecera: ['Partido ID', 'Fecha partido', 'Rival', 'Jugador ID', 'Jugador', 'Estado', 'Actualizado'],
    anchos: [130, 110, 220, 130, 220, 100, 150],
  },
  VOTOS: {
    cabecera: ['Partido ID', 'Votante ID', 'Votante', 'Votado ID', 'Votado', 'Estrellas', 'Cuándo'],
    anchos: [130, 130, 200, 130, 200, 90, 150],
  },
  MVP: {
    cabecera: ['Partido ID', 'Jornada', 'Rival', 'Jugador ID', 'Jugador', 'Actualizado'],
    anchos: [130, 80, 220, 130, 220, 150],
  },
  ESTRATEGIA: {
    cabecera: ['Partido ID', 'Tipo', 'Jugador ID', 'Jugador', 'X', 'Y', 'X2', 'Y2', 'Actualizado'],
    anchos: [130, 90, 130, 200, 70, 70, 70, 70, 150],
  },
  ENTRADAS: {
    cabecera: ['Jugador ID', 'Jugador', 'Cuándo'],
    anchos: [130, 240, 150],
  },
  PRELISTA: {
    cabecera: ['Partido ID', 'Fecha partido', 'Rival', 'Jugador ID', 'Jugador', 'Dice', 'Cuándo'],
    anchos: [130, 110, 220, 130, 220, 90, 150],
  },
};

/* ───────────────────────── Menú ───────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐾 Black Panthers')
    .addItem('Preparar hoja (primera vez)', 'prepararHoja')
    .addItem('Actualizar jugadores desde CopaFácil', 'actualizarJugadores')
    .addItem('🔒 Cambiar PIN (solo el propietario)', 'cambiarPinDesdeMenu')
    .addItem('Cargar la normativa interna', 'cargarNormativaInterna')
    .addItem('Activar la subida de fotos', 'activarFotos')
    .addToUi();
}

/* ───────────────────────── Web: lectura ───────────────────────── */

/**
 * Lectura abierta: solo funciona mientras no haya PIN del equipo.
 * En cuanto se pone uno, la web pide los datos por POST con ese PIN.
 */
function doGet() {
  if (pinesGuardados_().equipo) return json_({ ok: false, error: 'pin_equipo' });
  return json_(publico_());
}

function publico_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('publico');
  if (guardado) return JSON.parse(guardado);

  const datos = datosPublicos_();
  try {
    cache.put('publico', JSON.stringify(datos), CACHE_SEGUNDOS);
  } catch (e) {
    // Si no cabe en caché (más de 100 KB) simplemente no se guarda.
  }
  return datos;
}

function datosPublicos_() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const fecha = (v) => (v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : texto_(v));
  const hora = (v) => (v instanceof Date ? Utilities.formatDate(v, tz, 'HH:mm') : texto_(v));
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const jugadores = filas_(HOJAS.JUGADORES).filter((f) => f['Nombre']);
  const idPorNombre = {};
  jugadores.forEach((f) => (idPorNombre[normaliza_(f['Nombre'])] = texto_(f['ID CopaFácil'])));

  const ajustes = leerAjustes_();

  // Mensajes: el más reciente de cada tipo marcado para mostrar.
  const mensajes = { motivador: null, tecnico: null };
  filas_(HOJAS.MENSAJES)
    .filter((f) => f['Mostrar'] === true && f['Texto'])
    .map((f, i) => ({ f, i, t: f['Fecha'] instanceof Date ? f['Fecha'].getTime() : 0 }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .forEach(({ f }) => {
      const tipo = normaliza_(f['Tipo']).indexOf('tecnico') >= 0 ? 'tecnico' : 'motivador';
      mensajes[tipo] = { texto: texto_(f['Texto']), firma: texto_(f['Firma']), fecha: fecha(f['Fecha']) };
    });

  // Entrenos: asistencia de los ya hechos + el próximo.
  const entrenos = { sesiones: 0, porJugador: {}, lista: [], proximo: null };
  const futuros = [];
  const hojaEntrenos = ss.getSheetByName(HOJAS.ENTRENOS);
  if (hojaEntrenos && hojaEntrenos.getLastRow() > 1) {
    const valores = hojaEntrenos.getDataRange().getValues();
    const cab = valores[0].map(texto_);
    const cMostrar = cab.indexOf('Mostrar');
    const cHora = cab.indexOf('Hora');
    const cLugar = cab.indexOf('Lugar');
    valores.slice(1).forEach((fila) => {
      if (!(fila[0] instanceof Date) || fila[cMostrar] !== true) return;
      const dia = fecha(fila[0]);
      const h = hora(fila[cHora]);
      if (dia >= hoy) futuros.push({ fecha: dia, hora: h, lugar: texto_(fila[cLugar]) });

      // Solo cuenta como sesión si se ha pasado lista (al menos un jugador marcado).
      const jugadoresCols = cab.map((n, c) => ({ n, c })).filter((x) => x.c > cMostrar && x.n);
      if (dia > hoy || !jugadoresCols.some((x) => fila[x.c] === true)) return;
      entrenos.sesiones++;
      const asistentes = [];
      jugadoresCols.forEach(({ n, c }) => {
        const id = idPorNombre[normaliza_(n)];
        if (!id) return;
        entrenos.porJugador[id] = (entrenos.porJugador[id] || 0) + (fila[c] === true ? 1 : 0);
        if (fila[c] === true) asistentes.push(id);
      });
      entrenos.lista.push({ fecha: dia, asistentes: asistentes });
    });
  }
  entrenos.proximo = proximoEntreno_(futuros, ajustes, tz);

  const ahoraTexto = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const anuncios = filas_(HOJAS.ANUNCIOS)
    .filter((f) => f['Mostrar'] === true && (f['Título'] || f['Texto']))
    .filter((f) => !(f['Caduca'] instanceof Date) || fecha(f['Caduca']) >= ahoraTexto)
    .map((f) => ({
      fecha: fecha(f['Fecha']),
      titulo: texto_(f['Título']),
      texto: texto_(f['Texto']),
      importante: f['Importante'] === true,
      caduca: fecha(f['Caduca']),
    }))
    .sort((a, b) => (b.importante - a.importante) || (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));

  return {
    ok: true,
    generado: new Date().toISOString(),
    anuncios: anuncios,
    mensajes: mensajes,
    mejorar: valoraciones_(HOJAS.MEJORAR, 'Aspecto', idPorNombre),
    fuertes: valoraciones_(HOJAS.FUERTES, 'Punto fuerte', idPorNombre),
    comentarios: filas_(HOJAS.COMENTARIOS)
      .filter((f) => f['Mostrar'] === true && f['Comentario'] && Number(f['Jornada']) > 0)
      .map((f) => {
        const para = normaliza_(f['Para']);
        const equipo = !para || para === 'todo el equipo' || para === 'equipo';
        return {
          jornada: Number(f['Jornada']),
          jugadorId: equipo ? null : idPorNombre[para] || null,
          nombre: equipo ? '' : texto_(f['Para']),
          texto: texto_(f['Comentario']),
          firma: texto_(f['Firma']),
        };
      }),
    normativa: filas_(HOJAS.NORMATIVA)
      .filter((f) => f['Mostrar'] === true && f['Norma'])
      .map((f) => ({ norma: texto_(f['Norma']), detalle: texto_(f['Detalle']) })),
    jugadores: jugadores.map((f) => ({
      id: texto_(f['ID CopaFácil']),
      nombre: texto_(f['Nombre']),
      apodo: texto_(f['Apodo']),
      dorsal: /^\d+$/.test(texto_(f['Dorsal'])) ? Number(f['Dorsal']) : null,
      activo: f['Activo'] !== false,
      nombreCorto: texto_(f['Nombre corto']),
      roles: texto_(f['Roles']).split(',').map((r) => r.trim()).filter(String),
      cuotas: Math.max(0, Math.round(Number(f['Cuotas pendientes']) || 0)),
      multas: Math.max(0, Math.round(Number(f['Multas pendientes']) || 0)),
      cumple: f['Mostrar cumpleaños'] === true && f['Cumpleaños'] instanceof Date
        ? Utilities.formatDate(f['Cumpleaños'], tz, 'MM-dd')
        : null,
    })),
    lesiones: filas_(HOJAS.LESIONES)
      .filter((f) => f['Mostrar'] === true && f['Jugador'] && normaliza_(f['Estado']) !== 'recuperado')
      .map((f) => ({
        id: idPorNombre[normaliza_(f['Jugador'])] || null,
        nombre: texto_(f['Jugador']),
        estado: normaliza_(f['Estado']) === 'duda' ? 'duda' : 'baja',
        detalle: f['Mostrar detalle'] === true ? texto_(f['Detalle']) : '',
        vuelta: f['Mostrar detalle'] === true ? fecha(f['Vuelta prevista']) : '',
      })),
    entrenos: entrenos,
    quedadas: filas_(HOJAS.QUEDADAS)
      .filter((f) => f['Mostrar'] === true && f['Plan'])
      .map((f) => ({
        fecha: fecha(f['Fecha']),
        hora: hora(f['Hora']),
        plan: texto_(f['Plan']),
        lugar: texto_(f['Lugar']),
        organiza: texto_(f['Organiza']),
        enlace: texto_(f['Enlace']),
      })),
    fotos: filas_(HOJAS.FOTOS)
      .filter((f) => f['Mostrar'] === true && f['Enlace foto'])
      .map((f) => ({ fecha: fecha(f['Fecha']), titulo: texto_(f['Título']), url: texto_(f['Enlace foto']) })),
    ajustesEntreno: {
      dias: texto_(ajustes['Días de entreno']),
      hora: hora(ajustes['Hora de entreno']),
      lugar: texto_(ajustes['Lugar de entreno']),
    },
    cuerpoTecnico: {
      segundo: texto_(ajustes['Segundo entrenador']),
      tercero: texto_(ajustes['Tercer entrenador']),
      cuarto: texto_(ajustes['Cuarto entrenador']),
    },
    convocatorias: leerConvocatorias_(),
    votos: leerVotos_(),
    mvp: leerMvp_(),
    estrategia: leerEstrategia_(),
    prelista: leerPrelista_(),
  };
}

/** Aspectos a mejorar o puntos fuertes: del equipo (Para vacío) o de un jugador. */
function valoraciones_(hoja, campo, idPorNombre) {
  return filas_(hoja)
    .filter((f) => f['Mostrar'] === true && f[campo])
    .map((f) => {
      const para = normaliza_(f['Para']);
      const equipo = !para || para === 'todo el equipo' || para === 'equipo';
      return {
        para: texto_(f['Para']),
        jugadorId: equipo ? null : idPorNombre[para] || null,
        nombre: equipo ? '' : texto_(f['Para']),
        aspecto: texto_(f[campo]),
        detalle: texto_(f['Detalle']),
      };
    });
}

/**
 * Próximo entreno: el primer entreno apuntado en ENTRENOS que aún no ha pasado;
 * si no hay ninguno, el siguiente según el horario habitual de AJUSTES.
 */
function proximoEntreno_(futuros, ajustes, tz) {
  const ahora = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  const clave = (e) => e.fecha + ' ' + (e.hora || '23:59');
  const pendientes = futuros.filter((e) => clave(e) >= ahora).sort((a, b) => (clave(a) < clave(b) ? -1 : 1));

  const horaHabitual = ajustes['Hora de entreno'] instanceof Date
    ? Utilities.formatDate(ajustes['Hora de entreno'], tz, 'HH:mm')
    : texto_(ajustes['Hora de entreno']);
  const lugarHabitual = texto_(ajustes['Lugar de entreno']);

  if (pendientes.length) {
    const e = pendientes[0];
    return { fecha: e.fecha, hora: e.hora || horaHabitual, lugar: e.lugar || lugarHabitual, habitual: false };
  }

  const nombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const dias = normaliza_(ajustes['Días de entreno'])
    .split(/[^a-z]+/)
    .map((d) => nombres.indexOf(d) + 1)
    .filter((n) => n > 0);
  if (!dias.length) return null;

  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const diaSemana = Number(Utilities.formatDate(d, tz, 'u')); // 1 = lunes … 7 = domingo
    const candidato = { fecha: Utilities.formatDate(d, tz, 'yyyy-MM-dd'), hora: horaHabitual };
    if (dias.indexOf(diaSemana) >= 0 && clave(candidato) >= ahora) {
      return { fecha: candidato.fecha, hora: horaHabitual, lugar: lugarHabitual, habitual: true };
    }
  }
  return null;
}

function leerConvocatorias_() {
  const res = {};
  filas_(HOJAS.CONVOCATORIAS).forEach((f) => {
    const partido = texto_(f['Partido ID']);
    const jugador = texto_(f['Jugador ID']);
    if (!partido || !jugador) return;
    const c = (res[partido] = res[partido] || { convocados: [], noVienen: [], noConvocados: [], actualizado: '' });
    const estado = normaliza_(f['Estado']);
    (estado === 'convocado' ? c.convocados : estado === 'no viene' ? c.noVienen : c.noConvocados).push(jugador);
    if (f['Actualizado'] instanceof Date) c.actualizado = f['Actualizado'].toISOString();
  });
  return res;
}

/** Votaciones al MVP: por partido, estrellas de cada jugador y quién ha votado ya. */
function leerVotos_() {
  const res = {};
  filas_(HOJAS.VOTOS).forEach((f) => {
    const partido = texto_(f['Partido ID']);
    const votante = texto_(f['Votante ID']);
    const votado = texto_(f['Votado ID']);
    const estrellas = Math.min(3, Math.max(0, Math.round(Number(f['Estrellas']) || 0)));
    if (!partido || !votante || !votado || !estrellas) return;
    const v = (res[partido] = res[partido] || { totales: {}, veces: {}, votantes: [] });
    v.totales[votado] = (v.totales[votado] || 0) + estrellas;
    v.veces[votado] = (v.veces[votado] || 0) + 1; // cuántos le han votado, para la nota
    if (v.votantes.indexOf(votante) < 0) v.votantes.push(votante);
  });
  return res;
}

/** MVP designado a mano por el cuerpo técnico: partido → jugador. */
function leerMvp_() {
  const res = {};
  filas_(HOJAS.MVP).forEach((f) => {
    const partido = texto_(f['Partido ID']);
    const jugador = texto_(f['Jugador ID']);
    if (partido && jugador) res[partido] = jugador;
  });
  return res;
}

/** La pizarra de cada partido: dónde va cada jugador y las flechas. */
function leerEstrategia_() {
  const res = {};
  filas_(HOJAS.ESTRATEGIA).forEach((f) => {
    const partido = texto_(f['Partido ID']);
    const tipo = normaliza_(f['Tipo']);
    if (!partido) return;
    const e = (res[partido] = res[partido] || { jugadores: [], flechas: [] });
    const x = Number(f['X']) || 0;
    const y = Number(f['Y']) || 0;
    if (tipo === 'jugador') {
      const id = texto_(f['Jugador ID']);
      if (id) e.jugadores.push({ id: id, x: x, y: y });
    } else if (tipo === 'ataque' || tipo === 'defensa') {
      e.flechas.push({ tipo: tipo, x: x, y: y, x2: Number(f['X2']) || 0, y2: Number(f['Y2']) || 0 });
    }
  });
  return res;
}

/** Prelista: quién ha dicho que va a cada partido, por orden de apuntarse. */
function leerPrelista_() {
  const res = {};
  filas_(HOJAS.PRELISTA).forEach((f) => {
    const partido = texto_(f['Partido ID']);
    const jugador = texto_(f['Jugador ID']);
    if (!partido || !jugador) return;
    const dice = normaliza_(f['Dice']) === 'no' ? 'no' : 'voy';
    const cuando = f['Cuándo'] instanceof Date ? f['Cuándo'].getTime() : 0;
    (res[partido] = res[partido] || []).push({ id: jugador, dice: dice, cuando: cuando });
  });
  Object.keys(res).forEach((k) => res[k].sort((a, b) => a.cuando - b.cuando));
  return res;
}

/* ───────────────────────── Web: escritura (staff) ───────────────────────── */

function doPost(e) {
  let peticion;
  try {
    peticion = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'peticion_invalida' });
  }

  // Los datos: hace falta el PIN del equipo (o el de cualquiera del cuerpo técnico).
  if (peticion.accion === 'datos') {
    if (!puedeVer_(peticion.pinEquipo)) return json_({ ok: false, error: 'pin_equipo' });
    return json_(publico_());
  }

  // Apuntar la entrada de un jugador: solo hace falta el PIN del equipo.
  if (peticion.accion === 'entrada') {
    if (!puedeVer_(peticion.pinEquipo)) return json_({ ok: false, error: 'pin_equipo' });
    return json_(registrarEntrada_(peticion));
  }

  // Apuntarse (o borrarse) de la prelista del próximo partido: cosa de cada jugador.
  if (peticion.accion === 'apuntarse') {
    if (!puedeVer_(peticion.pinEquipo)) return json_({ ok: false, error: 'pin_equipo' });
    const cerrojo = LockService.getScriptLock();
    cerrojo.waitLock(20000);
    let hecho;
    try {
      hecho = guardarPrelista_(peticion);
    } finally {
      cerrojo.releaseLock();
    }
    CacheService.getScriptCache().remove('publico');
    return json_(hecho);
  }

  // Votar al MVP es cosa de los jugadores: les basta el PIN del equipo.
  if (peticion.accion === 'votar') {
    if (!puedeVer_(peticion.pinEquipo)) return json_({ ok: false, error: 'pin_equipo' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let resultado;
    try {
      resultado = guardarVoto_(peticion);
    } finally {
      lock.releaseLock();
    }
    CacheService.getScriptCache().remove('publico');
    return json_(resultado);
  }

  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('fallos_pin') || 0);
  if (fallos >= MAX_FALLOS_PIN) return json_({ ok: false, error: 'bloqueado' });

  const nivel = nivelPin_(peticion.pin);
  if (!nivel) {
    cache.put('fallos_pin', String(fallos + 1), 15 * 60);
    return json_({ ok: false, error: 'pin' });
  }

  if (peticion.accion === 'comprobarPin') return json_({ ok: true, nivel: nivel });

  const accion = ACCIONES[peticion.accion];
  if (!accion) return json_({ ok: false, error: 'accion_desconocida' });
  // El administrador puede todo; el míster y el tesorero, solo lo suyo.
  if (nivel !== 'admin' && (PERMISOS[peticion.accion] || []).indexOf(nivel) < 0) {
    return json_({ ok: false, error: 'sin_permiso' });
  }
  // El míster puede escribir las instrucciones, pero no la frase motivadora.
  if (peticion.accion === 'mensaje' && nivel === 'staff' && normaliza_(peticion.tipo).indexOf('tecnico') < 0) {
    return json_({ ok: false, error: 'sin_permiso' });
  }
  // Cada uno solo cambia su propio PIN; el administrador, los tres.
  if (peticion.accion === 'cambiarPin' && nivel !== 'admin' && texto_(peticion.cual) !== nivel) {
    return json_({ ok: false, error: 'sin_permiso' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let resultado;
  try {
    resultado = accion(peticion);
  } finally {
    lock.releaseLock();
  }
  cache.remove('publico');
  return json_(resultado);
}

// Qué puede hacer cada PIN. Lo que no está aquí es solo del administrador.
const PERMISOS = {
  convocar: ['staff'],   // el míster
  comentar: ['staff'],
  mensaje: ['staff'],    // solo el mensaje del cuerpo técnico (se comprueba en doPost)
  tesoreria: ['tesoreria'], // el tesorero
  estrategia: ['staff'],    // la pizarra es del cuerpo técnico
  mvp: ['staff'],
  entradas: ['staff'], // quién entra en la web: solo el cuerpo técnico y tú
  cambiarPin: ['staff', 'tesoreria'], // cada uno solo el suyo (se comprueba en doPost)
};

const ACCIONES = {
  mensaje: guardarMensaje_,
  convocar: guardarConvocatoria_,
  entreno: guardarEntreno_,
  comentar: guardarComentarios_,
  jugador: guardarJugador_,
  tesoreria: guardarTesoreria_,
  roles: guardarRoles_,
  lista: guardarLista_,
  ajustes: guardarAjustes_,
  cumples: guardarCumples_,
  cambiarPin: cambiarPin_,
  subirFoto: subirFoto_,
  pines: verPines_,
  entradas: resumenEntradas_,
  mvp: guardarMvp_,
  estrategia: guardarEstrategia_,
};

/** ID de CopaFácil → nombre (columna Nombre de JUGADORES). Trae fichajes nuevos si hace falta. */
function nombresPorId_(idsNecesarios) {
  const leer = () => {
    const res = {};
    filas_(HOJAS.JUGADORES).forEach((f) => (res[texto_(f['ID CopaFácil'])] = texto_(f['Nombre'])));
    return res;
  };
  let nombres = leer();
  if ((idsNecesarios || []).some((id) => !nombres[id])) {
    try {
      actualizarJugadores();
      nombres = leer();
    } catch (e) {
      // Si CopaFácil no responde se usan solo los jugadores conocidos.
    }
  }
  return nombres;
}

function guardarConvocatoria_(p) {
  const partido = texto_(p.partidoId);
  const lista = Array.isArray(p.jugadores) ? p.jugadores : [];
  if (!/^\d{5,20}$/.test(partido) || lista.length === 0 || lista.length > 80) {
    return { ok: false, error: 'datos_invalidos' };
  }

  // Los nombres se sacan de la hoja, no de lo que envía el navegador.
  const nombres = nombresPorId_(lista.map((j) => texto_(j && j.id)));

  const ahora = new Date();
  const nuevas = [];
  for (const j of lista) {
    const id = texto_(j && j.id);
    if (!/^\d{5,20}$/.test(id) || !nombres[id]) continue;
    const estado = ESTADOS[j.estado] || (j.convocado === true ? ESTADOS.convocado : ESTADOS.no_convocado);
    nuevas.push([partido, limpia_(p.fecha).slice(0, 10), limpia_(p.rival), id, nombres[id], estado, ahora]);
  }
  if (nuevas.length === 0) return { ok: false, error: 'datos_invalidos' };

  const hoja = asegurarHoja_(HOJAS.CONVOCATORIAS);
  const ultima = hoja.getLastRow();
  if (ultima > 1) {
    // Borra de abajo arriba las filas antiguas de este partido.
    const ids = hoja.getRange(2, 1, ultima - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (texto_(ids[i][0]) === partido) hoja.deleteRow(i + 2);
    }
  }
  const inicio = hoja.getLastRow() + 1;
  hoja.getRange(inicio, 1, nuevas.length, nuevas[0].length).setValues(nuevas);
  hoja.getRange(inicio, 6, nuevas.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.values(ESTADOS), true).build()
  );
  hoja.getRange(inicio, 7, nuevas.length, 1).setNumberFormat('dd/mm/yyyy HH:mm');
  return { ok: true, guardados: nuevas.length };
}

/** Frase motivadora o mensaje del cuerpo técnico: se añade como el más reciente de su tipo. */
function guardarMensaje_(p) {
  const tipo = normaliza_(p.tipo).indexOf('tecnico') >= 0 ? 'Cuerpo técnico' : 'Motivador';
  const texto = limpiaLargo_(p.texto).slice(0, tipo === 'Motivador' ? 200 : 2000);
  if (!texto) return { ok: false, error: 'datos_invalidos' };
  const hoja = asegurarHoja_(HOJAS.MENSAJES);
  const fila = ultimaFilaCon_(hoja, 3) + 1; // columna Texto
  hoja.getRange(fila, 1, 1, 5).setValues([[new Date(), tipo, texto, limpia_(p.firma).slice(0, 60), true]]);
  casillas_(hoja.getRange(fila, 5));
  return { ok: true };
}

/*
 * Listas sencillas de la web (anuncios, aspectos a mejorar, normativa, quedadas y fotos).
 * Sustituye las filas visibles por las que llegan; las filas con "Mostrar" sin marcar no se tocan.
 */
const LISTAS = {
  anuncios: { hoja: 'ANUNCIOS', campos: ['fecha:Fecha', 'titulo:Título', 'texto:Texto', 'importante:Importante', 'caduca:Caduca'] },
  mejorar: { hoja: 'MEJORAR', campos: ['para:Para', 'aspecto:Aspecto', 'detalle:Detalle'] },
  fuertes: { hoja: 'FUERTES', campos: ['para:Para', 'aspecto:Punto fuerte', 'detalle:Detalle'] },
  normativa: { hoja: 'NORMATIVA', campos: ['norma:Norma', 'detalle:Detalle'] },
  quedadas: { hoja: 'QUEDADAS', campos: ['fecha:Fecha', 'hora:Hora', 'plan:Plan', 'lugar:Lugar', 'organiza:Organiza', 'enlace:Enlace'] },
  fotos: { hoja: 'FOTOS', campos: ['fecha:Fecha', 'titulo:Título', 'url:Enlace foto'] },
};

function guardarLista_(p) {
  const def = LISTAS[texto_(p.tipo)];
  const filas = Array.isArray(p.filas) ? p.filas.slice(0, 200) : [];
  if (!def) return { ok: false, error: 'datos_invalidos' };
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const hoja = asegurarHoja_(def.hoja);
  const cab = ESTRUCTURA[def.hoja].cabecera;
  const cMostrar = cab.indexOf('Mostrar');

  // Fuera las filas visibles de antes (de abajo arriba); las ocultas se quedan.
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 1) {
    const valores = hoja.getRange(2, 1, ultima - 1, cab.length).getValues();
    for (let i = valores.length - 1; i >= 0; i--) {
      if (valores[i][cMostrar] === true) hoja.deleteRow(i + 2);
    }
  }

  const nuevas = filas.map((f) => {
    const fila = cab.map(() => '');
    def.campos.forEach((par) => {
      const clave = par.split(':')[0];
      const columna = cab.indexOf(par.split(':')[1]);
      const valor = f[clave];
      if (columna < 0 || valor === undefined || valor === '') return;
      if (/^\d{4}-\d{2}-\d{2}$/.test(texto_(valor))) fila[columna] = Utilities.parseDate(texto_(valor), tz, 'yyyy-MM-dd');
      else if (valor === true || valor === false) fila[columna] = valor;
      else fila[columna] = limpiaLargo_(valor).slice(0, 600);
    });
    fila[cMostrar] = true;
    return fila;
  }).filter((fila) => fila.some((v, i) => i !== cMostrar && texto_(v)));

  if (nuevas.length) {
    const inicio = ultimaFilaCon_(hoja, 1) + 1;
    hoja.getRange(inicio, 1, nuevas.length, cab.length).setValues(nuevas);
    formatearColumnas_();
  }
  return { ok: true, guardados: nuevas.length };
}

/** Horario habitual de entreno (pestaña AJUSTES). */
function guardarAjustes_(p) {
  if (p.dias !== undefined) escribirAjuste_('Días de entreno', limpia_(p.dias).slice(0, 60));
  if (p.hora !== undefined) escribirAjuste_('Hora de entreno', limpia_(p.hora).slice(0, 10));
  if (p.lugar !== undefined) escribirAjuste_('Lugar de entreno', limpia_(p.lugar).slice(0, 60));
  return { ok: true };
}

/** Cumpleaños de varios jugadores a la vez. */
function guardarCumples_(p) {
  const lista = Array.isArray(p.jugadores) ? p.jugadores.slice(0, 80) : [];
  if (!lista.length) return { ok: false, error: 'datos_invalidos' };
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima < 2) return { ok: false, error: 'sin_jugadores' };
  const datos = hoja.getRange(2, 1, ultima - 1, cab.length).getValues();
  const filaPorId = {};
  datos.forEach((f, i) => (filaPorId[texto_(f[0])] = i));
  let cambiados = 0;
  lista.forEach((j) => {
    const i = filaPorId[texto_(j && j.id)];
    if (i === undefined) return;
    const fecha = texto_(j.cumple);
    datos[i][cab.indexOf('Cumpleaños')] = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? Utilities.parseDate(fecha, tz, 'yyyy-MM-dd') : '';
    datos[i][cab.indexOf('Mostrar cumpleaños')] = j.mostrar === true;
    cambiados++;
  });
  hoja.getRange(2, 1, datos.length, cab.length).setValues(datos);
  casillas_(hoja.getRange(2, cab.indexOf('Mostrar cumpleaños') + 1, datos.length, 1));
  return { ok: true, guardados: cambiados };
}

/**
 * Voto al MVP de un partido: de 1 a 3 estrellas a los compañeros que jugaron.
 * Cada jugador tiene un único voto por partido: si vuelve a votar, se sustituye el anterior.
 * Se cierra dos días después del partido.
 */
function guardarVoto_(p) {
  const partido = texto_(p.partidoId);
  const votante = texto_(p.votanteId);
  const lista = Array.isArray(p.votos) ? p.votos.slice(0, 40) : [];
  if (!/^\d{5,20}$/.test(partido) || !/^\d{5,20}$/.test(votante)) return { ok: false, error: 'datos_invalidos' };

  // La votación se cierra dos días después del partido.
  const fecha = texto_(p.fecha);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    const limite = new Date(Utilities.parseDate(fecha, tz, 'yyyy-MM-dd').getTime() + 3 * 86400000);
    if (new Date() >= limite) return { ok: false, error: 'votacion_cerrada' };
  }

  const nombres = {};
  filas_(HOJAS.JUGADORES).forEach((f) => (nombres[texto_(f['ID CopaFácil'])] = texto_(f['Nombre'])));
  if (!nombres[votante]) return { ok: false, error: 'jugador_desconocido' };

  const ahora = new Date();
  const nuevas = [];
  lista.forEach((v) => {
    const id = texto_(v && v.id);
    const estrellas = Math.round(Number(v && v.estrellas) || 0);
    if (id === votante || !nombres[id] || estrellas < 1 || estrellas > 3) return;
    if (nuevas.some((f) => f[3] === id)) return; // una vez por jugador
    nuevas.push([partido, votante, nombres[votante], id, nombres[id], estrellas, ahora]);
  });

  const hoja = asegurarHoja_(HOJAS.VOTOS);
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 1) {
    const v = hoja.getRange(2, 1, ultima - 1, 2).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (texto_(v[i][0]) === partido && texto_(v[i][1]) === votante) hoja.deleteRow(i + 2);
    }
  }
  if (nuevas.length) {
    const inicio = ultimaFilaCon_(hoja, 1) + 1;
    hoja.getRange(inicio, 1, nuevas.length, 7).setValues(nuevas);
    hoja.getRange(inicio, 7, nuevas.length, 1).setNumberFormat('dd/mm/yyyy HH:mm');
  }
  return { ok: true, guardados: nuevas.length };
}

/** MVP designado a mano (para partidos sin votación). Sin jugador, se quita. */
function guardarMvp_(p) {
  const partido = texto_(p.partidoId);
  if (!/^\d{5,20}$/.test(partido)) return { ok: false, error: 'datos_invalidos' };
  const hoja = asegurarHoja_(HOJAS.MVP);
  borrarFilasDe_(hoja, partido);
  const id = texto_(p.jugadorId);
  if (!id) return { ok: true, guardados: 0 };
  const nombres = nombresPorId_([id]);
  if (!nombres[id]) return { ok: false, error: 'jugador_desconocido' };
  hoja.appendRow([partido, texto_(p.jornada), texto_(p.rival), id, nombres[id], new Date()]);
  hoja.getRange(hoja.getLastRow(), 6).setNumberFormat('dd/mm/yyyy HH:mm');
  return { ok: true, guardados: 1 };
}

/** La pizarra de un partido: posiciones de los jugadores y flechas. */
function guardarEstrategia_(p) {
  const partido = texto_(p.partidoId);
  if (!/^\d{5,20}$/.test(partido)) return { ok: false, error: 'datos_invalidos' };
  const jugadores = Array.isArray(p.jugadores) ? p.jugadores.slice(0, 30) : [];
  const flechas = Array.isArray(p.flechas) ? p.flechas.slice(0, 60) : [];
  const nombres = nombresPorId_(jugadores.map(function (j) { return texto_(j && j.id); }));

  const ahora = new Date();
  const filas = [];
  const pc = function (v) { return Math.max(0, Math.min(100, Math.round(Number(v) || 0))); };
  jugadores.forEach(function (j) {
    const id = texto_(j && j.id);
    if (!id || !nombres[id]) return;
    if (filas.some(function (f) { return f[2] === id; })) return;
    filas.push([partido, 'jugador', id, nombres[id], pc(j.x), pc(j.y), '', '', ahora]);
  });
  flechas.forEach(function (f) {
    const tipo = normaliza_(f && f.tipo) === 'defensa' ? 'defensa' : 'ataque';
    filas.push([partido, tipo, '', '', pc(f.x), pc(f.y), pc(f.x2), pc(f.y2), ahora]);
  });

  const hoja = asegurarHoja_(HOJAS.ESTRATEGIA);
  borrarFilasDe_(hoja, partido);
  if (filas.length) {
    const inicio = ultimaFilaCon_(hoja, 1) + 1;
    hoja.getRange(inicio, 1, filas.length, 9).setValues(filas);
    hoja.getRange(inicio, 9, filas.length, 1).setNumberFormat('dd/mm/yyyy HH:mm');
  }
  return { ok: true, guardados: filas.length };
}

/** Borra las filas de un partido (columna A) de arriba a abajo. */
function borrarFilasDe_(hoja, partido) {
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima < 2) return;
  const v = hoja.getRange(2, 1, ultima - 1, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (texto_(v[i][0]) === partido) hoja.deleteRow(i + 2);
  }
}

/**
 * Guarda en Drive una foto subida desde la web y devuelve su enlace.
 * Van todas a una carpeta del equipo, compartidas con «cualquiera con el enlace».
 */
function subirFoto_(p) {
  const datos = texto_(p.datos);
  const corte = datos.indexOf('base64,');
  const tipo = (datos.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/) || [])[1];
  if (!tipo || corte < 0) return { ok: false, error: 'imagen_no_valida' };
  const base64 = datos.slice(corte + 7);
  if (base64.length > 12 * 1024 * 1024) return { ok: false, error: 'imagen_grande' };

  const limpio = texto_(p.nombre).replace(/[^\w .\-]+/g, '').slice(0, 80) || 'foto.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), tipo, limpio);
  const fichero = carpetaFotos_().createFile(blob);
  fichero.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/thumbnail?id=' + fichero.getId() + '&sz=w1200' };
}

/** La carpeta de Drive donde van las fotos de la web. Se crea la primera vez. */
function carpetaFotos_() {
  const props = PropertiesService.getScriptProperties();
  const id = texto_(props.getProperty('CARPETA_FOTOS'));
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // La carpeta ya no existe: se crea otra.
    }
  }
  const carpeta = DriveApp.createFolder('Black Panthers — fotos de la web');
  props.setProperty('CARPETA_FOTOS', carpeta.getId());
  return carpeta;
}

/** Desde el menú: pide el permiso de Drive y deja la carpeta lista. */
function activarFotos() {
  const carpeta = carpetaFotos_();
  SpreadsheetApp.getUi().alert(
    'Fotos activadas ✅',
    'Las fotos que subas desde la web se guardarán en tu Drive, en la carpeta «' + carpeta.getName() + '».',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Apunta que un jugador ha abierto la web. Como mucho una vez cada media hora
 * por jugador, para no llenar la hoja de filas.
 */
function registrarEntrada_(p) {
  const id = texto_(p.jugadorId);
  if (!/^\d{5,20}$/.test(id)) return { ok: false, error: 'datos_invalidos' };
  const nombres = {};
  filas_(HOJAS.JUGADORES).forEach((f) => (nombres[texto_(f['ID CopaFácil'])] = texto_(f['Nombre'])));
  if (!nombres[id]) return { ok: false, error: 'jugador_desconocido' };

  const cache = CacheService.getScriptCache();
  if (cache.get('entrada_' + id)) return { ok: true, repetida: true };
  cache.put('entrada_' + id, '1', 30 * 60);

  const hoja = asegurarHoja_(HOJAS.ENTRADAS);
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 5000) hoja.deleteRows(2, 1000); // la hoja no crece sin fin
  hoja.appendRow([id, nombres[id], new Date()]);
  hoja.getRange(hoja.getLastRow(), 3).setNumberFormat('dd/mm/yyyy HH:mm');
  return { ok: true };
}

/** Para el cuerpo técnico: cuántas veces ha entrado cada jugador y cuándo fue la última. */
function resumenEntradas_() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const hace7 = Date.now() - 7 * 86400000;
  const cuenta = {};
  filas_(HOJAS.ENTRADAS).forEach((f) => {
    const id = texto_(f['Jugador ID']);
    const cuando = f['Cuándo'] instanceof Date ? f['Cuándo'].getTime() : 0;
    if (!id) return;
    const c = (cuenta[id] = cuenta[id] || { total: 0, semana: 0, ultima: 0 });
    c.total++;
    if (cuando >= hace7) c.semana++;
    if (cuando > c.ultima) c.ultima = cuando;
  });
  const jugadores = filas_(HOJAS.JUGADORES)
    .filter((f) => f['Nombre'])
    .map((f) => {
      const id = texto_(f['ID CopaFácil']);
      const c = cuenta[id] || { total: 0, semana: 0, ultima: 0 };
      return {
        id: id,
        nombre: texto_(f['Nombre']),
        activo: f['Activo'] !== false,
        total: c.total,
        semana: c.semana,
        ultima: c.ultima ? Utilities.formatDate(new Date(c.ultima), tz, 'yyyy-MM-dd HH:mm') : '',
      };
    });
  return { ok: true, jugadores: jugadores };
}

/** Prelista: un jugador dice si va o no al próximo partido. Solo toca su propia fila. */
function guardarPrelista_(p) {
  const partido = texto_(p.partidoId);
  const id = texto_(p.jugadorId);
  if (!/^\d{5,20}$/.test(partido) || !/^\d{5,20}$/.test(id)) return { ok: false, error: 'datos_invalidos' };
  const nombres = {};
  filas_(HOJAS.JUGADORES).forEach((f) => (nombres[texto_(f['ID CopaFácil'])] = texto_(f['Nombre'])));
  if (!nombres[id]) return { ok: false, error: 'jugador_desconocido' };
  const dice = normaliza_(p.dice) === 'no' ? 'No' : 'Voy';

  const hoja = asegurarHoja_(HOJAS.PRELISTA);
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 1) {
    const v = hoja.getRange(2, 1, ultima - 1, 4).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (texto_(v[i][0]) === partido && texto_(v[i][3]) === id) hoja.deleteRow(i + 2);
    }
  }
  if (normaliza_(p.dice) !== 'quitar') {
    hoja.appendRow([partido, texto_(p.fecha), texto_(p.rival), id, nombres[id], dice, new Date()]);
    hoja.getRange(hoja.getLastRow(), 7).setNumberFormat('dd/mm/yyyy HH:mm');
  }
  return { ok: true, dice: dice };
}

/** Pasar lista de un entreno: crea o actualiza la fila de esa fecha en ENTRENOS. */
function guardarEntreno_(p) {
  const fecha = texto_(p.fecha);
  const lista = Array.isArray(p.jugadores) ? p.jugadores : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || lista.length === 0 || lista.length > 80) {
    return { ok: false, error: 'datos_invalidos' };
  }
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const nombres = nombresPorId_(lista.map((j) => texto_(j && j.id)));
  const hoja = asegurarHoja_(HOJAS.ENTRENOS);

  // Columnas de los jugadores que falten.
  let cab = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0].map(texto_);
  const faltan = [];
  lista.forEach((j) => {
    const n = nombres[texto_(j && j.id)];
    if (n && cab.indexOf(n) < 0 && faltan.indexOf(n) < 0) faltan.push(n);
  });
  if (faltan.length) prepararEntrenos_(faltan);
  cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(texto_);

  // Fila de esa fecha (o una nueva al final).
  const ultima = ultimaFilaCon_(hoja, 1);
  const fechas = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, 1).getValues() : [];
  let fila = -1;
  fechas.forEach((f, i) => {
    if (f[0] instanceof Date && Utilities.formatDate(f[0], tz, 'yyyy-MM-dd') === fecha) fila = i + 2;
  });
  const nueva = fila < 0;
  if (nueva) fila = ultima + 1;

  const valores = hoja.getRange(fila, 1, 1, cab.length).getValues()[0];
  if (nueva) valores[0] = Utilities.parseDate(fecha, tz, 'yyyy-MM-dd');
  valores[cab.indexOf('Mostrar')] = true;
  let marcados = 0;
  lista.forEach((j) => {
    const nombre = nombres[texto_(j && j.id)];
    const c = nombre ? cab.indexOf(nombre) : -1;
    if (c < 0) return;
    valores[c] = j.asistio === true;
    if (j.asistio === true) marcados++;
  });
  hoja.getRange(fila, 1, 1, cab.length).setValues([valores]);
  return { ok: true, fecha: fecha, asistentes: marcados };
}

/** Comentarios del cuerpo técnico de una jornada: sustituye los visibles de esa jornada. */
function guardarComentarios_(p) {
  const jornada = Number(p.jornada);
  if (!(jornada >= 1 && jornada <= 99)) return { ok: false, error: 'datos_invalidos' };
  const lista = Array.isArray(p.jugadores) ? p.jugadores.slice(0, 80) : [];
  const nombres = nombresPorId_(lista.map((j) => texto_(j && j.id)));
  const firma = limpia_(p.firma).slice(0, 60);

  const nuevas = [];
  if (texto_(p.equipo)) nuevas.push([jornada, 'Todo el equipo', limpiaLargo_(p.equipo), firma, true]);
  lista.forEach((j) => {
    const n = nombres[texto_(j && j.id)];
    if (n && texto_(j.texto)) nuevas.push([jornada, n, limpiaLargo_(j.texto), firma, true]);
  });

  const hoja = asegurarHoja_(HOJAS.COMENTARIOS);
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 1) {
    // Los comentarios ocultos (Mostrar sin marcar) de esa jornada se respetan.
    const v = hoja.getRange(2, 1, ultima - 1, 5).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (Number(v[i][0]) === jornada && v[i][4] === true) hoja.deleteRow(i + 2);
    }
  }
  if (nuevas.length) {
    const inicio = ultimaFilaCon_(hoja, 1) + 1;
    hoja.getRange(inicio, 1, nuevas.length, 5).setValues(nuevas);
    casillas_(hoja.getRange(inicio, 5, nuevas.length, 1));
  }
  return { ok: true, guardados: nuevas.length };
}

/**
 * Ficha de un jugador desde la web: dorsal, apodo, activo y, si se ha tocado, su baja o lesión.
 * Los campos que no llegan no se modifican (así no se pisa lo que solo está en la hoja).
 */
function guardarJugador_(p) {
  const id = texto_(p.id);
  if (!/^\d{5,20}$/.test(id)) return { ok: false, error: 'datos_invalidos' };
  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const ultima = ultimaFilaCon_(hoja, 1);
  const ids = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, 1).getValues().map((f) => texto_(f[0])) : [];
  const i = ids.indexOf(id);
  if (i < 0) return { ok: false, error: 'jugador_desconocido' };
  const fila = i + 2;
  const valores = hoja.getRange(fila, 1, 1, cab.length).getValues()[0];
  if (p.dorsal !== undefined) {
    const d = texto_(p.dorsal);
    valores[cab.indexOf('Dorsal')] = /^\d{1,3}$/.test(d) ? Number(d) : '';
  }
  if (p.apodo !== undefined) valores[cab.indexOf('Apodo')] = limpia_(p.apodo).slice(0, 40);
  if (p.activo !== undefined) valores[cab.indexOf('Activo')] = p.activo !== false;
  if (Array.isArray(p.roles)) valores[cab.indexOf('Roles')] = limpiaRoles_(p.roles);
  if (p.nombreCorto !== undefined) valores[cab.indexOf('Nombre corto')] = limpia_(p.nombreCorto).slice(0, 30);
  if (p.cuotas !== undefined) valores[cab.indexOf('Cuotas pendientes')] = contador_(p.cuotas);
  if (p.multas !== undefined) valores[cab.indexOf('Multas pendientes')] = contador_(p.multas);
  hoja.getRange(fila, 1, 1, cab.length).setValues([valores]);

  if (p.lesion && typeof p.lesion === 'object') guardarLesion_(texto_(valores[cab.indexOf('Nombre')]), p.lesion);
  return { ok: true };
}

/** Crea, actualiza o da por recuperada la baja/lesión activa de un jugador en LESIONES. */
function guardarLesion_(nombre, l) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const hoja = asegurarHoja_(HOJAS.LESIONES);
  const cab = ESTRUCTURA.LESIONES.cabecera;
  const col = (t) => cab.indexOf(t);
  const ultima = ultimaFilaCon_(hoja, 1);
  const datos = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, cab.length).getValues() : [];
  let fila = -1;
  datos.forEach((f, i) => {
    if (normaliza_(f[col('Jugador')]) === normaliza_(nombre) && normaliza_(f[col('Estado')]) !== 'recuperado') fila = i + 2;
  });

  const estado = { baja: 'Baja', duda: 'Duda' }[texto_(l.estado)] || null;
  if (!estado) {
    // Disponible: la lesión abierta pasa a "Recuperado" (queda el historial).
    if (fila > 0) hoja.getRange(fila, col('Estado') + 1).setValue('Recuperado');
    return;
  }
  if (fila < 0) {
    fila = ultima + 1;
    hoja.getRange(fila, col('Jugador') + 1).setValue(nombre);
  }
  const valores = hoja.getRange(fila, 1, 1, cab.length).getValues()[0];
  valores[col('Estado')] = estado;
  if (l.detalle !== undefined) valores[col('Detalle')] = limpia_(l.detalle);
  if (l.vuelta !== undefined) {
    valores[col('Vuelta prevista')] = /^\d{4}-\d{2}-\d{2}$/.test(texto_(l.vuelta)) ? Utilities.parseDate(texto_(l.vuelta), tz, 'yyyy-MM-dd') : '';
  }
  valores[col('Mostrar')] = true;
  valores[col('Mostrar detalle')] = l.mostrarDetalle === true;
  hoja.getRange(fila, 1, 1, cab.length).setValues([valores]);
  casillas_(hoja.getRange(fila, col('Mostrar') + 1, 1, 2));
}

/**
 * Roles del equipo (pestaña Roles de la web): roles y nombre corto de cada jugador, y los
 * entrenadores que no están en la plantilla (solo nombre, en AJUSTES).
 */
function guardarRoles_(p) {
  const lista = Array.isArray(p.jugadores) ? p.jugadores.slice(0, 80) : [];
  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const ultima = ultimaFilaCon_(hoja, 1);
  if (lista.length && ultima > 1) {
    const datos = hoja.getRange(2, 1, ultima - 1, cab.length).getValues();
    const filaPorId = {};
    datos.forEach((f, i) => (filaPorId[texto_(f[0])] = i));
    lista.forEach((j) => {
      const i = filaPorId[texto_(j && j.id)];
      if (i === undefined) return;
      if (Array.isArray(j.roles)) datos[i][cab.indexOf('Roles')] = limpiaRoles_(j.roles);
      if (j.nombreCorto !== undefined) datos[i][cab.indexOf('Nombre corto')] = limpia_(j.nombreCorto).slice(0, 30);
    });
    hoja.getRange(2, 1, datos.length, cab.length).setValues(datos);
  }
  const ct = p.cuerpoTecnico || {};
  if (ct.segundo !== undefined) escribirAjuste_('Segundo entrenador', limpia_(ct.segundo).slice(0, 40));
  if (ct.tercero !== undefined) escribirAjuste_('Tercer entrenador', limpia_(ct.tercero).slice(0, 40));
  if (ct.cuarto !== undefined) escribirAjuste_('Cuarto entrenador', limpia_(ct.cuarto).slice(0, 40));
  return { ok: true };
}

/* ───────────────────────── PIN (cifrados, fuera de la hoja) ───────────────────────── */

/**
  * Los PIN se guardan en las propiedades del script (nunca en la hoja) y tal cual, no cifrados,
  * para que el administrador pueda consultarlos si alguien se le olvida.
  */
function pinesGuardados_() {
  const props = PropertiesService.getScriptProperties();
  return {
    equipo: texto_(props.getProperty('PIN_EQUIPO')),
    staff: texto_(props.getProperty('PIN_STAFF')),
    tesoreria: texto_(props.getProperty('PIN_TESORERIA')),
    admin: texto_(props.getProperty('PIN_ADMIN')),
  };
}

/**
 * ¿Puede ver la web? Vale el PIN del equipo o el de cualquiera del cuerpo técnico.
 * Si no hay PIN del equipo, la web es abierta y pasa cualquiera.
 * Se cuentan los fallos para que nadie pruebe PIN a lo bruto.
 */
function puedeVer_(pin) {
  const equipo = pinesGuardados_().equipo;
  if (!equipo) return true;
  const p = texto_(pin);
  if (p === equipo || nivelPin_(p)) return true;
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('fallos_equipo') || 0);
  if (fallos < MAX_FALLOS_PIN) cache.put('fallos_equipo', String(fallos + 1), 15 * 60);
  return false;
}

/** 'admin', 'tesoreria', 'staff' o null. */
function nivelPin_(pin) {
  const p = texto_(pin);
  if (!/^\d{4,8}$/.test(p)) return null;
  const pines = pinesGuardados_();
  if (p === pines.admin) return 'admin';
  if (p === pines.equipo) return null; // el del equipo solo deja mirar, no editar
  if (p === pines.tesoreria) return 'tesoreria';
  if (p === pines.staff) return 'staff';
  return null;
}

/** Los tres PIN (solo para el administrador). */
function verPines_() {
  return { ok: true, pines: pinesGuardados_() };
}

const CLAVE_PIN_ = { equipo: 'PIN_EQUIPO', staff: 'PIN_STAFF', tesoreria: 'PIN_TESORERIA', admin: 'PIN_ADMIN' };

/** Guarda un PIN nuevo. Devuelve un texto de error o '' si todo va bien. */
function ponerPin_(cual, nuevo) {
  const clave = CLAVE_PIN_[cual];
  const pin = texto_(nuevo);
  if (!clave) return 'Ese PIN no existe.';
  if (!/^\d{4,8}$/.test(pin)) return 'El PIN tiene que tener de 4 a 8 cifras.';
  const props = PropertiesService.getScriptProperties();
  const repetido = Object.keys(CLAVE_PIN_)
    .filter((x) => x !== cual)
    .some((x) => texto_(props.getProperty(CLAVE_PIN_[x])) === pin);
  if (repetido) return 'Los PIN tienen que ser distintos entre sí.';
  props.setProperty(clave, pin);
  return '';
}

/** Desde la web, con el PIN de tesorería. */
function cambiarPin_(p) {
  const cual = CLAVE_PIN_[texto_(p.cual)] ? texto_(p.cual) : '';
  if (!cual) return { ok: false, error: 'datos_invalidos' };
  const error = ponerPin_(cual, p.nuevo);
  return error ? { ok: false, error: 'pin_no_valido', mensaje: error } : { ok: true };
}

function esPropietario_() {
  const yo = Session.getActiveUser().getEmail();
  const propietario = SpreadsheetApp.getActive().getOwner();
  return Boolean(yo) && (!propietario || propietario.getEmail() === yo);
}

/** Pide un PIN por pantalla. Devuelve el PIN elegido o null si se cancela. */
function pedirPin_(titulo, texto) {
  const ui = SpreadsheetApp.getUi();
  for (let intento = 0; intento < 3; intento++) {
    const r = ui.prompt(titulo, texto + '\n(De 4 a 8 cifras. Apúntalo: no se puede volver a ver, solo cambiar.)', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    const pin = texto_(r.getResponseText());
    if (/^\d{4,8}$/.test(pin)) return pin;
    ui.alert('Ese PIN no vale: tienen que ser de 4 a 8 cifras.');
  }
  return null;
}

/** Menú de la hoja: solo el propietario puede cambiar los PIN. */
function cambiarPinDesdeMenu() {
  const ui = SpreadsheetApp.getUi();
  if (!esPropietario_()) {
    ui.alert('Solo el propietario de la hoja puede cambiar los PIN.');
    return;
  }
  const nuevos = {
    staff: pedirPin_('PIN del míster', 'Nuevo PIN del míster: convocatorias y comentarios (Cancelar para no cambiarlo).'),
    tesoreria: pedirPin_('PIN del tesorero', 'Nuevo PIN del tesorero: cuotas y multas (Cancelar para no cambiarlo).'),
    equipo: pedirPin_('PIN del equipo', 'Nuevo PIN del equipo: el que necesitan los jugadores para abrir la web (Cancelar para no cambiarlo).'),
    admin: pedirPin_('Tu PIN de administrador', 'Nuevo PIN de administrador: lo puede todo (Cancelar para no cambiarlo).'),
  };
  const errores = Object.keys(nuevos).filter((c) => nuevos[c]).map((c) => ponerPin_(c, nuevos[c]));
  const fallo = errores.filter(String);
  ui.alert(fallo.length ? 'No se ha cambiado todo: ' + fallo.join(' ') : 'PIN actualizados ✅');
}

/** Cambia (o crea) una fila Ajuste / Valor en AJUSTES. */
function escribirAjuste_(ajuste, valor) {
  const hoja = asegurarHoja_(HOJAS.AJUSTES);
  const ultima = ultimaFilaCon_(hoja, 1);
  const nombres = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, 1).getValues().map((f) => texto_(f[0])) : [];
  const i = nombres.indexOf(ajuste);
  const fila = i >= 0 ? i + 2 : ultima + 1;
  hoja.getRange(fila, 1, 1, 2).setValues([[ajuste, valor]]);
}

/** Tesorería: cuotas y multas pendientes (número) de varios jugadores a la vez. */
function guardarTesoreria_(p) {
  const lista = Array.isArray(p.jugadores) ? p.jugadores.slice(0, 80) : [];
  if (!lista.length) return { ok: false, error: 'datos_invalidos' };
  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima < 2) return { ok: false, error: 'sin_jugadores' };
  const datos = hoja.getRange(2, 1, ultima - 1, cab.length).getValues();
  const filaPorId = {};
  datos.forEach((f, i) => (filaPorId[texto_(f[0])] = i));
  let cambiados = 0;
  lista.forEach((j) => {
    const i = filaPorId[texto_(j && j.id)];
    if (i === undefined) return;
    datos[i][cab.indexOf('Cuotas pendientes')] = contador_(j.cuotas);
    datos[i][cab.indexOf('Multas pendientes')] = contador_(j.multas);
    cambiados++;
  });
  hoja.getRange(2, 1, datos.length, cab.length).setValues(datos);
  return { ok: true, guardados: cambiados };
}

const contador_ = (v) => Math.min(99, Math.max(0, Math.round(Number(v) || 0)));

/** Roles conocidos con su nombre bien escrito; los inventados se respetan tal cual. */
function limpiaRoles_(roles) {
  const vistos = [];
  roles.slice(0, 12).forEach((r) => {
    const t = limpia_(r).replace(/,/g, ' ').slice(0, 40).trim();
    if (!t) return;
    const conocido = ROLES.find((x) => normaliza_(x) === normaliza_(t));
    const final = conocido || t;
    if (vistos.indexOf(final) < 0) vistos.push(final);
  });
  return vistos.join(', ');
}

/* ───────────────────────── Preparar la hoja ───────────────────────── */

function prepararHoja() {
  const ss = SpreadsheetApp.getActive();
  const nuevas = {};
  Object.keys(ESTRUCTURA).forEach((nombre) => {
    nuevas[nombre] = !ss.getSheetByName(nombre);
    asegurarHoja_(nombre);
  });

  if (nuevas.LEEME) {
    const lineas = [
      'Esta hoja alimenta la web del equipo. La web SOLO enseña las filas con la casilla "Mostrar" marcada.',
      'La hoja es privada: compártela (botón Compartir) solo con quien vaya a editar.',
      'Los cambios tardan hasta 1 minuto en verse en la web.',
      '',
      'AJUSTES: horario habitual de entreno (días, hora y lugar) y entrenadores que no están en la plantilla (solo nombre).',
      'PIN: no están en la hoja. Hay tres (míster, tesorero y administrador). Se cambian desde la web con el de administrador,',
      '   o con el menú 🐾 → Cambiar PIN (solo el propietario de la hoja).',
      'ANUNCIOS: salen lo primero al entrar en la web. "Importante" los pone arriba y resaltados. "Caduca" los oculta pasada esa fecha.',
      'JUGADORES: se rellena desde CopaFácil (menú 🐾 Black Panthers). Puedes cambiar el dorsal, poner un apodo (nombre en la web), un nombre corto (Roles del equipo),',
      '   desmarcar "Activo" para que no salga en estadísticas ni convocatorias, poner sus roles (Míster, Capitán…, separados por comas),',
      '   sus cuotas y multas pendientes (número) y su cumpleaños. No cambies la columna Nombre. Todo esto también se edita desde la web.',
      'LESIONES: una fila por jugador tocado. Estado Baja o Duda. Cuando vuelva, pon "Recuperado" o borra la fila.',
      'ENTRENOS: una fila por entreno. Marca "Mostrar" y a los que vinieron (o pasa lista desde la web en modo staff).',
      '   Si un entreno cambia de día, hora o lugar, apúntalo aquí antes y la web lo anunciará como próximo entreno.',
      'MENSAJES: Tipo "Motivador" (sale arriba en la web) o "Cuerpo técnico". Se muestra el más reciente de cada tipo.',
      'MEJORAR y FUERTES: aspectos a mejorar y puntos fuertes. Deja "Para" vacío para el equipo, o elige un jugador.',
      'COMENTARIOS: lo que dice el cuerpo técnico de cada partido. Pon el número de jornada y en "Para" elige "Todo el equipo" o un jugador (una fila por comentario).',
      'NORMATIVA: normas internas del equipo, una por fila.',
      'QUEDADAS / FOTOS: el tercer tiempo. En FOTOS pega el enlace de Google Drive de cada foto, compartida con "cualquiera con el enlace".',
      'ENTRADAS: cada vez que un jugador abre la web. Solo lo ves tú y el cuerpo técnico, desde Equipo.',
      'PRELISTA: quién ha dicho que va a cada partido, por orden. La rellenan los jugadores desde la web.',
      'MVP y ESTRATEGIA: las rellena la web (MVP designado a mano y la pizarra de cada partido). No hace falta tocarlas.',
      'VOTOS: los votos al MVP de cada partido. Los rellenan los jugadores desde la web, sin PIN. No hace falta tocarla.',
      'CONVOCATORIAS: la rellena la web (modo staff). Estado: Convocado, No viene o No convocado. Después del partido, lo que quede es quién vino.',
    ];
    ss.getSheetByName(HOJAS.LEEME).getRange(2, 1, lineas.length, 1).setValues(lineas.map((l) => [l])).setWrap(true);
  }

  const ajustes = ss.getSheetByName(HOJAS.AJUSTES);
  if (nuevas.AJUSTES) {
    ajustes.getRange(2, 1, 3, 2).setValues([
      ['Días de entreno', ''],
      ['Hora de entreno', ''],
      ['Lugar de entreno', ''],
    ]);
    ajustes.getRange(3, 2).setNumberFormat('HH:mm');
    ajustes.getRange(2, 3, 3, 1).setValues([
      ['← ej.: Martes, Jueves'],
      ['← ej.: 20:30'],
      ['← ej.: Camp UE Tancat (El Vendrell)'],
    ]).setFontColor('#888888');
    ajustes.getRange(5, 1, CUERPO_TECNICO_INICIAL.length, 2).setValues(CUERPO_TECNICO_INICIAL);
    ajustes.getRange(5, 3).setValue('← solo si no es un jugador de la plantilla (sale solo el nombre)').setFontColor('#888888');
  }

  const dias = (n) => new Date(Date.now() + n * 86400000);
  if (nuevas.ANUNCIOS) {
    ss.getSheetByName(HOJAS.ANUNCIOS).getRange(2, 1, 1, 6)
      .setValues([[dias(0), '¡Estrenamos web!', 'Aquí veréis anuncios, convocatorias, clasificación y mucho más.', true, dias(14), true]]);
  }
  if (nuevas.MENSAJES) {
    ss.getSheetByName(HOJAS.MENSAJES).getRange(2, 1, 2, 5).setValues([
      [dias(0), 'Motivador', 'Garra, cabeza y corazón. Somos Black Panthers.', '', true],
      [dias(0), 'Cuerpo técnico', 'Escribe aquí el mensaje del cuerpo técnico.', 'Cuerpo técnico', false],
    ]);
  }
  if (nuevas.MEJORAR) {
    ss.getSheetByName(HOJAS.MEJORAR).getRange(2, 1, 1, 4)
      .setValues([['', 'Ejemplo: salida de balón', 'Escribe aquí el detalle y marca "Mostrar".', false]]);
  }
  if (nuevas.FUERTES) {
    ss.getSheetByName(HOJAS.FUERTES).getRange(2, 1, 1, 4)
      .setValues([['', 'Ejemplo: presión tras pérdida', 'Escribe aquí el detalle y marca "Mostrar".', false]]);
  }
  if (nuevas.NORMATIVA) {
    ss.getSheetByName(HOJAS.NORMATIVA).getRange(2, 1, 1, 3)
      .setValues([['Ejemplo: puntualidad', 'Escribe aquí la norma y marca "Mostrar".', false]]);
  }

  formatearColumnas_();
  actualizarJugadores();
  if (nuevas.JUGADORES) ponerRolesIniciales_();

  const vacia = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja1');
  if (vacia && vacia.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vacia);
  ss.setActiveSheet(ajustes);

  // PIN: se eligen ahora (si ya existen, no se tocan).
  const props = PropertiesService.getScriptProperties();
  const avisos = [];
  const pedir = [
    ['equipo', 'PIN del equipo', 'Lo necesitan todos los jugadores para abrir la web.'],
    ['staff', 'PIN del míster', 'Convocatorias y comentarios de los partidos.'],
    ['tesoreria', 'PIN del tesorero', 'Cuotas y multas.'],
    ['admin', 'Tu PIN de administrador', 'Lo puede todo: anuncios, plantilla, roles, entrenos, tercer tiempo y los tres PIN.'],
  ];
  pedir.forEach(([cual, titulo, para]) => {
    if (props.getProperty(CLAVE_PIN_[cual])) return;
    let pin = pedirPin_(titulo, 'Elige el PIN. ' + para);
    if (!pin || ponerPin_(cual, pin)) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      ponerPin_(cual, pin);
    }
    avisos.push(titulo + ': ' + pin);
  });
  SpreadsheetApp.getUi().alert(
    'Hoja preparada ✅' + (avisos.length ? '\n\n' + avisos.join('\n') + '\n\nApúntalos. Con el de administrador puedes consultar los tres desde la web.' : '')
  );
}

/**
 * Carga la normativa interna de la temporada en la hoja NORMATIVA.
 * Se puede volver a ejecutar: pregunta antes de sustituir lo que haya.
 */
function cargarNormativaInterna() {
  const normas = [
    ['Convocatoria: 12 jugadores por partido',
     '7 titulares y 5 suplentes.'],
    ['Rotación y prioridad',
     'Los 4 jugadores que se queden fuera de la lista en una jornada tienen plaza reservada prioritaria para el siguiente partido: 48 h para confirmar desde que se abre la lista. Las 8 plazas restantes se ocupan por estricto orden de inscripción en el grupo.'],
    ['Cancelaciones',
     'Cancelar con menos de 24 h de antelación y sin causa justificada: pierdes el turno de prioridad en la siguiente rotación.'],
    ['Cuota mensual: 10,00 € por jugador',
     'Para aguas, bebidas, balones, petos, botiquín, cenas, etc.'],
    ['Amarilla normal: 0,50 €',
     'Falta común o lance del juego. Se paga únicamente la multa de la liga.'],
    ['Amarilla por protestar o reincidencia: 1,50 €',
     '0,50 € de la liga y 1,00 € al bote del club. Si es por protestar o por reiteración grave sube a 2,00 € (0,50 € de la liga y 1,50 € al bote).'],
    ['Tarjeta roja: 10,00 €',
     'Por cualquier motivo: 5,00 € de la liga y 5,00 € al bote del club.'],
    ['Rotaciones: todos los mismos minutos',
     'Con 12 convocados se hacen cambios en bloque. Min 0-10: equipo titular (7 en campo). Min 10-20: entran los 5 suplentes. Min 20-30: rotación de bloque (cierre de la primera parte e inicio de la segunda). Min 30-40: rotación de bloque. Min 40-50: cambios libres según cansancio y marcador.'],
    ['Respeto total entre compañeros',
     'Cero gritos, malas caras o insultos.'],
    ['Con el árbitro habla solo el capitán',
     'Amarilla por protestar: suplencia obligatoria en la siguiente jornada. Roja directa: un partido de suspensión interna.'],
  ];

  const hoja = asegurarHoja_(HOJAS.NORMATIVA);
  const ui = SpreadsheetApp.getUi();
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima > 1) {
    const r = ui.alert('Normativa interna', 'La hoja NORMATIVA ya tiene ' + (ultima - 1) + ' filas. ¿Las sustituyo por la normativa de la temporada?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
    hoja.deleteRows(2, ultima - 1);
  }
  hoja.getRange(2, 1, normas.length, 3).setValues(normas.map(function (n) { return [n[0], n[1], true]; }));
  formatearColumnas_();
  CacheService.getScriptCache().remove('publico');
  SpreadsheetApp.getActive().setActiveSheet(hoja);
  ui.alert('Normativa cargada ✅', normas.length + ' normas. Ya se ven en la web, en Equipo → Normativa interna.', ui.ButtonSet.OK);
}

function ponerRolesIniciales_() {
  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const ultima = ultimaFilaCon_(hoja, 1);
  if (ultima < 2) return;
  const datos = hoja.getRange(2, 1, ultima - 1, cab.length).getValues();
  datos.forEach((f) => {
    const roles = ROLES_INICIALES[texto_(f[0])];
    if (roles && !texto_(f[cab.indexOf('Roles')])) f[cab.indexOf('Roles')] = roles;
    const corto = NOMBRES_CORTOS_INICIALES[texto_(f[0])];
    if (corto && !texto_(f[cab.indexOf('Nombre corto')])) f[cab.indexOf('Nombre corto')] = corto;
  });
  hoja.getRange(2, 1, datos.length, cab.length).setValues(datos);
}

function formatearColumnas_() {
  const ss = SpreadsheetApp.getActive();
  const checks = {
    ANUNCIOS: ['Importante', 'Mostrar'],
    LESIONES: ['Mostrar', 'Mostrar detalle'],
    MENSAJES: ['Mostrar'],
    MEJORAR: ['Mostrar'],
    FUERTES: ['Mostrar'],
    COMENTARIOS: ['Mostrar'],
    NORMATIVA: ['Mostrar'],
    QUEDADAS: ['Mostrar'],
    FOTOS: ['Mostrar'],
  };
  const fechas = {
    ANUNCIOS: ['Fecha', 'Caduca'],
    JUGADORES: ['Cumpleaños'],
    LESIONES: ['Vuelta prevista'],
    ENTRENOS: ['Fecha'],
    MENSAJES: ['Fecha'],
    QUEDADAS: ['Fecha'],
    FOTOS: ['Fecha'],
  };
  const horas = { ENTRENOS: ['Hora'], QUEDADAS: ['Hora'] };
  const listas = {
    LESIONES: { Estado: ['Baja', 'Duda', 'Recuperado'] },
    MENSAJES: { Tipo: ['Motivador', 'Cuerpo técnico'] },
  };

  Object.keys(ESTRUCTURA).forEach((nombre) => {
    const hoja = ss.getSheetByName(nombre);
    const cab = ESTRUCTURA[nombre].cabecera;
    const rango = (t) => hoja.getRange(2, cab.indexOf(t) + 1, FILAS, 1);
    (checks[nombre] || []).forEach((t) => {
      casillas_(rango(t));
    });
    (fechas[nombre] || []).forEach((t) => rango(t).setNumberFormat('dd/mm/yyyy'));
    (horas[nombre] || []).forEach((t) => rango(t).setNumberFormat('HH:mm'));
    Object.keys(listas[nombre] || {}).forEach((t) => {
      rango(t).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(listas[nombre][t], true).build());
    });
  });
}

/** Trae la plantilla de CopaFácil: añade jugadores nuevos y actualiza dorsales, sin tocar lo demás. */
function actualizarJugadores() {
  const url = COPAFACIL.base + '/' + COPAFACIL.evento + '/player.json?orderBy=' +
    encodeURIComponent('"team"') + '&equalTo=' + encodeURIComponent('"' + COPAFACIL.equipo + '"');
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('CopaFácil no respondió (' + resp.getResponseCode() + ')');
  const plantilla = Object.entries(JSON.parse(resp.getContentText()) || {}).map(([id, p]) => {
    const m = String(p.n || '').match(/^\s*(\d+)/);
    return { id: id, dorsal: m ? Number(m[1]) : '', nombre: String(p.name || '').replace(/\s+/g, ' ').trim() };
  });

  const hoja = asegurarHoja_(HOJAS.JUGADORES);
  const cab = ESTRUCTURA.JUGADORES.cabecera;
  const cDorsal = cab.indexOf('Dorsal');
  const cNombre = cab.indexOf('Nombre');
  // Se cuenta por la columna de ID: las casillas vacías de otras columnas no cuentan como filas usadas.
  const ultima = ultimaFilaCon_(hoja, 1);
  const datos = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, cab.length).getValues() : [];
  const filaPorId = {};
  datos.forEach((f, i) => (filaPorId[texto_(f[0])] = i));

  plantilla.forEach((j) => {
    const i = filaPorId[j.id];
    if (i !== undefined) {
      // El nombre de CopaFácil se mantiene al día; el dorsal solo si está vacío (se puede cambiar a mano).
      datos[i][cNombre] = j.nombre;
      if (texto_(datos[i][cDorsal]) === '') datos[i][cDorsal] = j.dorsal;
    } else {
      const nueva = cab.map(() => '');
      nueva[0] = j.id;
      nueva[cDorsal] = j.dorsal;
      nueva[cNombre] = j.nombre;
      nueva[cab.indexOf('Activo')] = true;
      nueva[cab.indexOf('Cuotas pendientes')] = 0;
      nueva[cab.indexOf('Multas pendientes')] = 0;
      nueva[cab.indexOf('Mostrar cumpleaños')] = false;
      datos.push(nueva);
    }
  });
  const total = datos.length;
  if (total > 0) {
    hoja.getRange(2, 1, total, cab.length).setValues(datos);
    if (total > 1) hoja.getRange(2, 1, total, cab.length).sort({ column: cDorsal + 1, ascending: true });
    casillas_(hoja.getRange(2, cab.indexOf('Activo') + 1, total, 1));
    casillas_(hoja.getRange(2, cab.indexOf('Mostrar cumpleaños') + 1, total, 1));
  }

  const nombres = total > 0 ? hoja.getRange(2, cNombre + 1, total, 1).getValues().map((f) => texto_(f[0])).filter(String) : [];

  // Lista desplegable de jugadores en LESIONES.
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInRange(hoja.getRange('C2:C200'), true).setAllowInvalid(true).build();
  asegurarHoja_(HOJAS.LESIONES).getRange(2, 1, FILAS, 1).setDataValidation(regla);
  const listaPara = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Todo el equipo'].concat(nombres), true).setAllowInvalid(true).build();
  asegurarHoja_(HOJAS.COMENTARIOS).getRange(2, 2, FILAS, 1).setDataValidation(listaPara);
  asegurarHoja_(HOJAS.MEJORAR).getRange(2, 1, FILAS, 1).setDataValidation(listaPara);
  asegurarHoja_(HOJAS.FUERTES).getRange(2, 1, FILAS, 1).setDataValidation(listaPara);

  prepararEntrenos_(nombres);
}

/** Añade a ENTRENOS una columna por cada jugador que aún no la tenga. */
function prepararEntrenos_(nombres) {
  const hoja = asegurarHoja_(HOJAS.ENTRENOS);
  const ancho = hoja.getLastColumn();
  const cab = hoja.getRange(1, 1, 1, ancho).getValues()[0].map(texto_);
  const faltan = nombres.filter((n) => cab.indexOf(n) < 0);
  if (faltan.length) hoja.getRange(1, ancho + 1, 1, faltan.length).setValues([faltan]);

  const total = hoja.getLastColumn();
  const fijas = ENTRENOS_FIJAS.length;
  estiloCabecera_(hoja, total);
  hoja.setFrozenColumns(1);
  hoja.getRange(2, 1, FILAS, 1).setNumberFormat('dd/mm/yyyy');
  hoja.getRange(2, 2, FILAS, 1).setNumberFormat('HH:mm');
  // Casillas en "Mostrar" y en todas las columnas de jugadores.
  const casillas = hoja.getRange(2, fijas, FILAS, total - fijas + 1);
  casillas_(casillas);
  if (total > fijas) {
    hoja.getRange(1, fijas + 1, 1, total - fijas).setTextRotation(60);
    hoja.setColumnWidths(fijas + 1, total - fijas, 44);
  }
}

/* ───────────────────────── Utilidades ───────────────────────── */

function asegurarHoja_(nombre) {
  const ss = SpreadsheetApp.getActive();
  let hoja = ss.getSheetByName(nombre);
  if (hoja) return hoja;
  hoja = ss.insertSheet(nombre);
  const def = ESTRUCTURA[nombre];
  if (def) {
    hoja.getRange(1, 1, 1, def.cabecera.length).setValues([def.cabecera]);
    def.anchos.forEach((a, i) => hoja.setColumnWidth(i + 1, a));
    estiloCabecera_(hoja, def.cabecera.length);
  }
  // Los ID de CopaFácil son números largos: se guardan como texto para no perder dígitos.
  if (nombre === HOJAS.JUGADORES) hoja.getRange('A:A').setNumberFormat('@');
  if (nombre === HOJAS.CONVOCATORIAS) hoja.getRange('A:A').setNumberFormat('@');
  if (nombre === HOJAS.CONVOCATORIAS) hoja.getRange('D:D').setNumberFormat('@');
  hoja.setTabColor(nombre === HOJAS.CONVOCATORIAS ? '#555555' : NARANJA);
  return hoja;
}

function estiloCabecera_(hoja, columnas) {
  hoja.getRange(1, 1, 1, columnas)
    .setBackground(NARANJA).setFontColor('#000000').setFontWeight('bold');
  hoja.setFrozenRows(1);
}

/** Pone casillas de verificación sin tocar lo que ya hay escrito (insertCheckboxes lo pondría todo a FALSE). */
function casillas_(rango) {
  rango.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

function ultimaFilaCon_(hoja, columna) {
  const valores = hoja.getRange(1, columna, hoja.getMaxRows(), 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) if (texto_(valores[i][0])) return i + 1;
  return 1;
}

/** Lee una pestaña como lista de objetos {cabecera: valor}. */
function filas_(nombre) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!hoja || hoja.getLastRow() < 2) return [];
  const valores = hoja.getDataRange().getValues();
  const cab = valores[0].map(texto_);
  return valores.slice(1).map((fila) => {
    const o = {};
    cab.forEach((c, i) => (o[c] = fila[i]));
    return o;
  });
}

function leerAjustes_() {
  const res = {};
  filas_(HOJAS.AJUSTES).forEach((f) => (res[texto_(f['Ajuste'])] = f['Valor']));
  return res;
}

function texto_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Evita que un texto que llega de la web se interprete como fórmula. */
function limpia_(v) {
  const t = texto_(v).slice(0, 120);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

/** Igual que limpia_ pero para textos largos (comentarios). */
function limpiaLargo_(v) {
  const t = texto_(v).slice(0, 2000);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function normaliza_(v) {
  return texto_(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
