import { CONFIG } from './config.js?v=21';
import { cargarCopaFacil } from './copafacil.js?v=21';
import { leerHoja, enviarHoja } from './hoja.js?v=21';

/* ───────────────────────── Estado ───────────────────────── */

const CLAVE_CF = 'bp_copafacil_v1';
const CLAVE_HOJA = 'bp_hoja_v1';
const CLAVE_PIN = 'bp_pin';
const CLAVE_NIVEL = 'bp_nivel'; // 'staff' o 'tesoreria'
const CLAVE_GESTION = 'bp_gestion'; // este aparato usa la URL de gestión
const CLAVE_FIRMA = 'bp_firma';
const CLAVE_EQUIPO = 'bp_equipo'; // PIN del equipo: solo deja mirar la web

const estado = {
  cf: null,        // datos de CopaFácil
  hoja: null,      // datos de la hoja de Google
  errorCf: null,
  errorHoja: null,
  cargando: false,
  verTodoCalendario: false,
  verTodosComentarios: false,
  staff: false,    // modo staff (PIN guardado en este dispositivo)
  nivel: 'staff',  // 'tesoreria' si se entró con el PIN de tesorería
  edTesoreria: null, // cambios de tesorería aún sin guardar
  partidoConvocatoria: null, // partido elegido en el bloque de convocatoria
};

/* ───────────────────────── Utilidades ───────────────────────── */

const $ = (sel, raiz = document) => raiz.querySelector(sel);

const ICONOS = {
  lugar: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  silbato: '<svg viewBox="0 0 24 24"><circle cx="9" cy="14" r="5"/><path d="M13 11.5 21 8V5h-9l-3 4"/><circle cx="9" cy="14" r="1.2"/></svg>',
  cruz: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  duda: '<svg viewBox="0 0 24 24"><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/></svg>',
  prohibido: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/></svg>',
  album: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 17v4M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>',
  estrella: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/></svg>',
  trofeo: '<svg viewBox="0 0 24 28"><path d="M6 2h12v7a6 6 0 0 1-12 0Z" fill="#f2c200" stroke="#8a6d00" stroke-width="1.4"/><path d="M6 4H3v2a4 4 0 0 0 3 3.8M18 4h3v2a4 4 0 0 1-3 3.8" fill="none" stroke="#8a6d00" stroke-width="1.4"/><path d="M11 15h2v4h-2z" fill="#8a6d00" stroke="none"/><path d="M7 21h10v3H7z" fill="#f2c200" stroke="#8a6d00" stroke-width="1.4"/></svg>',
  plata: '<svg viewBox="0 0 22 30"><path d="M5 0 9 13h4L17 0Z" fill="#7a7a7a" stroke="none"/><circle cx="11" cy="21" r="8" fill="#d8d8d8" stroke="#8c8c8c" stroke-width="1.5"/></svg>',
  bronce: '<svg viewBox="0 0 22 30"><path d="M5 0 9 13h4L17 0Z" fill="#8a4b1f" stroke="none"/><circle cx="11" cy="21" r="8" fill="#c87f3a" stroke="#7a4517" stroke-width="1.5"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12Z"/><path d="M9.2 9.4c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.3 0 .5-.1.6l-.4.5c-.1.2-.2.3 0 .6.3.5.8 1.1 1.5 1.5.3.2.5.2.7 0l.5-.5c.2-.2.4-.2.6-.1l1.3.7c.4.2.4.4.4.6 0 .5-.4 1.1-1 1.3-.8.3-1.9 0-3.2-.8-1.3-.9-2.2-2-2.7-3-.4-.9-.3-1.7.1-2.3Z"/></svg>',
};

function icono(nombre) {
  const s = document.createElement('span');
  s.className = 'icono';
  s.style.display = 'inline-flex';
  s.innerHTML = ICONOS[nombre]; // SVG fijo del propio código, nunca datos externos
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/** Solo se aceptan enlaces https (evita javascript: y similares en datos de la hoja). */
function urlSegura(u) {
  try {
    const url = new URL(String(u || '').trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/** Crea un elemento. Los textos siempre van como textContent. */
function h(etiqueta, attrs = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'href' || k === 'src') {
      const seguro = v.startsWith('assets/') ? v : urlSegura(v);
      if (seguro) el.setAttribute(k, seguro);
    } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

const vacio = (texto) => h('p', { class: 'vacio', text: texto });
const pintar = (el, ...nodos) => el && el.replaceChildren(...nodos.flat(Infinity).filter(Boolean));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const recuperar = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
const hayHoja = () => Boolean(CONFIG.hoja);
const SIN_HOJA = 'Se rellenará desde la hoja del equipo.';

function imagen(src, alt = '', clase = '') {
  const seguro = urlSegura(src);
  if (!seguro) return h('span', { class: `foto-vacia ${clase}`.trim(), 'aria-hidden': 'true' });
  return h('img', { src: seguro, alt, class: clase, loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async' });
}

/* ───────────────────────── Fechas (hora de Madrid) ───────────────────────── */

const TZ = CONFIG.zonaHoraria;
const formato = (opciones, zona = TZ) => new Intl.DateTimeFormat('es-ES', { timeZone: zona, ...opciones });
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isoDe = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
const hoyIso = () => isoDe(Date.now());
const esIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const msDeIso = (iso) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d, 12); };
const diasEntre = (isoA, isoB) => Math.round((msDeIso(isoB) - msDeIso(isoA)) / 86400000);

const diaPartido = (ms) => capital(formato({ weekday: 'long', day: 'numeric', month: 'short' }).format(ms));
const horaPartido = (ms) => formato({ hour: '2-digit', minute: '2-digit' }).format(ms);
const diaHoja = (iso, opciones = { weekday: 'long', day: 'numeric', month: 'short' }) =>
  esIso(iso) ? capital(formato(opciones, 'UTC').format(msDeIso(iso))) : '';

function cuantoFalta(iso) {
  const d = diasEntre(hoyIso(), iso);
  if (d === 0) return '¡Hoy!';
  if (d === 1) return 'Mañana';
  if (d > 1) return `Faltan ${d} días`;
  return '';
}

function horaActualizacion(ms) {
  if (!ms) return '';
  const mismoDia = isoDe(ms) === hoyIso();
  return mismoDia
    ? `hoy a las ${horaPartido(ms)}`
    : `${formato({ day: 'numeric', month: 'short' }).format(ms)} a las ${horaPartido(ms)}`;
}

const enlaceMapa = (lugar) => {
  if (!lugar) return '';
  if (lugar.lat && lugar.lon) return `https://www.google.com/maps/search/?api=1&query=${lugar.lat},${lugar.lon}`;
  const q = [lugar.nombre, lugar.direccion].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
};

/* ───────────────────────── Datos derivados ───────────────────────── */

function proximoPartido() {
  const ahora = Date.now();
  return estado.cf?.partidos.find((p) => !p.finalizado && (p.fecha === null || p.fecha > ahora - 3 * 3600000)) || null;
}

const esStaff = () => estado.staff && hayHoja();
// Quién puede hacer qué (igual que en el script de la hoja). Lo que no está aquí es solo del administrador.
const PERMISOS = {
  convocar: ['staff'], comentar: ['staff'], tesoreria: ['tesoreria'],
  mvp: ['staff'], // el MVP elegido a mano
  notas: ['staff'], // las notas del MVP en la plantilla
  entradas: ['staff'], // quién entra en la web
  mensajeTecnico: ['staff'], // las instrucciones del cuerpo técnico
  pinStaff: ['staff'],        // el míster cambia su propio PIN
  pinTesoreria: ['tesoreria'], // el tesorero, el suyo
};
const permitido = (accion) => esStaff() && (estado.nivel === 'admin' || (PERMISOS[accion] || []).includes(estado.nivel));
const esTesorero = () => permitido('tesoreria');
const esAdmin = () => esStaff() && estado.nivel === 'admin';

/** Plantilla de CopaFácil con los cambios de la hoja: dorsal, apodo y si está activo. */
function plantillaCompleta() {
  const deHoja = new Map((estado.hoja?.jugadores || []).map((j) => [j.id, j]));
  const base = estado.cf?.jugadores?.length
    ? estado.cf.jugadores
    : [...deHoja.values()].map((j) => ({ id: j.id, nombre: j.nombre, dorsal: null, nota: '', foto: '', j: 0, goles: 0, ta: 0, tr: 0 }));
  return base
    .map((j) => {
      const x = deHoja.get(j.id);
      return {
        ...j,
        nombreOriginal: j.nombre,
        apodo: x?.apodo || '',
        nombre: x?.apodo || j.nombre,
        dorsal: x?.dorsal ?? j.dorsal,
        activo: x ? x.activo !== false : true,
        roles: x?.roles || [],
        nombreCorto: x?.nombreCorto || '',
        cuotas: x?.cuotas || 0,
        multas: x?.multas || 0,
      };
    })
    .sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Solo los jugadores activos: son los que salen en estadísticas, convocatorias y listas. */
const jugadores = () => plantillaCompleta().filter((j) => j.activo);
const jugadorPorId = (id) => plantillaCompleta().find((j) => j.id === id);

/**
 * Convocatoria de un partido en tres grupos. Si el staff no la ha hecho y el partido ya se jugó,
 * se usa la alineación del acta de CopaFácil. Los jugadores no activos no aparecen.
 */
function gruposConvocatoria(p) {
  const activo = (id) => jugadorPorId(id)?.activo !== false;
  const c = convocatoriaDe(p.id);
  if (c) {
    return {
      convocados: c.convocados.filter(activo),
      noVienen: (c.noVienen || []).filter(activo),
      noConvocados: (c.noConvocados || []).filter(activo),
      deActa: false,
    };
  }
  if (p.finalizado && p.alineacion?.length) return { convocados: p.alineacion.filter(activo), noVienen: [], noConvocados: [], deActa: true };
  return null;
}

/**
 * Asistencia a partidos ya jugados: en cada partido, los convocados son los que vinieron y
 * los "No viene" son faltas. Los partidos sin ningún dato no cuentan.
 */
function asistenciaPartidos() {
  const res = { partidos: 0, porJugador: {}, faltas: {} };
  for (const p of estado.cf?.partidos || []) {
    if (!p.finalizado) continue;
    const g = gruposConvocatoria(p);
    if (!g) continue;
    res.partidos++;
    g.convocados.forEach((id) => { res.porJugador[id] = (res.porJugador[id] || 0) + 1; });
    g.noVienen.forEach((id) => { res.faltas[id] = (res.faltas[id] || 0) + 1; });
  }
  return res;
}

function botonStaff(texto, accion, clase = 'boton-secundario', permiso = 'admin') {
  return permitido(permiso) ? h('button', { class: clase, type: 'button', onclick: accion }, texto) : null;
}
const lesionDe = (id) => (estado.hoja?.lesiones || []).find((l) => l.id === id);
const convocatoriaDe = (partidoId) => estado.hoja?.convocatorias?.[partidoId] || null;
const rivalDe = (p) => (p.somosLocal ? p.visitante : p.local);

/** Veces que un jugador ha entrado en una convocatoria. */
function vecesConvocado(id) {
  return Object.values(estado.hoja?.convocatorias || {}).filter((c) => c.convocados.includes(id)).length;
}

function marcasJugador(j, { proximo = true } = {}) {
  const marcas = [];
  if (proximo) {
    const p = proximoPartido();
    if (p && convocatoriaDe(p.id)?.noVienen?.includes(j.id)) {
      marcas.push(h('span', { class: 'estado no-viene', title: 'No viene al próximo partido' }, icono('cruz'), 'No viene'));
    }
  }
  const lesion = lesionDe(j.id);
  if (lesion) {
    marcas.push(h('span', { class: `estado ${lesion.estado}` }, icono(lesion.estado === 'duda' ? 'duda' : 'cruz'), lesion.estado === 'duda' ? 'Duda' : 'Baja'));
  }
  if (j.nota) marcas.push(h('span', { class: 'estado sancion', title: j.nota }, icono('prohibido'), j.nota.toLowerCase()));
  return marcas;
}

/* ───────────────────────── 1. Equipo ───────────────────────── */

function pintarHero() {
  $('#frase').textContent = estado.hoja?.mensajes?.motivador?.texto || CONFIG.fraseMotivadora;
  const eq = estado.cf?.equipo;
  const liga = $('#hero-liga');
  if (eq) {
    pintar(liga, h('strong', { text: `${eq.pos}º de ${estado.cf.totalEquipos}` }), ` · ${estado.cf.liga.grupo} · Veteranos F7 El Tancat`);
  } else {
    liga.textContent = 'Liga de Veteranos F7 · El Tancat';
  }
  $('#frase-mini').textContent = $('#frase').textContent;
  pintarMvpMini();
  pintar($('#staff-frase'), botonStaff('Cambiar frase', () => abrirMensaje('motivador')));
}

function pintarAnuncios() {
  const lista = estado.hoja?.anuncios || [];
  pintar($('#staff-anuncios'), botonStaff('Editar anuncios', () => abrirEditorLista('anuncios')));
  $('#anuncios-bloque').hidden = lista.length === 0 && !permitido('anuncios');
  pintar($('#anuncios'), lista.map((a) =>
    h('article', { class: `anuncio${a.importante ? ' importante' : ''}` },
      h('h3', {}, a.importante ? h('span', { class: 'etiqueta' }, icono('pin'), 'Importante') : null, a.titulo),
      a.texto ? h('p', { text: a.texto }) : null,
      esIso(a.fecha) ? h('p', { class: 'fecha', text: diaHoja(a.fecha, { day: 'numeric', month: 'long' }) }) : null)
  ));
}

function escudoEquipo(eq) {
  return h('div', { class: `equipo${eq.id === CONFIG.copafacil.equipo ? ' nuestro' : ''}` },
    imagen(eq.escudo, '', 'escudo-equipo'), h('span', { text: eq.nombre }));
}

function pintarProximoPartido() {
  const caja = $('#proximo-partido');
  if (!estado.cf) {
    pintar(caja, h('p', { class: 'sobretitulo', text: 'Próximo partido' }),
      vacio(estado.errorCf ? 'No se ha podido leer CopaFácil. Prueba con «Actualizar».' : 'Cargando datos de CopaFácil…'));
    return;
  }
  const p = proximoPartido();
  if (!p) {
    pintar(caja, h('p', { class: 'sobretitulo', text: 'Próximo partido' }), vacio('No hay partidos pendientes en el calendario.'));
    return;
  }
  const mapa = enlaceMapa(p.lugar);
  pintar(caja,
    h('p', { class: 'sobretitulo', text: `Próximo partido${p.jornada ? ` · Jornada ${p.jornada}` : ''}` }),
    h('div', { class: 'enfrentamiento' }, escudoEquipo(p.local), h('span', { class: 'vs', text: 'VS' }), escudoEquipo(p.visitante)),
    p.fecha
      ? h('div', { class: 'cuando' },
          h('span', { class: 'dia', text: diaPartido(p.fecha) }),
          h('span', { class: 'hora', text: horaPartido(p.fecha) }),
          h('span', { class: 'falta', text: cuantoFalta(isoDe(p.fecha)) }))
      : h('div', { class: 'cuando' }, h('span', { class: 'dia', text: 'Fecha por confirmar' })),
    p.lugar
      ? h('div', { class: 'donde' }, icono('lugar'),
          mapa ? h('a', { href: mapa, target: '_blank', rel: 'noopener', text: p.lugar.nombre }) : h('span', { text: p.lugar.nombre }),
          p.lugar.direccion ? h('span', { class: 'apagado', text: p.lugar.direccion }) : null)
      : null,
    resumenConvocatoria(p)
  );
}

/** "12 convocados · 3 no vienen" con el número de los que no vienen en rojo. */
function resumenConvocatoria(p) {
  const g = gruposConvocatoria(p);
  if (!g || g.deActa) return null;
  return h('p', { class: 'resumen-conv' },
    h('span', { class: 'si', text: `✓ ${g.convocados.length} ${g.convocados.length === 1 ? 'convocado' : 'convocados'}` }),
    g.noVienen.length ? h('span', { class: 'rojo', text: `✗ ${g.noVienen.length} no ${g.noVienen.length === 1 ? 'viene' : 'vienen'}` }) : null);
}

/** La tarjeta del próximo entreno; sale arriba del todo en Equipo y en Competición. */
function tarjetaEntreno() {
  const titulo = h('p', { class: 'sobretitulo', text: 'Próximo entreno' });
  if (!hayHoja()) return [titulo, vacio('Se mostrará en cuanto se conecte la hoja del equipo.')];
  if (!estado.hoja) return [titulo, vacio(estado.errorHoja ? 'No se ha podido leer la hoja.' : 'Cargando…')];
  const acciones = permitido('entreno')
    ? h('div', { class: 'acciones-tarjeta' },
        botonStaff('Pasar lista', abrirEntreno, 'boton'),
        botonStaff('Horario', abrirAjustesEntreno))
    : null;
  const e = estado.hoja.entrenos?.proximo;
  if (!e) return [titulo, vacio('No hay entreno programado. Ponlo en «Horario» o apúntalo en la hoja.'), acciones];
  const mapa = enlaceMapa({ nombre: e.lugar });
  return [
    titulo,
    h('div', { class: 'icono-grande' }, icono('silbato')),
    h('div', { class: 'cuando' },
      h('span', { class: 'dia', text: diaHoja(e.fecha) }),
      e.hora ? h('span', { class: 'hora', text: e.hora }) : null,
      h('span', { class: 'falta', text: cuantoFalta(e.fecha) })),
    e.lugar
      ? h('div', { class: 'donde' }, icono('lugar'), h('a', { href: mapa, target: '_blank', rel: 'noopener', text: e.lugar }))
      : null,
    e.habitual ? h('p', { class: 'nota', text: 'Horario habitual' }) : null,
    acciones,
  ];
}

/** Quién va al próximo entreno. Sencillo: voy o no voy, y lo ve todo el equipo. */
function pintarApuntadosEntreno() {
  const caja = $('#apuntados-entreno');
  const e = estado.hoja?.entrenos?.proximo;
  if (!e || !esIso(e.fecha)) return pintar(caja);
  const lista = estado.hoja.preEntreno?.[e.fecha] || [];
  const van = lista.filter((x) => x.dice === 'voy' && jugadorPorId(x.id));
  const no = lista.filter((x) => x.dice === 'no' && jugadorPorId(x.id));
  const yo = yoSoy();
  const mio = yo && lista.find((x) => x.id === yo.id);
  const chip = (x, clase) => {
    const j = jugadorPorId(x.id);
    return h('li', {}, h('span', { class: `chip${clase}` }, h('span', { class: 'dorsal', text: j.dorsal ?? '–' }), nombreCorto(j)));
  };

  pintar(caja, h('details', { class: 'conv-desplegable entreno-desplegable' },
    h('summary', {},
      h('span', { class: 'jornada-conv' }, icono('silbato'), 'Jugadores que van al entreno'),
      h('span', { class: `cuantos-conv${van.length ? ' vinieron' : ''}`, text: plural(van.length, 'va', 'van') })),
    h('div', { class: 'convocatoria compacta' },
      h('p', { class: 'apagado', text: `${diaHoja(e.fecha)}${e.hora ? ` · ${e.hora}` : ''}${e.lugar ? ` · ${e.lugar}` : ''}` }),
      van.length ? h('ul', { class: 'chips' }, van.map((x) => chip(x, ''))) : h('p', { class: 'apagado', text: 'Todavía no se ha apuntado nadie.' }),
      no.length ? h('ul', { class: 'chips' }, no.map((x) => chip(x, ' no'))) : null,
      yo
        ? h('div', { class: 'fila-acciones' },
            h('button', { type: 'button', class: `boton${mio?.dice === 'voy' ? '' : '-secundario'}`, onclick: () => apuntarseEntreno(e.fecha, mio?.dice === 'voy' ? 'quitar' : 'voy') },
              mio?.dice === 'voy' ? '✓ Voy' : 'Voy'),
            h('button', { type: 'button', class: `boton${mio?.dice === 'no' ? '' : '-secundario'}`, onclick: () => apuntarseEntreno(e.fecha, mio?.dice === 'no' ? 'quitar' : 'no') },
              mio?.dice === 'no' ? '✗ No voy' : 'No voy'))
        : h('p', { class: 'apagado', text: 'Identifícate para apuntarte (se pregunta al entrar).' }))));
}

async function apuntarseEntreno(fecha, dice) {
  const yo = yoSoy();
  if (!yo) return;
  const r = await enviarHoja(CONFIG.hoja, {
    accion: 'apuntarseEntreno', pinEquipo: recuperar(CLAVE_EQUIPO) || '',
    fecha, jugadorId: yo.id, dice,
  }).catch(() => null);
  if (r?.ok) {
    aviso(dice === 'quitar' ? 'Te has borrado del entreno' : dice === 'voy' ? '¡Apuntado al entreno! ✓' : 'Apuntado como que no vas');
    cargarHoja();
  } else {
    aviso('No se ha podido guardar. Inténtalo de nuevo.', true);
  }
}

function pintarProximoEntreno() {
  // Solo en Competición, arriba del todo.
  pintar($('#proximo-entreno-comp'), tarjetaEntreno());
}

function chipJugador(id, tipo = 'si') {
  const j = jugadorPorId(id);
  return h('li', { class: `chip ${tipo}` },
    h('span', { class: 'dorsal', text: j?.dorsal ?? '–' }), j?.nombre || 'Jugador');
}

/** Las tres listas de un partido: convocados (naranja), no vienen (rojo) y no convocados (gris). */
/**
 * Qué se le pregunta a cada uno: si el cuerpo técnico ya ha hecho la lista y
 * está convocado, se le pide confirmar; si no, si piensa ir.
 */
function etiquetasVoy(p) {
  const yo = yoSoy();
  const g = gruposConvocatoria(p);
  const lista = estado.hoja?.prelista?.[p.id] || [];
  const hayLista = Boolean(g && !g.deActa && g.convocados.length);
  const convocado = Boolean(yo && hayLista && g.convocados.includes(yo.id));
  const cual = p.jornada ? `la jornada ${p.jornada}` : 'el partido';
  // Bajas: convocados que han dicho que no. Son las plazas que se liberan.
  const bajas = hayLista
    ? g.convocados.filter((id) => lista.some((x) => x.id === id && x.dice === 'no')).length
    : 0;

  if (convocado) return { convocado: true, hayLista, bajas, pregunta: `¿Confirmas ${cual}?`, si: 'Confirmar', no: 'Darse de baja' };
  if (!hayLista) return { convocado: false, hayLista, bajas, pregunta: `¿Vas a ${cual}?`, si: 'Voy', no: 'No voy' };
  // No convocado: solo puede ofrecerse si alguien se ha caído.
  return {
    convocado: false, hayLista, bajas, suplente: true, cerrado: bajas === 0,
    pregunta: bajas ? `Hay ${plural(bajas, 'baja', 'bajas')} en ${cual}` : `Lista cerrada para ${cual}`,
    aclaracion: 'Sustituyes a una baja',
    si: 'Voy', no: 'No voy',
  };
}

/** Cómo va la convocatoria: cuántos han confirmado, cuántas bajas y quién falta. */
function resumenConfirmaciones(p) {
  const g = gruposConvocatoria(p);
  if (!g || g.deActa || !g.convocados.length) return null;
  const lista = estado.hoja?.prelista?.[p.id] || [];
  const respuesta = (id) => lista.find((x) => x.id === id)?.dice;
  return {
    total: g.convocados.length,
    confirmados: g.convocados.filter((id) => respuesta(id) === 'voy'),
    bajas: g.convocados.filter((id) => respuesta(id) === 'no'),
    faltan: g.convocados.filter((id) => !respuesta(id)),
  };
}

/** El Voy / No voy (o Confirmar) del próximo partido, arriba del todo en Competición. */
function pintarVoyRapido() {
  const caja = $('#voy-rapido');
  const p = proximoPartido();
  const yo = yoSoy();
  caja.hidden = !(p && yo && hayHoja() && estado.hoja);
  if (caja.hidden) return;
  const mio = (estado.hoja.prelista?.[p.id] || []).find((x) => x.id === yo.id);
  const e = etiquetasVoy(p);
  caja.className = `voy-rapido${mio ? ` respondido ${mio.dice}` : ''}`;

  // Al cuerpo técnico le interesa el recuento, no el «lista cerrada».
  const r = resumenConfirmaciones(p);
  if (permitido('convocar') && r && !e.convocado) {
    caja.className = 'voy-rapido recuento';
    return pintar(caja,
      h('span', { class: 'pregunta-voy', text: `Confirmados ${r.confirmados.length} de ${r.total}` }),
      h('span', { class: 'marcas-recuento' },
        h('span', { class: 'marca-conf', text: `✓ ${r.confirmados.length}` }),
        h('span', { class: 'marca-baja', text: `✗ ${r.bajas.length}` }),
        h('span', { class: 'marca-falta', text: `· ${r.faltan.length} sin contestar` })));
  }

  // Sin convocatoria para él y sin bajas: no le toca decir nada.
  if (e.cerrado && !mio) {
    caja.className = 'voy-rapido cerrado';
    return pintar(caja,
      h('span', { class: 'pregunta-voy', text: e.pregunta }),
      h('span', { class: 'cambiar-voy', text: 'Si alguien se cae, podrás ofrecerte' }));
  }

  // Una vez ha contestado, fuera el recuadro: solo queda lo que eligió.
  if (mio) {
    const va = mio.dice === 'voy';
    const dicho = va
      ? (e.convocado ? 'Confirmado' : 'Vas al partido')
      : (e.hayLista ? 'De baja' : 'No vas al partido');
    // Debajo, en pequeño, la opción contraria: darse de baja o volver a apuntarse.
    const contraria = va
      ? { dice: 'no', texto: e.hayLista ? 'Darse de baja' : 'No voy' }
      : { dice: 'voy', texto: e.convocado ? 'Vuelvo a estar disponible' : 'Voy' };
    return pintar(caja,
      h('span', { class: 'estado-voy', text: `${va ? '✓' : '✗'} ${dicho}` }),
      h('button', {
        type: 'button', class: `secundaria-voy ${contraria.dice}`,
        onclick: () => guardarPrelista(p, contraria.dice),
      }, contraria.texto),
      e.suplente && va ? h('span', { class: 'cambiar-voy', text: e.aclaracion }) : null);
  }

  pintar(caja,
    h('span', { class: 'pregunta-voy', text: e.pregunta }),
    h('span', { class: 'botones-voy' },
      h('button', { type: 'button', class: 'chip-voy', onclick: () => guardarPrelista(p, 'voy') }, `✓ ${e.si}`),
      e.suplente ? null : h('button', { type: 'button', class: 'chip-voy no', onclick: () => guardarPrelista(p, 'no') }, `✗ ${e.no}`)),
    e.suplente ? h('span', { class: 'aclara-voy', text: e.aclaracion }) : null);
}

/** Prelista: la hacen los jugadores diciendo si van o no. La ve todo el equipo. */
function bloquePrelista(p) {
  if (!p || p.finalizado || !hayHoja()) return null;
  const lista = estado.hoja?.prelista?.[p.id] || [];
  const van = lista.filter((x) => x.dice === 'voy' && jugadorPorId(x.id));
  const no = lista.filter((x) => x.dice === 'no' && jugadorPorId(x.id));
  const yo = yoSoy();
  const mio = yo && lista.find((x) => x.id === yo.id);

  const apuntar = (dice) => guardarPrelista(p, dice === mio?.dice ? 'quitar' : dice);
  const e = etiquetasVoy(p);
  const r = resumenConfirmaciones(p);
  return h('div', { class: 'prelista' },
    h('h3', { class: 'subtitulo' }, r ? 'Confirmaciones' : 'Prelista',
      h('small', { text: r ? ' · quién ha confirmado, por orden' : ' · quién dice que va, por orden' })),
    r
      ? [h('p', { class: 'recuento-conf' },
          h('strong', { text: `${r.confirmados.length} de ${r.total} confirmados` }),
          r.bajas.length ? h('span', { class: 'baja-conf', text: ` · ${plural(r.bajas.length, 'baja', 'bajas')}` }) : null,
          r.faltan.length ? h('span', { class: 'apagado', text: ` · ${r.faltan.length} sin contestar` }) : null),
         r.faltan.length
           ? h('p', { class: 'apagado', text: `Falta por contestar: ${r.faltan.map((id) => nombreCorto(jugadorPorId(id))).filter(Boolean).join(', ')}.` })
           : null]
      : null,
    van.length
      ? h('ol', { class: 'chips numerada' }, van.map((x) => {
          const j = jugadorPorId(x.id);
          return h('li', {}, h('span', { class: 'chip' },
            h('span', { class: 'dorsal', text: j.dorsal ?? '–' }), nombreCorto(j)));
        }))
      : h('p', { class: 'apagado', text: 'Todavía no se ha apuntado nadie.' }),
    no.length
      ? h('ul', { class: 'chips' }, no.map((x) => {
          const j = jugadorPorId(x.id);
          return h('li', {}, h('span', { class: 'chip no' },
            h('span', { class: 'dorsal', text: j.dorsal ?? '–' }), nombreCorto(j)));
        }))
      : null,
    !yo
      ? h('p', { class: 'apagado', text: 'Identifícate para apuntarte (se pregunta al entrar).' })
      : e.cerrado && !mio
        ? h('p', { class: 'apagado', text: 'No estás en la lista del cuerpo técnico. Si alguien se cae, aquí podrás ofrecerte.' })
        : [h('div', { class: 'fila-acciones' },
            h('button', { type: 'button', class: `boton${mio?.dice === 'voy' ? '' : '-secundario'}`, onclick: () => apuntar('voy') },
              mio?.dice === 'voy' ? `✓ ${e.si}` : e.si),
            e.suplente && !mio
              ? null
              : h('button', { type: 'button', class: `boton${mio?.dice === 'no' ? '' : '-secundario'}`, onclick: () => apuntar('no') },
                  mio?.dice === 'no' ? `✗ ${e.no}` : e.no)),
           e.suplente ? h('p', { class: 'apagado', text: `${e.aclaracion}: entras en el sitio de alguien que se ha caído.` }) : null]);
}

async function guardarPrelista(p, dice) {
  const yo = yoSoy();
  if (!yo) return;
  const r = await enviarHoja(CONFIG.hoja, {
    accion: 'apuntarse', pinEquipo: recuperar(CLAVE_EQUIPO) || '',
    partidoId: p.id, fecha: p.fecha ? isoDe(p.fecha) : '', rival: rivalDe(p).nombre,
    jugadorId: yo.id, dice,
  }).catch(() => null);
  if (r?.ok) {
    aviso(dice === 'quitar' ? 'Te has borrado de la prelista' : dice === 'voy' ? '¡Apuntado! ✓' : 'Apuntado como que no vas');
    cargarHoja();
  } else {
    aviso('No se ha podido guardar. Inténtalo de nuevo.', true);
  }
}

/** Un botón que abre WhatsApp con el aviso del partido ya escrito. */
function avisoWhatsApp(p) {
  if (!p || p.finalizado || !permitido('convocar')) return null;
  const cuando = p.fecha ? `${diaPartido(p.fecha)} a las ${horaPartido(p.fecha)}` : 'fecha por confirmar';
  const donde = p.lugar?.nombre ? ` en ${p.lugar.nombre}` : '';
  const texto = `🐾 Black Panthers — ${p.jornada ? `Jornada ${p.jornada}` : 'Partido'} vs ${rivalDe(p).nombre}\n`
    + `📅 ${cuando}${donde}\n\n`
    + `Apúntate en la web: ${location.origin}${location.pathname}`;
  return h('a', {
    class: 'boton-secundario', target: '_blank', rel: 'noopener',
    href: `https://wa.me/?text=${encodeURIComponent(texto)}`,
  }, icono('whatsapp'), 'Avisar por WhatsApp');
}

/** La lista de convocados, dentro de un desplegable con la jornada. */
function desplegableConvocatoria(p, g, { abierto = false } = {}) {
  const cuantos = p.finalizado ? g.convocados.length : g.convocados.length + g.noVienen.length;
  return h('details', { class: 'conv-desplegable', open: abierto },
    h('summary', {},
      h('span', { class: 'jornada-conv', text: etiquetaPartido(p) }),
      h('span', { class: `cuantos-conv${p.finalizado ? ' vinieron' : ''}`, text: p.finalizado ? plural(g.convocados.length, 'vino', 'vinieron') : plural(cuantos, 'respuesta', 'respuestas') })),
    h('div', { class: 'convocatoria compacta' },
      g.deActa ? h('p', { class: 'apagado', text: 'Según el acta de CopaFácil' }) : null,
      listasConvocatoria(p, g)));
}

function listasConvocatoria(p, g) {
  const pasado = p.finalizado;
  const grupo = (titulo, ids, tipo) => (ids.length
    ? h('div', { class: `grupo-conv ${tipo}` },
        h('h3', { text: `${titulo} (${ids.length})` }),
        h('ul', { class: 'chips' }, ids.map((id) => chipJugador(id, tipo))))
    : null);
  return [
    grupo(pasado ? 'Vinieron' : 'Convocados', g.convocados, 'si'),
    grupo(pasado ? 'No vinieron' : 'No vienen', g.noVienen, 'rojo'),
    grupo('No convocados', g.noConvocados, 'no'),
  ];
}

const etiquetaPartido = (p) => `Jornada ${p.jornada ?? '–'} · vs ${rivalDe(p).nombre}` +
  (p.finalizado ? ` (${p.golesLocal}-${p.golesVisitante})` : p.fecha ? ` · ${diaPartido(p.fecha)}` : '');

function pintarConvocatoriaProxima() {
  const caja = $('#convocatoria-proxima');
  const selector = $('#convocatoria-partido');
  const partidos = estado.cf?.partidos || [];
  if (!partidos.length) {
    selector.hidden = true;
    return pintar(caja, vacio(estado.cf ? 'No hay partidos en el calendario.' : 'Cargando partidos…'));
  }
  const proximo = proximoPartido();
  if (!partidos.some((x) => x.id === estado.partidoConvocatoria)) {
    estado.partidoConvocatoria = (proximo || partidos[partidos.length - 1]).id;
  }
  selector.hidden = false;
  pintar(selector, partidos.map((x) => h('option', {
    value: x.id, text: `${etiquetaPartido(x)}${x === proximo ? ' — próximo' : ''}`,
  })));
  selector.value = estado.partidoConvocatoria;
  selector.onchange = () => { estado.partidoConvocatoria = selector.value; pintarConvocatoriaProxima(); };

  const p = partidos.find((x) => x.id === estado.partidoConvocatoria);
  if (!hayHoja()) return pintar(caja, vacio('La convocatoria se hará desde aquí en cuanto se conecte la hoja del equipo.'));
  const g = gruposConvocatoria(p);
  const boton = permitido('convocar')
    ? h('div', { class: 'fila-acciones' }, botonStaff(g && !g.deActa ? 'Editar convocatoria' : 'Hacer convocatoria', () => abrirConvocatoria(p), 'boton', 'convocar'))
    : null;
  const pista = !permitido('convocar')
    ? h('p', { class: 'pista-staff', text: 'Para editarla: botón «Staff» (candado, arriba a la derecha) con el PIN del míster.' })
    : null;
  pintar(caja,
    bloquePrelista(p),
    h('h3', { class: 'subtitulo', text: 'Lista definitiva del cuerpo técnico' }),
    g
      ? [desplegableConvocatoria(p, g, { abierto: true }),
         g.deActa ? h('p', { class: 'apagado', text: 'Sin convocatoria del staff: se muestra la alineación del acta de CopaFácil.' }) : null]
      : vacio('El cuerpo técnico todavía no ha hecho la lista.'),
    boton, avisoWhatsApp(p), pista, bloqueVotacion(p));
}

function tile({ valor, sufijo, etiqueta, detalle, destacado, extra, clase }) {
  return h('div', { class: `tile${destacado ? ' destacado' : ''}${clase ? ` ${clase}` : ''}` },
    h('div', { class: 'valor' }, String(valor), sufijo ? h('small', { text: sufijo }) : null),
    h('div', { class: 'etiqueta-tile', text: etiqueta }),
    detalle ? h('div', { class: 'detalle', text: detalle }) : null,
    extra || null);
}

function pintarEstadisticas() {
  const caja = $('#stats-equipo');
  const eq = estado.cf?.equipo;
  if (!eq) return pintar(caja, vacio(estado.errorCf ? 'No se han podido leer las estadísticas de CopaFácil.' : 'Cargando…'));

  const porPartido = (n) => (eq.j ? `${(n / eq.j).toLocaleString('es-ES', { maximumFractionDigits: 1 })} por partido` : '');
  const total = eq.g + eq.e + eq.p;
  const barra = total
    ? h('div', { class: 'gep', role: 'img', 'aria-label': `${eq.g} ganados, ${eq.e} empatados, ${eq.p} perdidos` },
        ['g', 'e', 'p'].map((k) => (eq[k] ? h('span', { class: k, style: `width:${(eq[k] / total) * 100}%` }) : null)))
    : null;

  const tiles = [
    tile({ valor: `${eq.pos}º`, sufijo: `de ${estado.cf.totalEquipos}`, etiqueta: 'Posición', detalle: estado.cf.liga.grupo, destacado: true }),
    tile({ valor: eq.pts, etiqueta: 'Puntos', detalle: `${eq.g} G · ${eq.e} E · ${eq.p} P`, extra: barra }),
    tile({ valor: eq.j, etiqueta: 'Partidos jugados' }),
    tile({ valor: eq.gf, etiqueta: 'Goles a favor', detalle: porPartido(eq.gf), clase: 'a-favor' }),
    tile({ valor: eq.gc, etiqueta: 'Goles en contra', detalle: porPartido(eq.gc), clase: 'en-contra' }),
    tile({ valor: eq.ta + eq.tr, etiqueta: 'Tarjetas', detalle: `${eq.ta} amarillas · ${eq.tr} rojas` }),
  ];

  const activos = jugadores();
  const suma = (porJugador) => activos.reduce((s, j) => s + (porJugador[j.id] || 0), 0);
  const media = (n) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${n === 1 ? 'jugador' : 'jugadores'}`;

  if (estado.hoja) {
    const les = (estado.hoja.lesiones || []).filter((l) => jugadorPorId(l.id)?.activo !== false);
    const bajas = les.filter((l) => l.estado === 'baja').length;
    tiles.push(tile({ valor: les.length, etiqueta: 'Lesionados', detalle: les.length ? `${bajas} baja · ${les.length - bajas} duda` : 'Todos disponibles' }));
  }

  const ap = asistenciaPartidos();
  const enPartidos = suma(ap.porJugador);
  tiles.push(ap.partidos && activos.length
    ? tile({
        valor: Math.round((enPartidos / (ap.partidos * activos.length)) * 100), sufijo: '%', etiqueta: 'Asistencia a partidos',
        detalle: `${media(enPartidos / ap.partidos)} por partido · ${ap.partidos} ${ap.partidos === 1 ? 'partido' : 'partidos'}`,
      })
    : tile({ valor: '–', etiqueta: 'Asistencia a partidos', detalle: 'Sin datos de quién vino' }));

  if (estado.hoja) {
    const { sesiones = 0, porJugador = {} } = estado.hoja.entrenos || {};
    const asistencias = suma(porJugador);
    const plantilla = activos.length || 1;
    tiles.push(sesiones
      ? tile({
          valor: Math.round((asistencias / (sesiones * plantilla)) * 100), sufijo: '%', etiqueta: 'Asistencia a entrenos',
          detalle: `${media(asistencias / sesiones)} por entreno · ${sesiones} ${sesiones === 1 ? 'entreno' : 'entrenos'}`,
        })
      : tile({ valor: '–', etiqueta: 'Asistencia a entrenos', detalle: 'Aún no se ha pasado lista' }));
  }
  pintar(caja, tiles);
}

const celda = (n) => h('td', { class: n ? '' : 'cero', text: n });

function celdaPorcentaje(n, de, que) {
  if (!de) return h('td', { class: 'cero', text: '–' });
  const pct = Math.round((n / de) * 100);
  return h('td', {}, h('span', { class: 'barra-asistencia', title: `${n} de ${de} ${que}` },
    h('span', { class: 'pista' }, h('span', { class: 'relleno', style: `width:${pct}%` })), `${pct}%`));
}

function pintarPlantilla() {
  const cuerpo = $('#plantilla tbody');
  // La nota del MVP solo la ven el cuerpo técnico y el administrador.
  const verNotas = permitido('notas');
  $('#th-nota').hidden = !verNotas;
  pintar($('#staff-plantilla'), botonStaff('Editar plantilla', abrirPlantilla));
  const lista = jugadores();
  const inactivos = plantillaCompleta().filter((j) => !j.activo);
  pintar($('#nota-plantilla'), permitido('jugador') && inactivos.length
    ? [`No activos (no salen en estadísticas): `, inactivos.map((j) =>
        h('button', { type: 'button', class: 'enlace-inactivo', onclick: () => abrirJugador(j.id) }, `${j.nombre} ✎`))]
    : null);
  if (!lista.length) {
    return pintar(cuerpo, h('tr', {}, h('td', { colspan: verNotas ? 11 : 10, class: 'izq' }, vacio(estado.errorCf ? 'No se ha podido cargar la plantilla.' : 'Cargando plantilla…'))));
  }
  const { sesiones = 0, porJugador = {} } = estado.hoja?.entrenos || {};
  const ap = asistenciaPartidos();
  pintar(cuerpo, lista.map((j) => {
    const pj = ap.partidos ? ap.porJugador[j.id] || 0 : j.j;
    const faltas = ap.faltas[j.id] || 0;
    const marcas = marcasJugador(j);
    return h('tr', { class: marcas.some((m) => m.classList.contains('no-viene')) ? 'fila-no-viene' : '' },
      h('td', { class: 'num', text: j.dorsal ?? '–' }),
      h('td', { class: 'izq' },
        h('div', { class: 'jugador-celda pulsable', role: 'button', tabindex: '0',
          title: `Ver la ficha de ${j.nombre}`,
          onclick: (ev) => { if (!ev.target.closest('.editar-jugador')) abrirFicha(j.id); },
          onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirFicha(j.id); } } },
          imagen(j.foto),
          h('div', { class: 'datos-jugador' },
            h('div', { class: 'nombre', text: j.nombre }),
            (() => {
              const visibles = rolesDe(j).filter((r) => ROLES_PLANTILLA.includes(r)).map((r) => ETIQUETA_ROL[r] || r);
              return visibles.length ? h('div', { class: 'roles-jugador', text: visibles.join(' · ') }) : null;
            })(),
            h('div', { class: 'marcas' }, marcas)),
          permitido('jugador') ? h('button', { type: 'button', class: 'editar-jugador', 'aria-label': `Editar a ${j.nombre}`, title: 'Editar ficha', onclick: () => abrirJugador(j.id) }, '✎') : null)),
      celda(pj),
      celdaPorcentaje(ap.porJugador[j.id] || 0, ap.partidos, 'partidos'),
      h('td', { class: faltas ? 'falta-roja' : 'cero', text: faltas, title: faltas ? `Faltas de asistencia: no vino a ${faltas} ${faltas === 1 ? 'partido' : 'partidos'}` : null }),
      h('td', { class: j.goles ? 'goles-a-favor' : 'cero', text: j.goles }),
      celdaPorcentaje(porJugador[j.id] || 0, sesiones, 'entrenos'),
      celda(j.ta), celda(j.tr),
      (() => {
        const m = medallasMvp(j.id);
        const medalla = (n, cual) => (n ? h('span', { class: 'medalla-cuenta' }, icono(cual), String(n)) : null);
        return h('td', { class: m.total ? 'trofeos' : 'cero', title: m.total ? `${m.oro} de oro · ${m.plata} de plata · ${m.bronce} de bronce` : 'Todavía no ha subido al podio' },
          m.total ? [medalla(m.oro, 'trofeo'), medalla(m.plata, 'plata'), medalla(m.bronce, 'bronce')] : '–');
      })(),
      verNotas
        ? (() => { const m = mvpJugador(j.id); return h('td', { class: m.nota === null ? 'cero' : 'nota-mvp', text: nota1(m.nota), title: m.partidos ? `${m.estrellas} ★ en ${plural(m.partidos, 'partido', 'partidos')}` : 'Sin votos todavía' }); })()
        : null);
  }));
}

function pintarLesionados() {
  const caja = $('#lesionados');
  pintar($('#staff-lesionados'), botonStaff('Editar bajas y lesiones', abrirPlantilla));
  if (!estado.hoja) return pintar(caja, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA));
  const lista = estado.hoja.lesiones || [];
  if (!lista.length) return pintar(caja, vacio('Nadie en la enfermería. ¡Así da gusto!'));
  pintar(caja, h('ul', { class: 'lista-lesionados' }, lista.map((l) => {
    const j = jugadorPorId(l.id);
    const detalle = [l.detalle, esIso(l.vuelta) ? `Vuelta prevista: ${diaHoja(l.vuelta, { day: 'numeric', month: 'long' })}` : '']
      .filter(Boolean).join(' · ');
    return h('li', { class: 'lesionado' },
      imagen(j?.foto),
      h('div', { class: 'info' }, h('div', { class: 'nombre', text: j?.nombre || l.nombre }), detalle ? h('div', { class: 'detalle', text: detalle }) : null),
      h('span', { class: `estado ${l.estado}` }, icono(l.estado === 'duda' ? 'duda' : 'cruz'), l.estado === 'duda' ? 'Duda' : 'Baja'));
  })));
}

/* Votación al MVP del partido: la hacen los jugadores, sin PIN. Se cierra dos días después. */

const CLAVE_YO = 'bp_yo';
const DIAS_VOTACION = 2;

let votacion = null; // { partido, votos: Map(id → estrellas) }

const votosDe = (partidoId) => estado.hoja?.votos?.[partidoId] || { totales: {}, veces: {}, votantes: [] };
const yoSoy = () => jugadorPorId(recuperar(CLAVE_YO));

/** La votación se cierra dos días después del partido (contando el día del partido). */
function votacionAbierta(p) {
  if (!p?.finalizado || !p.fecha) return false;
  return diasEntre(isoDe(p.fecha), hoyIso()) <= DIAS_VOTACION;
}

/**
 * Nota sobre 10: las estrellas recibidas entre todas las que podía recibir,
 * es decir 3 por cada compañero que votó (quitándose a sí mismo). Un 10
 * significa que TODOS los que votaron le dieron las tres estrellas. Así la
 * nota y el puesto en el podio van siempre de la mano.
 */
function notasPartido(partidoId) {
  const { totales, votantes } = votosDe(partidoId);
  const total = Object.values(totales).reduce((s, n) => s + n, 0);
  const posibles = (id) => (votantes || []).filter((v) => v !== id).length * 3;
  return {
    total,
    nota: (id) => {
      const estrellas = totales[id] || 0;
      const tope = posibles(id);
      if (!estrellas || !tope) return null;
      return (estrellas / tope) * 10;
    },
  };
}

/** Resumen de la temporada de un jugador: nota media, estrellas y partidos votado. */
function mvpJugador(id) {
  let estrellas = 0;
  let posibles = 0; // todo lo que podía recibir en esos partidos
  let partidos = 0;
  Object.keys(estado.hoja?.votos || {}).forEach((partidoId) => {
    const { totales, votantes } = votosDe(partidoId);
    if (!totales[id]) return;
    estrellas += totales[id];
    posibles += (votantes || []).filter((v) => v !== id).length * 3;
    partidos++;
  });
  return { nota: posibles ? (estrellas / posibles) * 10 : null, estrellas, partidos };
}

const nota1 = (n) => (n === null || n === undefined ? '–' : n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Los tres más votados, con su nota. */
function podio(partidoId) {
  const { totales } = votosDe(partidoId);
  const { nota } = notasPartido(partidoId);
  return Object.entries(totales)
    .map(([id, estrellas]) => ({ j: jugadorPorId(id), estrellas, nota: nota(id) }))
    .filter((x) => x.j)
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0) || b.estrellas - a.estrellas)
    .slice(0, 3);
}

const mvpDesignado = (partidoId) => jugadorPorId(estado.hoja?.mvp?.[partidoId]);

/** El MVP de un partido: el que designó el cuerpo técnico o, si no, el más votado. */
function mvpDe(p) {
  if (!p) return null;
  const aMano = mvpDesignado(p.id);
  if (aMano) {
    const { nota } = notasPartido(p.id);
    return { j: aMano, estrellas: votosDe(p.id).totales[aMano.id] || 0, nota: nota(aMano.id), aMano: true };
  }
  return podio(p.id)[0] || null;
}

/**
 * El podio de un partido, de oro a bronce. Si el MVP lo puso el cuerpo técnico,
 * ese va primero y detrás los más votados.
 */
function puestosPartido(p) {
  const mejor = mvpDe(p);
  const lista = mejor ? [mejor.j.id] : [];
  podio(p.id).forEach((x) => { if (!lista.includes(x.j.id)) lista.push(x.j.id); });
  return lista.slice(0, 3);
}

/** Medallero de un jugador. Lo ve todo el equipo: son trofeos, no notas. */
function medallasMvp(id) {
  const m = [0, 0, 0];
  (estado.cf?.partidos || []).forEach((p) => {
    if (!p.finalizado) return;
    const puesto = puestosPartido(p).indexOf(id);
    if (puesto >= 0) m[puesto]++;
  });
  return { oro: m[0], plata: m[1], bronce: m[2], total: m[0] + m[1] + m[2] };
}

/** El MVP del último partido votado, para verlo nada más entrar en Competición. */
function ultimoMvp() {
  const jugados = (estado.cf?.partidos || []).filter((x) => x.finalizado);
  for (let i = jugados.length - 1; i >= 0; i--) {
    const puestos = puestosPartido(jugados[i]);
    if (puestos.length) return { partido: jugados[i], puestos };
  }
  return null;
}

/** «Victor David M.»: el nombre entero y la inicial del apellido. */
function nombrePila(j) {
  const partes = String(j.nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] || '';
  const apellido = partes[partes.length - 1];
  return `${partes.slice(0, -1).join(' ')} ${apellido[0].toUpperCase()}.`;
}

/** El podio del último partido jugado, arriba en Competición. Se queda hasta el siguiente. */
function pintarMvpMini() {
  const caja = $('#mvp-mini');
  const r = ultimoMvp();
  caja.hidden = !r;
  if (!r) return;
  const { partido: p, puestos } = r;
  const { nota } = notasPartido(p.id);
  const abierta = votacionAbierta(p);
  const iconos = ['trofeo', 'plata', 'bronce'];
  caja.title = `Podio${p.jornada ? ` de la jornada ${p.jornada}` : ''} · vs ${rivalDe(p).nombre}`;

  const puesto = (id, i) => {
    const j = jugadorPorId(id);
    if (!j) return null;
    const n = nota(id);
    return h('li', { class: `puesto p${i + 1}` },
      icono(iconos[i]),
      imagen(j.foto),
      h('span', { class: 'nombre', text: nombrePila(j) }),
      h('span', { class: 'nota', text: n === null || n === undefined ? '–' : nota1(n) }));
  };

  // En una fila y con el ganador en medio, como un cajón de verdad.
  const orden = puestos.length === 3 ? [[puestos[1], 1], [puestos[0], 0], [puestos[2], 2]]
    : puestos.length === 2 ? [[puestos[1], 1], [puestos[0], 0]]
      : [[puestos[0], 0]];
  pintar(caja,
    h('p', { class: 'titulo-podio' },
      `Podio${p.jornada ? ` J${p.jornada}` : ''}`,
      abierta ? h('small', { text: ' · votación abierta' }) : null),
    h('ol', { class: `podio-mini de-${orden.length}` }, orden.map(([id, i]) => puesto(id, i))));
}

/** Desplegable "VOTA AL MVP" de un partido ya jugado. */
function bloqueVotacion(p, { abierto = false } = {}) {
  if (!p?.finalizado || !hayHoja()) return null;
  const { votantes } = votosDe(p.id);
  const yo = yoSoy();
  const yaVote = yo && votantes.includes(yo.id);
  const tres = podio(p.id);
  const mejor = mvpDe(p);
  const sePuede = votacionAbierta(p);

  return h('details', { class: 'votacion', open: abierto || (sePuede && !tres.length) },
    h('summary', {},
      h('span', { class: 'titulo-votacion' },
        mejor ? imagen(mejor.j.foto, '', 'foto-mvp') : icono('estrella'),
        h('span', { class: 'texto-votacion' },
          h('span', { class: 'que', text: sePuede ? 'Vota al MVP' : 'MVP del partido' }),
          mejor ? h('span', { class: 'ganador', text: nombreCorto(mejor.j) }) : null)),
      h('span', { class: 'apagado', text: votantes.length ? plural(votantes.length, 'voto', 'votos') : 'sin votos' })),
    h('div', { class: 'cuerpo-votacion' },
      h('p', { class: 'apagado', text: `${p.jornada ? `Jornada ${p.jornada} · ` : ''}vs ${rivalDe(p).nombre}` }),
      tres.length
        ? h('ol', { class: 'podio' }, tres.map((x, i) =>
            h('li', { class: `puesto-${i + 1}` },
              h('span', { class: 'medalla' }, icono(['trofeo', 'plata', 'bronce'][i])),
              imagen(x.j.foto),
              h('span', { class: 'nombre', text: nombreCorto(x.j) }),
              h('span', { class: 'nota' }, nota1(x.nota), h('small', { class: 'de-diez', text: '/10' })),
              h('span', { class: 'estrellas', text: `${x.estrellas} ★` }))))
        : h('p', { class: 'apagado', text: sePuede ? 'Todavía no ha votado nadie. ¡Sé el primero!' : 'Nadie votó en este partido.' }),
      mejor?.aMano
        ? h('p', { class: 'designado', text: `MVP del partido: ${mejor.j.nombre}, elegido por el cuerpo técnico.` })
        : null,
      permitido('mvp') ? selectorMvp(p) : null,
      sePuede
        ? h('div', { class: 'fila-acciones' },
            h('button', { type: 'button', class: 'boton', onclick: () => abrirVotacion(p) }, yaVote ? 'Cambiar mi voto' : 'Votar'),
            h('span', { class: 'apagado', text: `Se cierra ${cuantoFaltaCierre(p)}` }))
        : h('p', { class: 'apagado', text: 'La votación está cerrada (se cierra dos días después del partido).' })));
}

/** El cuerpo técnico designa al MVP de un partido (útil si no hubo votación). */
function selectorMvp(p) {
  const actual = mvpDesignado(p.id);
  return h('label', { class: 'elegir-mvp' },
    h('span', { text: 'MVP a mano:' }),
    h('select', { onchange: (ev) => guardarMvp(p, ev.target.value) },
      h('option', { value: '', text: '— Sin designar —', selected: !actual }),
      jugadores().map((j) => h('option', { value: j.id, text: `${j.dorsal ?? '–'} · ${j.nombre}`, selected: actual?.id === j.id }))));
}

async function guardarMvp(p, jugadorId) {
  const r = await enviarHoja(CONFIG.hoja, {
    accion: 'mvp', pin: recuperar(CLAVE_PIN),
    partidoId: p.id, jornada: p.jornada || '', rival: rivalDe(p).nombre, jugadorId,
  }).catch(() => null);
  if (r?.ok) {
    aviso(jugadorId ? `MVP: ${jugadorPorId(jugadorId)?.nombre} ✓` : 'MVP quitado ✓');
    cargarHoja();
  } else {
    aviso('No se ha podido guardar el MVP', true);
  }
}

function cuantoFaltaCierre(p) {
  const quedan = DIAS_VOTACION - diasEntre(isoDe(p.fecha), hoyIso());
  return quedan <= 0 ? 'hoy' : quedan === 1 ? 'mañana' : `en ${quedan} días`;
}

function estrellasJugador(id) {
  const puestas = votacion.votos.get(id) || 0;
  return h('span', { class: 'estrellas-voto' }, [1, 2, 3].map((n) =>
    h('button', {
      type: 'button', class: `estrella${n <= puestas ? ' puesta' : ''}`,
      'aria-label': `${n} ${n === 1 ? 'estrella' : 'estrellas'}`, 'aria-pressed': String(n <= puestas),
      onclick: () => {
        if (n === (votacion.votos.get(id) || 0)) votacion.votos.delete(id);
        else votacion.votos.set(id, n);
        pintarVotacion();
      },
    }, '★')));
}

function pintarVotacion() {
  const yo = yoSoy();
  const { partido } = votacion;
  $('#votar-quien').hidden = Boolean(yo);
  $('#votar-lista-caja').hidden = !yo;
  $('#votar-guardar').hidden = !yo;
  if (!yo) {
    const selector = $('#votar-yo');
    if (!selector.options.length) {
      pintar(selector, h('option', { value: '', text: '— Elige tu nombre —' }),
        jugadores().map((j) => h('option', { value: j.id, text: `${j.dorsal ?? '–'} · ${j.nombre}` })));
    }
    return;
  }
  // Se vota a quien jugó (según la convocatoria del staff); si no la hay, a toda la plantilla.
  const g = gruposConvocatoria(partido);
  const jugaron = g && !g.deActa && g.convocados.length ? g.convocados : jugadores().map((x) => x.id);
  const candidatos = jugadores().filter((j) => j.id !== yo.id && jugaron.includes(j.id));
  pintar($('#votar-lista'), candidatos.map((j) =>
    h('li', {},
      imagen(j.foto),
      h('span', { class: 'nombre' }, h('span', { class: 'dorsal-mini', text: j.dorsal ?? '' }), j.nombre),
      estrellasJugador(j.id))));
  const estrellas = [...votacion.votos.values()].reduce((s, n) => s + n, 0);
  $('#votar-contador').textContent = `${plural(votacion.votos.size, 'jugador votado', 'jugadores votados')} · ${estrellas} ★`;
}

function abrirVotacion(p) {
  if (!votacionAbierta(p)) return aviso('La votación de ese partido está cerrada', true);
  votacion = { partido: p, votos: new Map() };
  $('#dlg-votar-partido').textContent = `${p.jornada ? `Jornada ${p.jornada} · ` : ''}vs ${rivalDe(p).nombre}`;
  $('#votar-yo').value = yoSoy()?.id || '';
  pintarVotacion();
  $('#dlg-votar').showModal();
}

function elegirmeComoVotante() {
  const id = $('#votar-yo').value;
  if (!id) return aviso('Elige tu nombre', true);
  guardar(CLAVE_YO, id);
  pintarVotacion();
}

async function guardarVoto() {
  const yo = yoSoy();
  if (!yo) return;
  if (!votacion.votos.size) return aviso('Pon estrellas a alguien antes de guardar', true);
  const votos = [...votacion.votos].map(([id, estrellas]) => ({ id, estrellas }));
  const ok = await conBotonOcupado($('#votar-guardar'), async () => {
    try {
      const r = await enviarHoja(CONFIG.hoja, {
        accion: 'votar',
        pinEquipo: recuperar(CLAVE_EQUIPO) || '',
        partidoId: votacion.partido.id,
        fecha: votacion.partido.fecha ? isoDe(votacion.partido.fecha) : '',
        votanteId: yo.id,
        votos,
      });
      if (r.ok) {
        aviso('¡Voto guardado! ✓');
        cargarHoja();
        return true;
      }
      aviso(r.error === 'votacion_cerrada' ? 'La votación ya está cerrada' : 'No se ha podido guardar el voto', true);
    } catch {
      aviso('Sin conexión con la hoja. Inténtalo de nuevo.', true);
    }
    return false;
  });
  if (ok) $('#dlg-votar').close();
}

/* Aspectos a mejorar y puntos fuertes: del equipo y de cada jugador */

function pintarValoraciones(tipo) {
  const caja = $(`#${tipo}`);
  pintar($(`#staff-${tipo}`), botonStaff('Editar', () => abrirEditorLista(tipo)));
  const lista = estado.hoja?.[tipo] || [];
  const titulo = tipo === 'mejorar' ? 'Nada que destacar por ahora.' : 'Todavía no hay puntos fuertes apuntados.';
  if (!lista.length) return pintar(caja, vacio(estado.hoja ? titulo : SIN_HOJA));

  const equipo = lista.filter((x) => !x.jugadorId && !x.nombre);
  const individuales = lista.filter((x) => x.jugadorId || x.nombre);
  pintar(caja,
    equipo.length
      ? h('ol', { class: 'lista-mejorar' }, equipo.map((m) =>
          h('li', {}, h('div', {}, h('strong', { text: m.aspecto }), m.detalle ? h('p', { text: m.detalle }) : null))))
      : null,
    individuales.length
      ? h('div', { class: 'valoraciones-jugadores' },
          h('h3', { class: 'subtitulo', text: 'Jugador a jugador' }),
          h('ul', { class: 'comentarios-jugadores' }, individuales.map((m) => {
            const j = jugadorPorId(m.jugadorId);
            return h('li', {},
              imagen(j?.foto),
              h('div', {},
                h('div', { class: 'nombre' }, h('span', { class: 'dorsal-mini', text: j?.dorsal ?? '' }), j?.nombre || m.nombre),
                h('p', {}, h('strong', { text: m.aspecto }), m.detalle ? `: ${m.detalle}` : '')));
          })))
      : null);
}

/* Ficha de un jugador: la ve todo el mundo al tocarlo en la plantilla */

function datoFicha(valor, etiqueta, detalle) {
  return h('div', { class: 'dato-ficha' },
    h('div', { class: 'valor', text: valor }),
    h('div', { class: 'etiqueta-tile', text: etiqueta }),
    detalle ? h('div', { class: 'detalle', text: detalle }) : null);
}

function abrirFicha(id) {
  const j = jugadorPorId(id);
  if (!j) return;
  const ap = asistenciaPartidos();
  const { sesiones = 0, porJugador = {} } = estado.hoja?.entrenos || {};
  const pj = ap.partidos ? ap.porJugador[id] || 0 : j.j;
  const faltas = ap.faltas[id] || 0;
  const entrenos = porJugador[id] || 0;
  const pct = (n, de) => (de ? `${Math.round((n / de) * 100)}%` : '–');
  const lesion = lesionDe(id);
  const roles = rolesDe(j).map((r) => ETIQUETA_ROL[r] || r);

  pintar($('#ficha-cabecera'),
    imagen(j.foto, '', 'foto-ficha'),
    h('div', {},
      h('h2', { id: 'dlg-ficha-titulo' }, h('span', { class: 'dorsal-mini', text: j.dorsal ?? '' }), j.nombre),
      roles.length ? h('p', { class: 'roles-jugador', text: roles.join(' · ') }) : null,
      h('div', { class: 'marcas' }, marcasJugador(j))));

  const comentarios = (estado.hoja?.comentarios || []).filter((c) => c.jugadorId === id);
  const suyos = (tipo) => (estado.hoja?.[tipo] || []).filter((x) => x.jugadorId === id);
  const mejorar = suyos('mejorar');
  const fuertes = suyos('fuertes');

  pintar($('#ficha-contenido'),
    h('div', { class: 'datos-ficha' },
      datoFicha(pj, 'Partidos', ap.partidos ? `de ${ap.partidos}` : ''),
      datoFicha(pct(pj, ap.partidos), '% partidos'),
      datoFicha(faltas, 'Faltas de asistencia'),
      datoFicha(entrenos, 'Entrenos', sesiones ? `de ${sesiones}` : ''),
      datoFicha(pct(entrenos, sesiones), '% entrenos'),
      datoFicha(j.goles, 'Goles'),
      datoFicha(j.ta, 'Amarillas'),
      datoFicha(j.tr, 'Rojas'),
      hayHoja() ? datoFicha(vecesConvocado(id), 'Convocatorias') : null,
      (() => {
        const m = medallasMvp(id);
        const partes = [m.plata ? `${m.plata} de plata` : null, m.bronce ? `${m.bronce} de bronce` : null].filter(Boolean);
        return datoFicha(m.oro, 'Trofeos MVP', partes.length ? partes.join(' · ') : m.oro ? 'mejor jugador del partido' : 'todavía ninguno');
      })(),
      // La nota es solo para el cuerpo técnico: ni la suya propia ven los jugadores.
      permitido('notas')
        ? (() => { const m = mvpJugador(id); return datoFicha(nota1(m.nota), 'Nota MVP', m.partidos ? `${m.estrellas} ★ · ${plural(m.partidos, 'partido', 'partidos')}` : 'sin votos'); })()
        : null),
    lesion
      ? h('p', { class: 'aviso-ficha', text: `${lesion.estado === 'duda' ? 'Duda' : 'Baja'}${lesion.detalle ? `: ${lesion.detalle}` : ''}${esIso(lesion.vuelta) ? ` · vuelta prevista ${diaHoja(lesion.vuelta, { day: 'numeric', month: 'long' })}` : ''}` })
      : null,
    fuertes.length
      ? h('section', {}, h('h3', { class: 'subtitulo', text: 'Puntos fuertes' }),
          h('ul', { class: 'lista-ficha' }, fuertes.map((x) => h('li', {}, h('strong', { text: x.aspecto }), x.detalle ? `: ${x.detalle}` : ''))))
      : null,
    mejorar.length
      ? h('section', {}, h('h3', { class: 'subtitulo', text: 'A mejorar' }),
          h('ul', { class: 'lista-ficha' }, mejorar.map((x) => h('li', {}, h('strong', { text: x.aspecto }), x.detalle ? `: ${x.detalle}` : ''))))
      : null,
    comentarios.length
      ? h('section', {}, h('h3', { class: 'subtitulo', text: 'Comentarios del cuerpo técnico' }),
          h('ul', { class: 'lista-ficha comentarios-ficha' }, comentarios
            .slice()
            .sort((a, b) => b.jornada - a.jornada)
            .map((c) => h('li', {},
              h('span', { class: 'jornada-mini', text: `J${c.jornada}` }),
              h('span', {}, c.texto, c.firma ? h('small', { class: 'apagado', text: ` · ${c.firma}` }) : null)))))
      : null,
    !comentarios.length && !mejorar.length && !fuertes.length
      ? vacio('Aún no hay comentarios del cuerpo técnico para este jugador.')
      : null,
    permitido('jugador')
      ? h('div', { class: 'fila-acciones' }, h('button', { type: 'button', class: 'boton-secundario', onclick: () => { $('#dlg-ficha').close(); abrirJugador(id); } }, 'Editar ficha'))
      : null);
  $('#dlg-ficha').showModal();
}

function pintarMensajeTecnico() {
  const caja = $('#mensaje-tecnico');
  pintar($('#staff-tecnico'), botonStaff('Escribir instrucciones', () => abrirMensaje('tecnico'), 'boton-secundario', 'mensajeTecnico'));
  const m = estado.hoja?.mensajes?.tecnico;
  if (!m) return pintar(caja, vacio(estado.hoja ? 'El cuerpo técnico aún no ha dejado instrucciones.' : SIN_HOJA));
  pintar(caja, h('blockquote', { class: 'mensaje-tecnico' },
    h('p', { text: m.texto }),
    h('footer', {}, h('strong', { text: m.firma || 'Cuerpo técnico' }), esIso(m.fecha) ? ` · ${diaHoja(m.fecha, { day: 'numeric', month: 'long' })}` : '')));
}

function chipResultado(p) {
  const nuestros = p.somosLocal ? p.golesLocal : p.golesVisitante;
  const suyos = p.somosLocal ? p.golesVisitante : p.golesLocal;
  const [clase, texto] = nuestros > suyos ? ['v', 'Victoria'] : nuestros < suyos ? ['d', 'Derrota'] : ['e', 'Empate'];
  return h('span', { class: `resultado-chip ${clase}`, text: texto });
}

function pintarComentarios() {
  const caja = $('#comentarios');
  pintar($('#staff-comentarios'), botonStaff('Escribir comentarios de un partido', () => abrirComentarios(), 'boton-secundario', 'comentar'));
  const lista = estado.hoja?.comentarios || [];
  if (!lista.length) return pintar(caja, vacio(estado.hoja ? 'Aún no hay comentarios de partidos.' : SIN_HOJA));

  const porJornada = new Map();
  lista.forEach((c) => {
    if (!porJornada.has(c.jornada)) porJornada.set(c.jornada, { equipo: [], jugadores: [] });
    porJornada.get(c.jornada)[c.jugadorId || c.nombre ? 'jugadores' : 'equipo'].push(c);
  });
  const jornadas = [...porJornada.keys()].sort((a, b) => b - a);
  const visibles = estado.verTodosComentarios ? jornadas : jornadas.slice(0, 3);

  pintar(caja,
    visibles.map((j, i) => {
      const { equipo, jugadores: individuales } = porJornada.get(j);
      const p = estado.cf?.partidos.find((x) => x.jornada === j);
      const rival = p ? `vs ${rivalDe(p).nombre}` : '';
      const marcador = p?.finalizado
        ? `${p.somosLocal ? p.golesLocal : p.golesVisitante}-${p.somosLocal ? p.golesVisitante : p.golesLocal}`
        : '';
      return h('details', { class: 'comentario-partido', open: i === 0 },
        h('summary', {},
          h('span', { class: 'jornada', text: `J${j}` }),
          h('span', { class: 'titulo-partido' },
            rival || `Jornada ${j}`,
            h('small', {}, [marcador, p?.fecha ? diaPartido(p.fecha) : ''].filter(Boolean).join(' · '))),
          p?.finalizado ? chipResultado(p) : null),
        h('div', { class: 'cuerpo-comentarios' },
          equipo.map((c) => h('blockquote', { class: 'comentario-equipo' },
            h('p', { text: c.texto }),
            h('footer', {}, h('strong', { text: 'Al equipo' }), c.firma ? ` · ${c.firma}` : ''))),
          individuales.length
            ? h('ul', { class: 'comentarios-jugadores' }, individuales.map((c) => {
                const jug = jugadorPorId(c.jugadorId);
                return h('li', {},
                  imagen(jug?.foto),
                  h('div', {},
                    h('div', { class: 'nombre' }, h('span', { class: 'dorsal-mini', text: jug?.dorsal ?? '' }), jug?.nombre || c.nombre),
                    h('p', { text: c.texto }),
                    c.firma ? h('small', { class: 'apagado', text: c.firma }) : null));
              }))
            : null,
          h('div', { class: 'fila-acciones' }, botonStaff('Editar comentarios', () => abrirComentarios(j), 'boton-secundario', 'comentar'))));
    }),
    jornadas.length > 3
      ? h('button', {
          class: 'boton-secundario ver-mas', type: 'button',
          onclick: () => { estado.verTodosComentarios = !estado.verTodosComentarios; pintarComentarios(); },
        }, estado.verTodosComentarios ? 'Ver menos' : `Ver todas las jornadas (${jornadas.length})`)
      : null);
}

function pintarNormativa() {
  const caja = $('#normativa');
  pintar($('#staff-normativa'), botonStaff('Editar normativa', () => abrirEditorLista('normativa')));
  const lista = estado.hoja?.normativa || [];
  if (!lista.length) return pintar(caja, vacio(estado.hoja ? 'Todavía no hay normas publicadas.' : SIN_HOJA));
  pintar(caja, lista.map((n, i) =>
    h('details', {}, h('summary', {}, h('span', { class: 'n', text: i + 1 }), n.norma), n.detalle ? h('p', { text: n.detalle }) : null)));
}

/* ───────────────────────── 2. Competición ───────────────────────── */

function tarjetaPartido(p, { conConvocatoria = false } = {}) {
  const lado = (eq, derecha) => h('div', { class: `lado${derecha ? ' derecha' : ''}${eq.id === CONFIG.copafacil.equipo ? ' nuestro' : ''}` },
    imagen(eq.escudo), h('span', { text: eq.nombre }));

  let centro;
  let chip = null;
  if (p.finalizado) {
    centro = h('div', { class: 'centro', text: `${p.golesLocal} - ${p.golesVisitante}` });
    chip = chipResultado(p);
  } else {
    centro = h('div', { class: 'centro hora', text: p.fecha ? horaPartido(p.fecha) : 'vs' });
  }

  const mapa = enlaceMapa(p.lugar);
  const meta = h('div', { class: 'meta' },
    h('span', {}, h('strong', { text: p.jornada ? `Jornada ${p.jornada}` : 'Partido' }), p.fecha ? ` · ${diaPartido(p.fecha)}` : ' · Fecha por confirmar'),
    p.lugar
      ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, icono('lugar'),
          mapa ? h('a', { href: mapa, target: '_blank', rel: 'noopener', text: p.lugar.nombre }) : p.lugar.nombre)
      : chip);

  const g = gruposConvocatoria(p);
  const convocar = botonStaff(g && !g.deActa ? 'Editar convocatoria' : 'Convocatoria', () => abrirConvocatoria(p), 'boton-secundario', 'convocar');
  const comentar = p.finalizado && p.jornada
    ? botonStaff('Comentar', () => abrirComentarios(p.jornada), 'boton-secundario', 'comentar')
    : null;
  const acciones = [convocar, comentar].filter(Boolean);
  const listas = g && (conConvocatoria || p.finalizado) && hayHoja()
    ? desplegableConvocatoria(p, g, { abierto: false })
    : null;
  const sinConvocatoria = !g && conConvocatoria && hayHoja() ? h('span', { class: 'apagado', text: 'Sin convocatoria' }) : null;
  const pie = (p.finalizado && p.lugar) || listas || sinConvocatoria || acciones.some(Boolean)
    ? h('div', { class: 'pie-partido' },
        h('span', { class: 'resumen' }, p.finalizado && p.lugar ? chip : null, sinConvocatoria),
        acciones.some(Boolean) ? h('span', { class: 'acciones' }, acciones) : null,
        listas)
    : null;
  return h('article', { class: 'partido' }, meta,
    h('div', { class: 'marcador' }, lado(p.local, false), centro, lado(p.visitante, true)),
    pie,
    p.finalizado ? bloqueVotacion(p) : null);
}

function pintarCompeticion() {
  const cf = estado.cf;
  $('#enlace-copafacil').href = CONFIG.copafacil.web;
  $('#liga-nombre').textContent = cf ? `${cf.liga.grupo} · ${cf.liga.temporada.replace(/^temporada\s*/i, 'Temporada ')}` : '';
  $('#clasificacion-grupo').textContent = cf?.liga.grupo || '';

  const estadoTexto = estado.cargando
    ? 'Importando datos de CopaFácil…'
    : cf
      ? `Última importación: ${horaActualizacion(cf.actualizado)}${estado.errorCf ? ' (la última actualización falló)' : ''}`
      : estado.errorCf ? 'No se ha podido conectar con CopaFácil.' : '';
  $('#copafacil-estado').textContent = estadoTexto;

  if (!cf) {
    const msg = estado.errorCf ? 'No se han podido cargar los partidos.' : 'Cargando…';
    pintar($('#proximos'), vacio(msg));
    pintar($('#resultados'), vacio(msg));
    pintar($('#clasificacion tbody'), h('tr', {}, h('td', { colspan: 10, class: 'izq' }, vacio(msg))));
    return;
  }

  const proximos = cf.partidos.filter((p) => !p.finalizado);
  const visibles = estado.verTodoCalendario ? proximos : proximos.slice(0, 3);
  pintar($('#proximos'),
    proximos.length ? visibles.map((p) => tarjetaPartido(p, { conConvocatoria: true })) : vacio('No quedan partidos por jugar.'),
    proximos.length > 3
      ? h('button', {
          class: 'boton-secundario ver-mas', type: 'button',
          onclick: () => { estado.verTodoCalendario = !estado.verTodoCalendario; pintarCompeticion(); },
        }, estado.verTodoCalendario ? 'Ver menos' : `Ver calendario completo (${proximos.length})`)
      : null);

  const jugados = cf.partidos.filter((p) => p.finalizado).reverse();
  pintar($('#resultados'), jugados.length ? jugados.map((p) => tarjetaPartido(p)) : vacio('Todavía no se ha jugado ningún partido.'));

  pintar($('#clasificacion tbody'), cf.clasificacion.map((f) =>
    h('tr', { class: f.nuestro ? 'nuestro' : '' },
      h('td', { class: 'num', text: f.pos }),
      h('td', { class: 'izq' }, h('div', { class: 'equipo-celda' }, imagen(f.escudo), h('span', { text: f.nombre }))),
      h('td', { class: 'pts', text: f.pts }),
      celda(f.j), celda(f.g), celda(f.e), celda(f.p),
      h('td', { class: 'goles-a-favor', text: f.gf }), h('td', { class: 'goles-en-contra', text: f.gc }),
      h('td', { text: f.dif > 0 ? `+${f.dif}` : f.dif }))));
}

/* ───────────────────────── 3. Tercer tiempo ───────────────────────── */

function pintarQuedadas() {
  const caja = $('#quedadas');
  pintar($('#staff-quedadas'), botonStaff('Editar quedadas', () => abrirEditorLista('quedadas')));
  if (!estado.hoja) return pintar(caja, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA));
  const hoy = hoyIso();
  const lista = (estado.hoja.quedadas || [])
    .filter((q) => !esIso(q.fecha) || q.fecha >= hoy)
    .sort((a, b) => (esIso(a.fecha) ? a.fecha : '9999').localeCompare(esIso(b.fecha) ? b.fecha : '9999'));
  if (!lista.length) return pintar(caja, vacio('No hay quedadas a la vista. ¿Quién organiza la próxima?'));
  pintar(caja, lista.map((q) => {
    const enlace = urlSegura(q.enlace);
    return h('article', { class: 'quedada' },
      esIso(q.fecha)
        ? h('div', { class: 'calendario' },
            h('span', { class: 'd', text: Number(q.fecha.slice(8)) }),
            h('span', { class: 'm', text: formato({ month: 'short' }, 'UTC').format(msDeIso(q.fecha)).replace('.', '') }))
        : h('div', { class: 'calendario' }, h('span', { class: 'm', text: 'Por fijar' })),
      h('div', {},
        h('h3', { text: q.plan }),
        h('p', { text: [esIso(q.fecha) ? diaHoja(q.fecha) : '', q.hora, cuantoFalta(q.fecha)].filter(Boolean).join(' · ') }),
        q.lugar ? h('p', {}, enlace ? h('a', { href: enlace, target: '_blank', rel: 'noopener', text: q.lugar }) : q.lugar) : null,
        !q.lugar && enlace ? h('p', {}, h('a', { href: enlace, target: '_blank', rel: 'noopener', text: 'Más información' })) : null,
        q.organiza ? h('p', { class: 'apagado', text: `Organiza: ${q.organiza}` }) : null));
  }));
}

function pintarCumples() {
  const caja = $('#cumples');
  pintar($('#staff-cumples'), botonStaff('Editar cumpleaños', abrirCumples));
  if (!estado.hoja) return pintar(caja, h('li', {}, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA)));
  const hoy = hoyIso();
  const anio = Number(hoy.slice(0, 4));
  const activos = new Set(jugadores().map((j) => j.id));
  const lista = (estado.hoja.jugadores || [])
    .filter((j) => activos.has(j.id) && /^\d{2}-\d{2}$/.test(j.cumple || ''))
    .map((j) => {
      let fecha = `${anio}-${j.cumple}`;
      if (j.cumple === '02-29' && !(anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0))) fecha = `${anio}-03-01`;
      if (fecha < hoy) fecha = `${anio + 1}-${j.cumple === '02-29' ? '03-01' : j.cumple}`;
      return { ...j, fecha, dias: diasEntre(hoy, fecha) };
    })
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8);
  if (!lista.length) return pintar(caja, h('li', {}, vacio('No hay cumpleaños publicados.')));
  pintar(caja, lista.map((j) => {
    const nombre = jugadorPorId(j.id)?.nombre || j.nombre;
    return h('li', { class: `cumple${j.dias === 0 ? ' hoy' : ''}` },
      h('span', { class: 'nombre', text: j.dias === 0 ? `🎂 ${nombre}` : nombre }),
      h('span', { class: 'cuando-cumple', text: j.dias === 0 ? '¡Hoy! Invita a la ronda' : `${diaHoja(j.fecha, { day: 'numeric', month: 'long' })} · ${j.dias === 1 ? 'mañana' : `en ${j.dias} días`}` }));
  }));
}

/* Roles del equipo */

const ROLES = ['Míster', 'Segundo entrenador', 'Tercer entrenador', 'Cuarto entrenador', 'Capitán', 'Segundo capitán',
  'Presidente', 'Vicepresidente', 'Delegado', 'Tesorero', 'Vocal', 'Miembro fundador'];
const JUNTA = ['Presidente', 'Vicepresidente', 'Delegado', 'Tesorero', 'Vocal'];
// Los únicos roles que salen en la plantilla (pestaña Equipo).
const ROLES_PLANTILLA = ['Míster', 'Segundo entrenador', 'Tercer entrenador', 'Cuarto entrenador', 'Capitán', 'Segundo capitán'];
const ETIQUETA_ROL = {
  'Segundo entrenador': '2º entrenador', 'Tercer entrenador': '3er entrenador', 'Cuarto entrenador': '4º entrenador',
  'Segundo capitán': '2º capitán',
};
// Entrenadores: [rol, clave para los que no están en la plantilla, número].
const ENTRENADORES = [['Segundo entrenador', 'segundo', '2º'], ['Tercer entrenador', 'tercero', '3º'], ['Cuarto entrenador', 'cuarto', '4º']];
const OTRA_PERSONA = '__otra';

const normalizaTexto = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const rolConocido = (r) => ROLES.find((x) => normalizaTexto(x) === normalizaTexto(r)) || r;
const rolesDe = (j) => (j.roles || []).map(rolConocido);

/** Nombre corto para Roles del equipo: el que se haya puesto o, si no hay, inicial + apellido ("S. Fernandez"). */
function nombreCorto(j) {
  if (j.nombreCorto) return j.nombreCorto;
  const partes = j.nombre.split(' ').filter(Boolean);
  return partes.length > 1 ? `${partes[0][0]}. ${partes[partes.length - 1]}` : j.nombre;
}

function persona(j, cargo) {
  return h('div', { class: 'persona' },
    imagen(j.foto, '', 'foto-rol'),
    h('span', { class: 'nombre-rol', text: nombreCorto(j) }),
    cargo ? h('span', { class: 'cargo', text: cargo }) : null);
}

function pintarRoles() {
  pintar($('#staff-roles'), botonStaff('Editar roles', abrirRoles, 'boton'));
  const caja = $('#roles-contenido');
  if (!estado.hoja) return pintar(caja, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA));

  // Salen todos los que tengan rol, aunque no estén activos (p. ej. el míster).
  const todos = plantillaCompleta();
  const con = (rol) => todos.filter((j) => rolesDe(j).includes(rol));
  const ct = estado.hoja.cuerpoTecnico || {};

  // Cuerpo técnico: foto solo del míster; los entrenadores, al lado y solo con el nombre.
  const misters = con('Míster');
  const entrenadores = ENTRENADORES
    .map(([rol, clave, numero]) => {
      const j = con(rol)[0];
      const nombre = j ? nombreCorto(j) : ct[clave];
      return nombre ? h('li', {}, h('span', { class: 'num', text: numero }), h('span', { text: nombre })) : null;
    })
    .filter(Boolean);
  const cuerpoTecnico = misters.length || entrenadores.length
    ? h('article', { class: 'rol cuerpo-tecnico' },
        h('h3', { text: 'Cuerpo técnico' }),
        h('div', { class: 'ct-fila' },
          misters.map((j) => persona(j, 'Míster')),
          entrenadores.length ? h('ul', { class: 'entrenadores', 'aria-label': 'Entrenadores' }, entrenadores) : null))
    : null;

  const capitanes = [...con('Capitán').map((j) => [j, 'Capitán']), ...con('Segundo capitán').map((j) => [j, '2º capitán'])];
  const bloqueCapitanes = capitanes.length
    ? h('article', { class: 'rol capitanes' },
        h('h3', { text: 'Capitanes' }),
        h('div', { class: 'fila-personas' }, capitanes.map(([j, cargo]) => persona(j, cargo))))
    : null;

  // Junta: cada persona una vez, con todos sus cargos ("Presidente y Delegado"), por orden de cargo.
  const junta = todos
    .map((j) => ({ j, cargos: JUNTA.filter((r) => rolesDe(j).includes(r)) }))
    .filter(({ cargos }) => cargos.length)
    .sort((a, b) => JUNTA.indexOf(a.cargos[0]) - JUNTA.indexOf(b.cargos[0]));
  const bloqueJunta = junta.length
    ? h('article', { class: 'rol' },
        h('h3', { text: 'Junta directiva' }),
        h('div', { class: 'rejilla-personas' }, junta.map(({ j, cargos }) => persona(j, cargos.join(' y ')))))
    : null;

  const fundadores = con('Miembro fundador');
  const bloqueFundadores = fundadores.length
    ? h('article', { class: 'rol fundadores' },
        h('h3', { text: 'Miembros fundadores' }),
        h('div', { class: 'rejilla-personas' }, fundadores.map((j) => persona(j, null))))
    : null;

  // Roles inventados en la hoja (p. ej. "Utillero"): al final.
  const otros = todos
    .map((j) => ({ j, cargos: rolesDe(j).filter((r) => !ROLES.includes(r)) }))
    .filter(({ cargos }) => cargos.length);
  const bloqueOtros = otros.length
    ? h('article', { class: 'rol' },
        h('h3', { text: 'Otros' }),
        h('div', { class: 'rejilla-personas' }, otros.map(({ j, cargos }) => persona(j, cargos.join(' y ')))))
    : null;

  if (!cuerpoTecnico && !bloqueCapitanes && !bloqueJunta && !bloqueFundadores && !bloqueOtros) {
    return pintar(caja, vacio('Aún no hay roles asignados.'));
  }
  pintar(caja,
    cuerpoTecnico || bloqueCapitanes ? h('div', { class: 'roles-fila' }, cuerpoTecnico, bloqueCapitanes) : null,
    bloqueJunta, bloqueFundadores, bloqueOtros);
}

/* Editor de roles (solo desde la pestaña Roles) */

function selectorJugador(valor, { otraPersona = false } = {}) {
  const selector = h('select', {},
    h('option', { value: '', text: '— Nadie —' }),
    plantillaCompleta().map((j) => h('option', { value: j.id, text: `${j.dorsal ?? '–'} · ${j.nombre}` })),
    otraPersona ? h('option', { value: OTRA_PERSONA, text: 'Otra persona (no está en la plantilla)…' }) : null);
  selector.value = valor;
  return selector;
}

function botonesJugadores(rol, elegidos) {
  const caja = h('div', { class: 'roles-opciones' }, plantillaCompleta().map((j) =>
    h('button', {
      type: 'button', class: 'rol-opcion', 'aria-pressed': String(elegidos.has(j.id)), 'data-id': j.id,
      onclick: (ev) => ev.currentTarget.setAttribute('aria-pressed', String(ev.currentTarget.getAttribute('aria-pressed') !== 'true')),
    }, nombreCorto(j))));
  caja.dataset.rolVarios = rol;
  return caja;
}

function abrirRoles() {
  const todos = plantillaCompleta();
  const titular = (rol) => todos.find((j) => rolesDe(j).includes(rol))?.id || '';
  const titulares = (rol) => new Set(todos.filter((j) => rolesDe(j).includes(rol)).map((j) => j.id));
  const ct = estado.hoja?.cuerpoTecnico || {};

  const unico = (rol, etiqueta) => {
    const selector = selectorJugador(titular(rol));
    selector.dataset.rol = rol;
    return h('label', { class: 'campo' }, h('span', { text: etiqueta }), selector);
  };
  const entrenador = ([rol, clave, numero]) => {
    const id = titular(rol);
    const externo = ct[clave] || '';
    const selector = selectorJugador(id || (externo ? OTRA_PERSONA : ''), { otraPersona: true });
    selector.dataset.entrenador = rol;
    selector.dataset.clave = clave;
    const texto = h('input', { type: 'text', maxlength: 40, placeholder: 'Nombre (sale sin foto)', 'aria-label': `Nombre del ${numero} entrenador` });
    texto.dataset.externo = clave;
    texto.value = externo;
    texto.hidden = selector.value !== OTRA_PERSONA;
    selector.onchange = () => {
      texto.hidden = selector.value !== OTRA_PERSONA;
      if (!texto.hidden) texto.focus();
    };
    return h('div', { class: 'campo' }, h('span', { text: `${numero} entrenador` }), selector, texto);
  };

  pintar($('#roles-editor'),
    h('h3', { class: 'subtitulo', text: 'Cuerpo técnico' }),
    unico('Míster', 'Míster (sale con foto)'),
    ENTRENADORES.map(entrenador),
    h('h3', { class: 'subtitulo', text: 'Capitanes' }),
    unico('Capitán', 'Capitán'),
    unico('Segundo capitán', '2º capitán'),
    h('h3', { class: 'subtitulo', text: 'Junta directiva' }),
    unico('Presidente', 'Presidente'),
    unico('Vicepresidente', 'Vicepresidente'),
    unico('Delegado', 'Delegado'),
    unico('Tesorero', 'Tesorero'),
    h('div', { class: 'campo' }, h('span', { text: 'Vocales' }), botonesJugadores('Vocal', titulares('Vocal'))),
    h('h3', { class: 'subtitulo', text: 'Miembros fundadores' }),
    h('div', { class: 'campo' }, botonesJugadores('Miembro fundador', titulares('Miembro fundador'))),
    h('details', { class: 'nombres-cortos' },
      h('summary', { text: 'Nombres cortos (cómo salen en esta página)' }),
      todos.map((j) => {
        const entrada = h('input', { type: 'text', maxlength: 30, placeholder: nombreCorto({ ...j, nombreCorto: '' }), 'aria-label': `Nombre corto de ${j.nombre}` });
        entrada.dataset.id = j.id;
        entrada.value = j.nombreCorto;
        return h('label', { class: 'fila-corto' }, h('span', { text: j.nombre }), entrada);
      })));
  $('#dlg-roles').showModal();
}

async function guardarRolesDialogo() {
  const caja = $('#roles-editor');
  const asignados = new Map(); // id → Set(roles)
  const dar = (id, rol) => {
    if (!id || id === OTRA_PERSONA) return;
    if (!asignados.has(id)) asignados.set(id, new Set());
    asignados.get(id).add(rol);
  };
  caja.querySelectorAll('select[data-rol]').forEach((s) => dar(s.value, s.dataset.rol));
  const cuerpoTecnico = {};
  caja.querySelectorAll('select[data-entrenador]').forEach((s) => {
    const clave = s.dataset.clave;
    cuerpoTecnico[clave] = s.value === OTRA_PERSONA ? caja.querySelector(`[data-externo="${clave}"]`).value.trim() : '';
    dar(s.value, s.dataset.entrenador);
  });
  caja.querySelectorAll('[data-rol-varios]').forEach((g) =>
    g.querySelectorAll('[aria-pressed="true"]').forEach((b) => dar(b.dataset.id, g.dataset.rolVarios)));
  const cortos = new Map([...caja.querySelectorAll('.fila-corto input')].map((i) => [i.dataset.id, i.value.trim()]));

  const lista = plantillaCompleta().map((j) => ({
    id: j.id,
    // Los roles conocidos salen del editor; los inventados en la hoja se conservan.
    roles: [...ROLES.filter((r) => asignados.get(j.id)?.has(r)), ...rolesDe(j).filter((r) => !ROLES.includes(r))],
    nombreCorto: cortos.get(j.id) ?? j.nombreCorto,
  }));
  const ok = await conBotonOcupado($('#guardar-roles'),
    () => enviarStaff({ accion: 'roles', jugadores: lista, cuerpoTecnico }, 'Roles guardados ✓'));
  if (!ok) return;
  if (estado.hoja) {
    const porId = new Map(lista.map((x) => [x.id, x]));
    estado.hoja.jugadores = (estado.hoja.jugadores || []).map((j) => (porId.has(j.id) ? { ...j, ...porId.get(j.id) } : j));
    estado.hoja.cuerpoTecnico = cuerpoTecnico;
  }
  $('#dlg-roles').close();
  pintarTodo();
}

/* Tesorería: cuotas y multas pendientes (número). Solo se edita con el PIN de tesorería. */

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function stepperTesoreria(id, campo, etiqueta) {
  const v = estado.edTesoreria.get(id);
  const cambiar = (d) => {
    v[campo] = Math.min(99, Math.max(0, v[campo] + d));
    pintarTesoreria();
  };
  return h('div', { class: 'stepper' },
    h('span', { class: 'etiqueta-stepper', text: etiqueta }),
    h('button', { type: 'button', 'aria-label': `${etiqueta}: una menos`, onclick: () => cambiar(-1) }, '−'),
    h('output', { class: v[campo] ? 'pendiente' : '', text: v[campo] }),
    h('button', { type: 'button', 'aria-label': `${etiqueta}: una más`, onclick: () => cambiar(1) }, '+'));
}

function pintarTesoreria() {
  const caja = $('#tesoreria-contenido');
  pintar($('#staff-tesoreria'));
  if (!estado.hoja) return pintar(caja, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA));
  const lista = jugadores();
  if (!lista.length) return pintar(caja, vacio('Cargando plantilla…'));

  const editar = esTesorero();
  if (!editar) estado.edTesoreria = null;
  if (editar && !estado.edTesoreria) {
    estado.edTesoreria = new Map(lista.map((j) => [j.id, { cuotas: j.cuotas || 0, multas: j.multas || 0 }]));
  }
  const valor = (j) => (editar && estado.edTesoreria.get(j.id)) || { cuotas: j.cuotas || 0, multas: j.multas || 0 };
  const alDia = lista.filter((j) => !valor(j).cuotas && !valor(j).multas).length;
  const cuotas = lista.reduce((s, j) => s + valor(j).cuotas, 0);
  const multas = lista.reduce((s, j) => s + valor(j).multas, 0);
  const cambios = editar && lista.some((j) => valor(j).cuotas !== (j.cuotas || 0) || valor(j).multas !== (j.multas || 0));

  pintar(caja,
    h('p', { class: 'resumen-tesoreria' },
      h('span', { class: 'al-dia', text: `✓ ${plural(alDia, 'jugador al día', 'jugadores al día')}` }),
      cuotas ? h('span', { class: 'pendiente', text: plural(cuotas, 'cuota pendiente', 'cuotas pendientes') }) : null,
      multas ? h('span', { class: 'pendiente', text: plural(multas, 'multa pendiente', 'multas pendientes') }) : null),
    editar
      ? h('div', { class: 'barra-edicion' },
          h('span', { class: 'apagado', text: cambios ? 'Tienes cambios sin guardar.' : 'Toca − / + para cambiar cuotas y multas de cada jugador.' }),
          h('span', { class: 'acciones' },
            h('button', { type: 'button', class: 'boton-secundario', disabled: !cambios, onclick: () => { estado.edTesoreria = null; pintarTesoreria(); } }, 'Deshacer'),
            h('button', { type: 'button', class: 'boton', id: 'guardar-tesoreria', disabled: !cambios, onclick: guardarTesoreria }, 'Guardar cambios')))
      : hayHoja()
        ? h('p', { class: 'pista-staff', text: 'Para cambiar cuotas y multas: botón «Staff» (candado, arriba) con el PIN de tesorería.' })
        : null,
    h('ul', { class: `lista-tesoreria-publica${editar ? ' editable' : ''}` }, lista.map((j) => {
      const v = valor(j);
      // Más de 2 cuotas, en rojo; 1 o 2, en naranja; al día, como siempre.
      const debe = v.cuotas || v.multas;
      const clase = v.cuotas > 2 ? 'debe-mucho' : v.cuotas ? 'debe-poco' : v.multas ? 'debe' : '';
      return h('li', { class: clase },
        imagen(j.foto),
        h('span', { class: 'nombre' },
          h('span', { class: 'dorsal-mini', text: j.dorsal ?? '' }), j.nombre,
          editar ? h('span', { class: 'tarjetas-ref', title: 'Tarjetas en CopaFácil' },
            h('span', { class: 'tarjeta amarilla', 'aria-label': 'Amarillas' }), String(j.ta || 0),
            h('span', { class: 'tarjeta roja', 'aria-label': 'Rojas' }), String(j.tr || 0)) : null),
        editar
          ? h('span', { class: 'steppers' }, stepperTesoreria(j.id, 'cuotas', 'Cuotas'), stepperTesoreria(j.id, 'multas', 'Multas'))
          : h('span', { class: 'estado-tesoreria' },
              debe
                ? [v.cuotas ? h('span', { class: 'pendiente', text: plural(v.cuotas, 'cuota', 'cuotas') }) : null,
                   v.multas ? h('span', { class: 'pendiente', text: plural(v.multas, 'multa', 'multas') }) : null]
                : h('span', { class: 'al-dia', text: '✓ Al día' })));
    })),
    bloquePin('tesoreria'));
}

/**
 * Bloque para cambiar el PIN. En Equipo sale el del míster; en Tesorería, el del tesorero.
 * Cada uno solo ve el suyo; el administrador los ve todos y además puede consultarlos.
 */
function bloquePin(cual) {
  const esStaffPin = cual === 'staff';
  if (!permitido(esStaffPin ? 'pinStaff' : 'pinTesoreria')) return null;
  return h('article', { class: 'bloque-pin' },
    h('h3', { class: 'subtitulo', text: esStaffPin ? 'PIN del míster' : 'PIN de tesorería' }),
    h('p', { class: 'apagado', text: esStaffPin
      ? 'Con este PIN se hacen las convocatorias y los comentarios de los partidos.'
      : 'Con este PIN se cambian las cuotas y las multas.' }),
    h('div', { class: 'fila-acciones' },
      h('button', { type: 'button', class: 'boton-secundario', onclick: () => abrirCambioPin(cual) },
        `Cambiar el PIN ${esStaffPin ? 'del míster' : 'de tesorería'}`),
      esAdmin() ? h('button', { type: 'button', class: 'boton-secundario', onclick: () => abrirCambioPin('equipo') }, 'Cambiar el PIN del equipo') : null,
      esAdmin() ? h('button', { type: 'button', class: 'boton-secundario', onclick: () => abrirCambioPin('admin') }, 'Cambiar mi PIN') : null,
      esAdmin() ? h('button', { type: 'button', class: 'boton-secundario', onclick: verPines }, 'Ver los PIN') : null));
}

function pintarEntradas() {
  const bloque = $('#bloque-entradas');
  bloque.hidden = !permitido('entradas');
  if (bloque.hidden) return;
  const caja = $('#entradas');
  if (!estado.entradas) {
    pintar(caja,
      h('p', { class: 'apagado', text: 'Cuántas veces ha abierto la web cada jugador desde que se identificó.' }),
      h('button', { type: 'button', class: 'boton-secundario', onclick: cargarEntradas }, 'Ver quién entra'));
    return;
  }
  const lista = [...estado.entradas].sort((a, b) => b.semana - a.semana || b.total - a.total);
  pintar(caja,
    h('div', { class: 'tabla-scroll' },
      h('table', { class: 'tabla' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'izq', text: 'Jugador' }),
          h('th', { text: 'Últimos 7 días' }),
          h('th', { text: 'Total' }),
          h('th', { class: 'izq', text: 'Última vez' }))),
        h('tbody', {}, lista.map((e) => h('tr', { class: e.total ? '' : 'sin-entrar' },
          h('td', { class: 'izq', text: e.nombre + (e.activo ? '' : ' (no activo)') }),
          h('td', { class: e.semana ? 'goles-a-favor' : 'cero', text: e.semana }),
          h('td', { text: e.total }),
          h('td', { class: 'izq apagado', text: e.ultima ? diaHoja(e.ultima.slice(0, 10), { day: 'numeric', month: 'short' }) + ' · ' + e.ultima.slice(11) : 'nunca' })))))),
    h('button', { type: 'button', class: 'boton-secundario', onclick: cargarEntradas }, 'Actualizar'));
}

async function cargarEntradas() {
  if (!permitido('entradas')) return;
  try {
    const r = await enviarHoja(CONFIG.hoja, { accion: 'entradas', pin: recuperar(CLAVE_PIN) });
    if (!r.ok) return aviso('No se ha podido leer quién entra', true);
    estado.entradas = r.jugadores;
    pintarEntradas();
  } catch {
    aviso('Sin conexión con la hoja', true);
  }
}

function pintarBloquePinEquipo() {
  pintar($('#pin-equipo'), bloquePin('staff'));
}

/** El administrador puede consultar los tres PIN, por si alguien se le olvida. */
async function verPines() {
  try {
    const r = await enviarHoja(CONFIG.hoja, { accion: 'pines', pin: recuperar(CLAVE_PIN) });
    if (!r.ok) return aviso('No se han podido leer los PIN', true);
    const etiquetas = { equipo: 'Equipo (todos los jugadores)', staff: 'Míster', tesoreria: 'Tesorero', admin: 'Tú (administrador)' };
    pintar($('#lista-pines'), Object.keys(etiquetas).map((k) => h('li', {},
      h('span', { text: etiquetas[k] }), h('strong', { text: r.pines[k] || '—' }))));
    $('#dlg-pines').showModal();
  } catch {
    aviso('Sin conexión con la hoja', true);
  }
}

async function guardarTesoreria() {
  const filas = [...estado.edTesoreria].map(([id, v]) => ({ id, cuotas: v.cuotas, multas: v.multas }));
  const ok = await conBotonOcupado($('#guardar-tesoreria'), () => enviarStaff({ accion: 'tesoreria', jugadores: filas }, 'Tesorería guardada ✓'));
  if (!ok) return;
  if (estado.hoja?.jugadores) {
    const porId = new Map(filas.map((f) => [f.id, f]));
    estado.hoja.jugadores = estado.hoja.jugadores.map((j) => (porId.has(j.id) ? { ...j, cuotas: porId.get(j.id).cuotas, multas: porId.get(j.id).multas } : j));
  }
  estado.edTesoreria = null;
  pintarTodo();
}

/* Cambiar PIN (solo con el PIN de tesorería) */

let pinACambiar = null;

function abrirCambioPin(cual) {
  pinACambiar = cual;
  const titulos = { staff: 'PIN del míster', tesoreria: 'PIN de tesorería', equipo: 'PIN del equipo', admin: 'Tu PIN de administrador' };
  const ayudas = {
    staff: 'Al cambiarlo, el cuerpo técnico tendrá que entrar con el PIN nuevo. Díselo tú.',
    tesoreria: 'Al cambiarlo, el tesorero tendrá que entrar con el PIN nuevo.',
    equipo: 'Es el que abre la web. Al cambiarlo, todos los jugadores tendrán que escribir el nuevo.',
    admin: 'Es solo tuyo: lo puede todo. Apúntalo en algún sitio seguro.',
  };
  $('#dlg-cambiar-pin-titulo').textContent = titulos[cual] || 'PIN';
  $('#cambiar-pin-ayuda').textContent = ayudas[cual] || '';
  $('#pin-nuevo').value = '';
  $('#pin-repetido').value = '';
  $('#cambiar-pin-error').textContent = '';
  $('#dlg-cambiar-pin').showModal();
  $('#pin-nuevo').focus();
}

async function guardarPinNuevo(ev) {
  ev.preventDefault();
  const nuevo = $('#pin-nuevo').value.trim();
  const error = $('#cambiar-pin-error');
  if (!/^\d{4,8}$/.test(nuevo)) return (error.textContent = 'Tienen que ser de 4 a 8 cifras.');
  if (nuevo !== $('#pin-repetido').value.trim()) return (error.textContent = 'Los dos PIN no coinciden.');
  error.textContent = '';
  const ok = await conBotonOcupado($('#guardar-pin'), () => enviarStaff({ accion: 'cambiarPin', cual: pinACambiar, nuevo }, 'PIN cambiado ✓'));
  if (!ok) return;
  if (pinACambiar === 'tesoreria') guardar(CLAVE_PIN, nuevo); // este dispositivo sigue dentro con el PIN nuevo
  $('#dlg-cambiar-pin').close();
}

/** Convierte enlaces de Google Drive en miniaturas; el resto se muestra si parece una imagen. */
function datosFoto(url) {
  const seguro = urlSegura(url);
  if (!seguro) return null;
  const u = new URL(seguro);
  if (u.hostname === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
    if (id) return { img: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`, enlace: seguro };
  }
  if (/\.(jpe?g|png|webp|gif|avif)$/i.test(u.pathname) || u.hostname.endsWith('googleusercontent.com')) {
    return { img: seguro, enlace: seguro };
  }
  return { img: null, enlace: seguro };
}

function pintarFotos() {
  const caja = $('#fotos');
  pintar($('#staff-fotos'), botonStaff('Editar fotos', () => abrirEditorLista('fotos')));
  if (!estado.hoja) return pintar(caja, vacio(hayHoja() ? 'Cargando…' : SIN_HOJA));
  const lista = (estado.hoja.fotos || []).map((f) => ({ ...f, ...datosFoto(f.url) })).filter((f) => f.enlace);
  if (!lista.length) {
    caja.style.display = 'block';
    return pintar(caja, vacio('Aún no hay fotos. Subidlas a Drive y pegad el enlace en la hoja.'));
  }
  caja.style.display = '';
  lista.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  pintar(caja, lista.map((f) => f.img
    ? h('a', { class: 'foto', href: f.enlace, target: '_blank', rel: 'noopener', title: f.titulo || 'Foto' },
        h('img', { src: f.img, alt: f.titulo || 'Foto del equipo', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        f.titulo ? h('span', { class: 'pie-foto', text: f.titulo }) : null)
    : h('a', { class: 'foto album', href: f.enlace, target: '_blank', rel: 'noopener' }, icono('album'), h('span', { text: f.titulo || 'Ver álbum' }))));
}

/* ───────────────────────── Pintado general ───────────────────────── */

/** Pinta un apartado sin que un fallo suyo tumbe el resto de la web. */
function aSalvo(nombre, tarea) {
  try {
    tarea();
  } catch (e) {
    console.error(`Fallo al pintar ${nombre}`, e);
  }
}

function pintarTodo() {
  aSalvo('pintarBotonStaff', () => pintarBotonStaff());
  aSalvo('pintarHerramientas', () => pintarHerramientas());
  aSalvo('pintarBloquePinEquipo', () => pintarBloquePinEquipo());
  aSalvo('pintarEntradas', () => pintarEntradas());
  aSalvo('pintarHero', () => pintarHero());
  aSalvo('pintarAnuncios', () => pintarAnuncios());
  aSalvo('pintarProximoPartido', () => pintarProximoPartido());
  aSalvo('pintarProximoEntreno', () => pintarProximoEntreno());
  aSalvo('pintarApuntadosEntreno', () => pintarApuntadosEntreno());
  aSalvo('pintarConvocatoriaProxima', () => pintarConvocatoriaProxima());
  aSalvo('pintarVoyRapido', () => pintarVoyRapido());
  aSalvo('pintarEstadisticas', () => pintarEstadisticas());
  aSalvo('pintarPlantilla', () => pintarPlantilla());
  aSalvo('pintarLesionados', () => pintarLesionados());
  aSalvo('pintarValoraciones', () => pintarValoraciones('mejorar'));
  aSalvo('pintarValoraciones', () => pintarValoraciones('fuertes'));
  aSalvo('pintarMensajeTecnico', () => pintarMensajeTecnico());
  aSalvo('pintarComentarios', () => pintarComentarios());
  aSalvo('pintarNormativa', () => pintarNormativa());
  aSalvo('pintarCompeticion', () => pintarCompeticion());
  aSalvo('pintarQuedadas', () => pintarQuedadas());
  aSalvo('pintarCumples', () => pintarCumples());
  aSalvo('pintarRoles', () => pintarRoles());
  aSalvo('pintarTesoreria', () => pintarTesoreria());
  aSalvo('pintarFotos', () => pintarFotos());

  const partes = [];
  if (estado.cf) partes.push(`CopaFácil: ${horaActualizacion(estado.cf.actualizado)}`);
  if (estado.errorHoja && hayHoja()) partes.push('No se ha podido leer la hoja del equipo');
  $('#pie-estado').textContent = partes.join(' · ');
}

/* ───────────────────────── Carga de datos ───────────────────────── */

let avisoTimer;
function aviso(texto, error = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.classList.toggle('error', error);
  el.classList.add('visible');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}

async function cargarCf() {
  try {
    estado.cf = await cargarCopaFacil(CONFIG.copafacil);
    estado.errorCf = null;
    guardar(CLAVE_CF, estado.cf);
  } catch (e) {
    console.error(e);
    estado.errorCf = e;
  }
  pintarTodo();
}

async function cargarHoja() {
  if (!hayHoja()) return;
  try {
    estado.hoja = await leerHoja(CONFIG.hoja, recuperar(CLAVE_EQUIPO) || '');
    estado.errorHoja = null;
    estado.bloqueada = false;
    guardar(CLAVE_HOJA, estado.hoja);
  } catch (e) {
    if (e.codigo !== 'pin_equipo') console.error(e);
    estado.errorHoja = e;
    if (e.codigo === 'pin_equipo') {
      borrar(CLAVE_EQUIPO);
      borrar(CLAVE_HOJA);
      estado.hoja = null;
      estado.bloqueada = true;
    }
  }
  bloquear(pasoCandado());
  pintarTodo();
}

/* ───────────────────────── PIN del equipo ───────────────────────── */

/**
 * El candado tiene dos pasos: el PIN del equipo y decir quién eres.
 * Lo segundo es para que el cuerpo técnico sepa quién entra y para votar y apuntarse.
 */
function bloquear(paso) {
  const bloqueo = $('#bloqueo');
  bloqueo.hidden = !paso;
  document.body.classList.toggle('bloqueada', Boolean(paso));
  if (!paso) return;
  const esPin = paso === 'pin';
  $('#form-equipo').hidden = !esPin;
  $('#form-quien').hidden = esPin;
  $('#bloqueo-titulo').textContent = esPin ? 'Zona del equipo' : '¿Quién eres?';
  $('#bloqueo-texto').textContent = esPin
    ? 'Esta web es solo para el Black Panthers F.C. Escribe el PIN del equipo para entrar.'
    : 'Solo se pregunta una vez en cada móvil. Sirve para votar al MVP y para apuntarte a los partidos.';
  $('#bloqueo-pista').textContent = esPin ? '¿No lo tienes? Pídeselo al cuerpo técnico.' : '';
  if (esPin) return setTimeout(() => $('#pin-equipo-entrada').focus(), 50);
  const selector = $('#quien-soy');
  pintar(selector,
    h('option', { value: '', text: '— Elige tu nombre —' }),
    jugadores().map((j) => h('option', { value: j.id, text: `${j.dorsal ?? '–'} · ${j.nombre}` })),
    h('option', { value: 'otro', text: 'Cuerpo técnico u otro' }));
}

/** Qué paso del candado toca: ninguno, el PIN o decir quién eres. */
function pasoCandado() {
  if (estado.bloqueada) return 'pin';
  if (!hayHoja() || !estado.hoja) return null;
  return recuperar(CLAVE_YO) ? null : 'quien';
}

function decirQuienSoy(ev) {
  ev.preventDefault();
  const id = $('#quien-soy').value;
  if (!id) return;
  guardar(CLAVE_YO, id);
  bloquear(null);
  apuntarEntrada();
  pintarTodo();
}

/** Deja constancia de que este jugador ha abierto la web (la hoja agrupa por media hora). */
function apuntarEntrada() {
  const id = recuperar(CLAVE_YO);
  if (!hayHoja() || !id || id === 'otro') return;
  enviarHoja(CONFIG.hoja, { accion: 'entrada', pinEquipo: recuperar(CLAVE_EQUIPO) || '', jugadorId: id })
    .catch(() => { /* si falla, no pasa nada: es solo un contador */ });
}

async function entrarConPinEquipo(ev) {
  ev.preventDefault();
  const entrada = $('#pin-equipo-entrada');
  const error = $('#equipo-error');
  const pin = entrada.value.trim();
  if (!pin) return;
  error.textContent = 'Comprobando…';
  try {
    const datos = await leerHoja(CONFIG.hoja, pin);
    guardar(CLAVE_EQUIPO, pin);
    estado.hoja = datos;
    estado.errorHoja = null;
    estado.bloqueada = false;
    guardar(CLAVE_HOJA, datos);
    entrada.value = '';
    error.textContent = '';
    bloquear(pasoCandado());
    apuntarEntrada();
    pintarTodo();
  } catch (e) {
    error.textContent = e.codigo === 'pin_equipo' ? 'PIN incorrecto.' : 'No se ha podido conectar con la hoja.';
  }
}

async function actualizar({ manual = false } = {}) {
  if (estado.cargando) return;
  estado.cargando = true;
  document.querySelectorAll('[data-actualizar]').forEach((b) => { b.classList.add('girando'); b.disabled = true; });
  pintarCompeticion();
  await Promise.all([cargarCf(), cargarHoja()]);
  estado.cargando = false;
  document.querySelectorAll('[data-actualizar]').forEach((b) => { b.classList.remove('girando'); b.disabled = false; });
  pintarTodo();
  if (manual) {
    if (estado.errorCf) aviso('No se ha podido conectar con CopaFácil', true);
    else if (estado.errorHoja && hayHoja()) aviso('CopaFácil al día, pero la hoja no responde', true);
    else aviso('Datos importados de CopaFácil ✓');
  }
}

/* ───────────────────────── Modo staff ───────────────────────── */

/**
 * La web tiene dos direcciones: la de todos y la de gestión (…?gestion).
 * La de gestión solo enseña la puerta: para entrar sigue haciendo falta el PIN.
 * Con …?gestion=0 el aparato vuelve a ser uno normal.
 */
function modoGestion() {
  const valor = new URLSearchParams(location.search).get('gestion');
  if (valor !== null) {
    if (valor === '0' || valor === 'no') borrar(CLAVE_GESTION);
    else guardar(CLAVE_GESTION, true);
  }
  return Boolean(recuperar(CLAVE_GESTION));
}

/** Actualizar e importar de CopaFácil son cosa del administrador. */
function pintarHerramientas() {
  const ver = esAdmin();
  document.querySelectorAll('[data-actualizar]').forEach((b) => { b.hidden = !ver; });
  const importar = document.querySelector('.importar');
  if (importar) importar.hidden = !ver;
}

function pintarBotonStaff() {
  const b = document.querySelector('[data-staff]');
  b.hidden = !hayHoja() || (!estado.gestion && !esStaff());
  b.classList.toggle('activo', esStaff());
  b.setAttribute('aria-pressed', String(esStaff()));
  const etiquetas = { admin: 'Admin ✓', tesoreria: 'Tesorería ✓', staff: 'Míster ✓' };
  b.querySelector('[data-staff-texto]').textContent = esStaff() ? etiquetas[estado.nivel] || 'Staff ✓' : 'Staff';
}

function salirStaff(mensaje) {
  borrar(CLAVE_PIN);
  borrar(CLAVE_NIVEL);
  estado.staff = false;
  estado.nivel = 'staff';
  estado.edTesoreria = null;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  pintarTodo();
  if (mensaje) aviso(mensaje, true);
}

function pedirPin() {
  return new Promise((resolver) => {
    const dlg = $('#dlg-pin');
    const form = $('#form-pin');
    const entrada = $('#pin');
    const error = $('#pin-error');
    entrada.value = '';
    error.textContent = '';

    const cerrar = (valor) => {
      form.removeEventListener('submit', enviar);
      dlg.removeEventListener('close', alCerrar);
      if (dlg.open) dlg.close();
      resolver(valor);
    };
    const alCerrar = () => cerrar(null);
    async function enviar(ev) {
      ev.preventDefault();
      const pin = entrada.value.trim();
      if (!pin) return;
      error.textContent = 'Comprobando…';
      try {
        const r = await enviarHoja(CONFIG.hoja, { accion: 'comprobarPin', pin });
        if (r.ok) return cerrar({ pin, nivel: ['admin', 'tesoreria'].includes(r.nivel) ? r.nivel : 'staff' });
        error.textContent = r.error === 'bloqueado' ? 'Demasiados intentos. Espera 15 minutos.' : 'PIN incorrecto.';
      } catch {
        error.textContent = 'No hay conexión con la hoja. Inténtalo de nuevo.';
      }
    }
    form.addEventListener('submit', enviar);
    dlg.addEventListener('close', alCerrar);
    dlg.querySelector('[data-cerrar]').onclick = () => cerrar(null);
    dlg.showModal();
    entrada.focus();
  });
}

async function alternarStaff() {
  if (!hayHoja()) return aviso('Primero hay que conectar la hoja del equipo', true);
  if (esStaff()) {
    if (window.confirm('¿Salir del modo staff en este dispositivo?')) {
      salirStaff();
      aviso('Modo staff cerrado');
    }
    return;
  }
  const acceso = await pedirPin();
  if (!acceso) return;
  guardar(CLAVE_PIN, acceso.pin);
  guardar(CLAVE_NIVEL, acceso.nivel);
  estado.staff = true;
  estado.nivel = acceso.nivel;
  pintarTodo();
  aviso(acceso.nivel === 'tesoreria' ? 'Modo tesorería: puedes editar todo, también las cuotas' : 'Modo staff activado: ya puedes editar');
}

/** Envía una acción del staff a la hoja. Devuelve true si se guardó. */
async function enviarStaff(datos, textoOk) {
  try {
    const r = await enviarHoja(CONFIG.hoja, { ...datos, pin: recuperar(CLAVE_PIN) });
    if (r.ok) {
      aviso(textoOk);
      cargarHoja();
      return true;
    }
    if (r.error === 'pin') salirStaff('El PIN ha cambiado. Vuelve a entrar en modo staff.');
    else if (r.error === 'bloqueado') aviso('Demasiados intentos con PIN erróneo. Espera 15 minutos.', true);
    else if (r.error === 'sin_permiso') aviso('Ese PIN no puede cambiar esto', true);
    else if (r.error === 'pin_no_valido') aviso(r.mensaje || 'Ese PIN no vale', true);
    else aviso('No se ha podido guardar. Revisa los datos.', true);
  } catch {
    aviso('Sin conexión con la hoja. Inténtalo de nuevo.', true);
  }
  return false;
}

async function conBotonOcupado(boton, tarea) {
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.textContent = texto;
  }
}

/* Lista de jugadores: convocatoria de un partido (tres estados) o lista de un entreno (dos estados) */

// Estados de un jugador en un partido. Tocar al jugador pasa al siguiente.
const ESTADOS_PARTIDO = [
  { valor: 'convocado', etiqueta: '✓ Convocado', clase: 'si', singular: 'convocado', plural: 'convocados' },
  { valor: 'no_viene', etiqueta: '✗ No viene', clase: 'rojo', singular: 'no viene', plural: 'no vienen' },
  { valor: 'no_convocado', etiqueta: '– No convocado', clase: 'no', singular: 'no convocado', plural: 'no convocados' },
];
const ESTADOS_PARTIDO_JUGADO = [
  { valor: 'convocado', etiqueta: '✓ Vino', clase: 'si', singular: 'vino', plural: 'vinieron' },
  { valor: 'no_viene', etiqueta: '✗ No vino', clase: 'rojo', singular: 'no vino', plural: 'no vinieron' },
  { valor: 'no_convocado', etiqueta: '– No convocado', clase: 'no', singular: 'no convocado', plural: 'no convocados' },
];
const ESTADOS_ENTRENO = [
  { valor: true, etiqueta: '✓ Vino', clase: 'si', singular: 'vino', plural: 'vinieron' },
  { valor: false, etiqueta: 'No vino', clase: 'no', singular: 'no vino', plural: 'no vinieron' },
];

let lista = null; // { seleccion: Map(id → valor), estados, alGuardar }

function abrirLista({ titulo, subtitulo = '', ayuda = '', estados, seleccion, fecha = null, alGuardar }) {
  lista = { seleccion, estados, alGuardar };
  $('#dlg-lista-titulo').textContent = titulo;
  $('#dlg-lista-subtitulo').textContent = subtitulo;
  $('#dlg-lista-ayuda').textContent = ayuda;
  $('#dlg-lista-fecha').hidden = !fecha;
  const campoFecha = $('#lista-fecha');
  campoFecha.onchange = null;
  if (fecha) {
    campoFecha.value = fecha.valor;
    campoFecha.max = hoyIso();
    campoFecha.onchange = () => {
      if (esIso(campoFecha.value)) lista.seleccion = fecha.alCambiar(campoFecha.value);
      pintarLista();
    };
  }
  pintarLista();
  $('#dlg-lista').showModal();
}

function pintarLista() {
  const { seleccion, estados } = lista;
  const activos = jugadores();
  pintar($('#lista-jugadores'), activos.map((j) => {
    const i = Math.max(0, estados.findIndex((e) => e.valor === seleccion.get(j.id)));
    const e = estados[i];
    const marcas = marcasJugador(j, { proximo: false });
    return h('li', {},
      h('button', {
        type: 'button', class: `opcion-jugador ${e.clase}`, 'aria-label': `${j.nombre}: ${e.etiqueta.replace(/^\W+\s*/, '')}. Toca para cambiar`,
        onclick: () => { seleccion.set(j.id, estados[(i + 1) % estados.length].valor); pintarLista(); },
      },
      h('span', { class: 'dorsal', text: j.dorsal ?? '–' }),
      h('span', { class: 'nombre' }, j.nombre, marcas.length ? h('small', {}, h('span', { class: 'marcas marcas-lista' }, marcas)) : null),
      h('span', { class: 'marca-conv', text: e.etiqueta })));
  }));
  $('#contador-lista').textContent = estados
    .map((e) => ({ e, n: activos.filter((j) => seleccion.get(j.id) === e.valor).length }))
    .filter(({ n }) => n)
    .map(({ e, n }) => `${n} ${n === 1 ? e.singular : e.plural}`)
    .join(' · ') || `0 de ${activos.length}`;
}

async function guardarLista() {
  const ok = await conBotonOcupado($('#guardar-lista'), () => lista.alGuardar(lista.seleccion, $('#lista-fecha').value));
  if (ok) $('#dlg-lista').close();
}

function abrirConvocatoria(p) {
  const g = gruposConvocatoria(p);
  const pasado = p.finalizado;
  const seleccion = new Map(jugadores().map((j) => {
    if (g) {
      const valor = g.convocados.includes(j.id) ? 'convocado' : g.noVienen.includes(j.id) ? 'no_viene' : 'no_convocado';
      return [j.id, valor];
    }
    // Sin convocatoria: todos convocados menos las bajas, que no vienen.
    return [j.id, lesionDe(j.id)?.estado === 'baja' ? 'no_viene' : 'convocado'];
  }));
  const rival = rivalDe(p);
  abrirLista({
    titulo: 'Convocatoria',
    subtitulo: `${p.jornada ? `Jornada ${p.jornada} · ` : ''}vs ${rival.nombre}${p.fecha ? ` · ${diaPartido(p.fecha)}` : ''}${pasado ? ' · ya jugado' : ''}`,
    ayuda: pasado
      ? 'Partido ya jugado: deja en «Vino» a los que estuvieron y en «No vino» a los que faltaron (cuenta como falta, en rojo). Toca a un jugador para cambiarlo.'
      : 'Toca a cada jugador para cambiar: Convocado → No viene → No convocado.',
    estados: pasado ? ESTADOS_PARTIDO_JUGADO : ESTADOS_PARTIDO,
    seleccion,
    alGuardar: async (sel) => {
      const ok = await enviarStaff({
        accion: 'convocar',
        partidoId: p.id,
        fecha: p.fecha ? isoDe(p.fecha) : '',
        rival: rival.nombre,
        jugadores: [...sel].map(([id, estadoJugador]) => ({ id, estado: estadoJugador })),
      }, 'Convocatoria guardada ✓');
      if (ok && estado.hoja) {
        // Se refleja al momento; la recarga de la hoja lo confirma después.
        const de = (v) => [...sel].filter(([, x]) => x === v).map(([id]) => id);
        estado.hoja.convocatorias = {
          ...estado.hoja.convocatorias,
          [p.id]: { convocados: de('convocado'), noVienen: de('no_viene'), noConvocados: de('no_convocado') },
        };
        estado.partidoConvocatoria = p.id;
        pintarTodo();
      }
      return ok;
    },
  });
}

function seleccionEntreno(fecha) {
  const sesion = (estado.hoja?.entrenos?.lista || []).find((x) => x.fecha === fecha);
  return new Map(jugadores().map((j) => [j.id, sesion ? sesion.asistentes.includes(j.id) : false]));
}

function abrirEntreno() {
  const hoy = hoyIso();
  abrirLista({
    titulo: 'Pasar lista',
    subtitulo: 'Asistencia al entreno',
    ayuda: 'Elige la fecha y marca a los que vinieron. Si ya pasaste lista ese día, se corrige.',
    estados: ESTADOS_ENTRENO,
    seleccion: seleccionEntreno(hoy),
    fecha: { valor: hoy, alCambiar: seleccionEntreno },
    alGuardar: (sel, fecha) => {
      if (!esIso(fecha) || fecha > hoyIso()) {
        aviso('Elige una fecha de hoy o anterior', true);
        return false;
      }
      return enviarStaff(
        { accion: 'entreno', fecha, jugadores: [...sel].map(([id, v]) => ({ id, asistio: v === true })) },
        `Lista del ${diaHoja(fecha, { day: 'numeric', month: 'long' })} guardada ✓`
      );
    },
  });
}

/* Comentarios de un partido */

function abrirComentarios(jornada) {
  const partidos = (estado.cf?.partidos || []).filter((p) => p.jornada);
  if (!partidos.length) return aviso('Aún no se han cargado los partidos de CopaFácil', true);
  const orden = [...partidos.filter((p) => p.finalizado).reverse(), ...partidos.filter((p) => !p.finalizado)];
  const selector = $('#com-partido');
  pintar(selector, orden.map((p) => h('option', {
    value: String(p.jornada),
    text: `Jornada ${p.jornada} · vs ${rivalDe(p).nombre}${p.finalizado ? ` (${p.golesLocal}-${p.golesVisitante})` : ''}`,
  })));
  selector.value = String(jornada ?? orden[0].jornada);
  selector.onchange = () => cargarComentariosEnDialogo(Number(selector.value));
  cargarComentariosEnDialogo(Number(selector.value));
  $('#dlg-comentar').showModal();
}

function cargarComentariosEnDialogo(jornada) {
  const deJornada = (estado.hoja?.comentarios || []).filter((c) => c.jornada === jornada);
  $('#com-equipo').value = deJornada.filter((c) => !c.jugadorId && !c.nombre).map((c) => c.texto).join('\n\n');
  $('#com-firma').value = deJornada[0]?.firma || recuperar(CLAVE_FIRMA) || '';
  pintar($('#com-jugadores'));
  deJornada.filter((c) => c.jugadorId).forEach((c) => anadirFilaComentario(c.jugadorId, c.texto));
}

function anadirFilaComentario(id = '', texto = '') {
  let opciones = jugadores();
  if (id && !opciones.some((j) => j.id === id) && jugadorPorId(id)) opciones = [...opciones, jugadorPorId(id)];
  const usados = new Set([...document.querySelectorAll('#com-jugadores select')].map((x) => x.value));
  const elegido = id || opciones.find((j) => !usados.has(j.id))?.id || opciones[0]?.id;

  const selector = h('select', { 'aria-label': 'Jugador' },
    opciones.map((j) => h('option', { value: j.id, text: `${j.dorsal ?? '–'} · ${j.nombre}` })));
  selector.value = elegido;
  const area = h('textarea', { rows: 2, maxlength: 2000, placeholder: 'Comentario para este jugador', 'aria-label': 'Comentario' });
  area.value = texto;
  const fila = h('div', { class: 'fila-comentario' }, selector,
    h('button', { type: 'button', class: 'cerrar', 'aria-label': 'Quitar comentario', onclick: () => fila.remove() }, '×'),
    area);
  $('#com-jugadores').append(fila);
  if (!id) area.focus();
}

async function guardarComentariosDialogo() {
  const jornada = Number($('#com-partido').value);
  const firma = $('#com-firma').value.trim();
  guardar(CLAVE_FIRMA, firma);
  const individuales = [...document.querySelectorAll('#com-jugadores .fila-comentario')]
    .map((f) => ({ id: f.querySelector('select').value, texto: f.querySelector('textarea').value.trim() }))
    .filter((c) => c.texto);
  const ok = await conBotonOcupado($('#guardar-comentarios'), () => enviarStaff(
    { accion: 'comentar', jornada, equipo: $('#com-equipo').value.trim(), jugadores: individuales, firma },
    `Comentarios de la jornada ${jornada} guardados ✓`
  ));
  if (ok) $('#dlg-comentar').close();
}

/* Plantilla: lista de todos los jugadores (también los no activos) */

function abrirPlantilla() {
  const todos = plantillaCompleta();
  pintar($('#lista-plantilla'), todos.map((j) => {
    const lesion = lesionDe(j.id);
    return h('li', {},
      h('button', { type: 'button', class: `fila-jugador${j.activo ? '' : ' inactivo'}`, onclick: () => abrirJugador(j.id) },
        h('span', { class: 'dorsal', text: j.dorsal ?? '–' }),
        h('span', { class: 'nombre' }, j.nombre,
          j.apodo ? h('small', { class: 'apagado', text: j.nombreOriginal }) : null),
        h('span', { class: 'marcas' },
          !j.activo ? h('span', { class: 'estado inactivo', text: 'No activo' }) : null,
          lesion ? h('span', { class: `estado ${lesion.estado}` }, lesion.estado === 'duda' ? 'Duda' : 'Baja') : null),
        h('span', { class: 'flecha', 'aria-hidden': 'true', text: '›' })));
  }));
  const activos = todos.filter((j) => j.activo).length;
  $('#contador-plantilla').textContent = `${activos} activos · ${todos.length - activos} no activos`;
  $('#dlg-plantilla').showModal();
}

/* Ficha de un jugador: dorsal, nombre en la web, activo, bajas y lesiones */

let ficha = null; // { id, tocadoLesion, tocadoDetalle, tocadaVuelta }

function marcarSegmento(sel, valor) {
  document.querySelectorAll(`${sel} [data-valor]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.valor === valor)));
}
const valorSegmento = (sel) => document.querySelector(`${sel} [aria-checked="true"]`)?.dataset.valor;

function abrirJugador(id) {
  const j = jugadorPorId(id);
  if (!j) return;
  const lesion = lesionDe(id);
  ficha = { id, tocadoLesion: false, tocadoDetalle: false, tocadaVuelta: false };
  $('#dlg-jugador-titulo').textContent = j.nombre;
  $('#dlg-jugador-original').textContent = `En CopaFácil: ${j.nombreOriginal}`;
  $('#jug-dorsal').value = j.dorsal ?? '';
  $('#jug-apodo').value = j.apodo;
  $('#jug-apodo').placeholder = j.nombreOriginal;
  marcarSegmento('#jug-activo', j.activo ? 'si' : 'no');
  marcarSegmento('#jug-estado', lesion?.estado || 'disponible');
  $('#jug-detalle').value = lesion?.detalle || '';
  $('#jug-vuelta').value = esIso(lesion?.vuelta) ? lesion.vuelta : '';
  $('#jug-mostrar-detalle').checked = Boolean(lesion?.detalle || lesion?.vuelta);
  $('#jug-lesion').hidden = !lesion;
  if ($('#dlg-plantilla').open) $('#dlg-plantilla').close();
  $('#dlg-jugador').showModal();
}

async function guardarJugador() {
  const dorsal = $('#jug-dorsal').value.trim();
  if (dorsal && !/^\d{1,3}$/.test(dorsal)) return aviso('El dorsal tiene que ser un número', true);
  const datos = {
    accion: 'jugador',
    id: ficha.id,
    dorsal,
    apodo: $('#jug-apodo').value.trim(),
    activo: valorSegmento('#jug-activo') !== 'no',
  };
  const estadoFisico = valorSegmento('#jug-estado') || 'disponible';
  const mostrarDetalle = $('#jug-mostrar-detalle').checked;
  // Solo se envía la lesión si se ha tocado, para no pisar lo que haya solo en la hoja.
  if (ficha.tocadoLesion) {
    datos.lesion = { estado: estadoFisico, mostrarDetalle };
    if (ficha.tocadoDetalle) datos.lesion.detalle = $('#jug-detalle').value.trim();
    if (ficha.tocadaVuelta) datos.lesion.vuelta = $('#jug-vuelta').value;
  }
  const ok = await conBotonOcupado($('#guardar-jugador'), () => enviarStaff(datos, 'Ficha guardada ✓'));
  if (!ok) return;

  // Se refleja al momento; la recarga de la hoja lo confirma después.
  if (estado.hoja) {
    estado.hoja.jugadores = (estado.hoja.jugadores || []).map((j) => (j.id === ficha.id
      ? { ...j, dorsal: dorsal ? Number(dorsal) : null, apodo: datos.apodo, activo: datos.activo }
      : j));
    if (datos.lesion) {
      const previa = lesionDe(ficha.id);
      const resto = (estado.hoja.lesiones || []).filter((l) => l.id !== ficha.id);
      estado.hoja.lesiones = estadoFisico === 'disponible' ? resto : [...resto, {
        id: ficha.id,
        nombre: jugadorPorId(ficha.id)?.nombreOriginal || '',
        estado: estadoFisico,
        detalle: mostrarDetalle ? datos.lesion.detalle ?? previa?.detalle ?? '' : '',
        vuelta: mostrarDetalle ? datos.lesion.vuelta ?? previa?.vuelta ?? '' : '',
      }];
    }
  }
  $('#dlg-jugador').close();
  pintarTodo();
}

function prepararFicha() {
  document.querySelectorAll('#jug-activo [data-valor]').forEach((b) => b.addEventListener('click', () => marcarSegmento('#jug-activo', b.dataset.valor)));
  document.querySelectorAll('#jug-estado [data-valor]').forEach((b) => b.addEventListener('click', () => {
    marcarSegmento('#jug-estado', b.dataset.valor);
    ficha.tocadoLesion = true;
    $('#jug-lesion').hidden = b.dataset.valor === 'disponible';
  }));
  $('#jug-detalle').addEventListener('input', () => { ficha.tocadoLesion = true; ficha.tocadoDetalle = true; });
  $('#jug-vuelta').addEventListener('input', () => { ficha.tocadoLesion = true; ficha.tocadaVuelta = true; });
  $('#jug-mostrar-detalle').addEventListener('change', () => { ficha.tocadoLesion = true; });
  $('#guardar-jugador').addEventListener('click', guardarJugador);
}

/* Editores sencillos: anuncios, aspectos a mejorar, normativa, quedadas y fotos */

const EDITORES_LISTA = {
  anuncios: {
    titulo: 'Anuncios',
    ayuda: 'Lo primero que se ve al entrar. «Importante» lo resalta arriba; «Caduca» lo oculta solo pasada esa fecha.',
    campos: [
      { k: 'titulo', e: 'Título', t: 'texto', max: 80 },
      { k: 'texto', e: 'Texto', t: 'area', max: 600 },
      { k: 'fecha', e: 'Fecha', t: 'fecha' },
      { k: 'caduca', e: 'Caduca', t: 'fecha' },
      { k: 'importante', e: 'Importante', t: 'check' },
    ],
    nuevo: () => ({ fecha: hoyIso(), titulo: '', texto: '', caduca: '', importante: false }),
  },
  mejorar: {
    titulo: 'Aspectos a mejorar',
    ayuda: 'Lo que toca trabajar. Déjalo en «Todo el equipo» o elige un jugador.',
    campos: [
      { k: 'para', e: 'Para', t: 'jugador' },
      { k: 'aspecto', e: 'Aspecto', t: 'texto', max: 80 },
      { k: 'detalle', e: 'Detalle', t: 'area', max: 400 },
    ],
    nuevo: () => ({ para: '', aspecto: '', detalle: '' }),
  },
  fuertes: {
    titulo: 'Puntos fuertes',
    ayuda: 'Lo que hacéis bien. Déjalo en «Todo el equipo» o elige un jugador.',
    campos: [
      { k: 'para', e: 'Para', t: 'jugador' },
      { k: 'aspecto', e: 'Punto fuerte', t: 'texto', max: 80 },
      { k: 'detalle', e: 'Detalle', t: 'area', max: 400 },
    ],
    nuevo: () => ({ para: '', aspecto: '', detalle: '' }),
  },
  normativa: {
    titulo: 'Normativa interna',
    ayuda: 'Las normas del equipo, una por ficha.',
    campos: [
      { k: 'norma', e: 'Norma', t: 'texto', max: 80 },
      { k: 'detalle', e: 'Detalle', t: 'area', max: 400 },
    ],
    nuevo: () => ({ norma: '', detalle: '' }),
  },
  quedadas: {
    titulo: 'Quedadas',
    ayuda: 'Cenas, calçotadas, cervezas… Las pasadas dejan de verse solas.',
    campos: [
      { k: 'plan', e: 'Plan', t: 'texto', max: 80 },
      { k: 'fecha', e: 'Fecha', t: 'fecha' },
      { k: 'hora', e: 'Hora', t: 'texto', max: 5, placeholder: '21:30' },
      { k: 'lugar', e: 'Lugar', t: 'texto', max: 80 },
      { k: 'organiza', e: 'Organiza', t: 'texto', max: 40 },
      { k: 'enlace', e: 'Enlace (mapa, info…)', t: 'texto', max: 200, placeholder: 'https://' },
    ],
    nuevo: () => ({ plan: '', fecha: '', hora: '', lugar: '', organiza: '', enlace: '' }),
  },
  fotos: {
    titulo: 'Fotos del grupo',
    ayuda: 'Sube la foto desde el móvil con «Elegir foto», o pega el enlace de una que ya tengas en Drive.',
    campos: [
      { k: 'titulo', e: 'Título', t: 'texto', max: 60 },
      { k: 'url', e: 'Foto', t: 'imagen', max: 300, placeholder: 'https://drive.google.com/… o sube una desde el móvil' },
      { k: 'fecha', e: 'Fecha', t: 'fecha' },
    ],
    nuevo: () => ({ titulo: '', url: '', fecha: hoyIso() }),
  },
};

let editorLista = null; // { tipo, filas: [] }

/** Reduce la foto antes de mandarla: un móvil hace fotos de 5 MB y no hace falta tanto. */
async function imagenComprimida(fichero, maxLado = 1400, calidad = 0.82) {
  const bitmap = await createImageBitmap(fichero, { imageOrientation: 'from-image' });
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
  lienzo.height = Math.max(1, Math.round(bitmap.height * escala));
  lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close?.();
  return lienzo.toDataURL('image/jpeg', calidad);
}

/** Sube la foto elegida a la carpeta de Drive del equipo y guarda su enlace. */
async function subirFoto(entradaFichero, campoUrl) {
  const fichero = entradaFichero.files?.[0];
  if (!fichero) return;
  if (!/^image\//.test(fichero.type)) return aviso('Eso no es una imagen', true);
  const previo = entradaFichero.parentElement.querySelector('.previo');
  entradaFichero.disabled = true;
  aviso('Subiendo la foto…');
  try {
    const datos = await imagenComprimida(fichero);
    const r = await enviarHoja(CONFIG.hoja, {
      accion: 'subirFoto', pin: recuperar(CLAVE_PIN),
      nombre: fichero.name, datos,
    });
    if (!r.ok) throw new Error(r.error || 'error');
    campoUrl.value = r.url;
    previo.src = r.url;
    previo.hidden = false;
    aviso('Foto subida ✓');
  } catch (e) {
    aviso(e.message === 'imagen_grande' ? 'La foto es demasiado grande' : 'No se ha podido subir la foto', true);
  } finally {
    entradaFichero.disabled = false;
    entradaFichero.value = '';
  }
}

function campoEditor(campo, valor) {
  const comun = { 'data-campo': campo.k, maxlength: campo.max, placeholder: campo.placeholder };
  let control;
  if (campo.t === 'jugador') {
    control = h('select', comun,
      h('option', { value: '', text: '— Todo el equipo —' }),
      plantillaCompleta().map((x) => h('option', { value: x.nombreOriginal, text: `${x.dorsal ?? '–'} · ${x.nombre}` })));
  } else if (campo.t === 'imagen') {
    control = h('input', { type: 'text', ...comun });
    control.value = valor ?? '';
    return h('label', { class: 'campo campo-imagen' },
      h('span', { text: campo.e }),
      control,
      h('div', { class: 'subir-foto' },
        h('input', {
          type: 'file', accept: 'image/*', class: 'elegir-foto',
          onchange: (ev) => subirFoto(ev.target, control),
        }),
        h('img', { class: 'previo', alt: '', hidden: !urlSegura(valor), src: urlSegura(valor) || null })));
  } else if (campo.t === 'area') control = h('textarea', { rows: 3, ...comun });
  else if (campo.t === 'fecha') control = h('input', { type: 'date', ...comun });
  else if (campo.t === 'check') control = h('input', { type: 'checkbox', ...comun });
  else control = h('input', { type: 'text', ...comun });
  if (campo.t === 'check') control.checked = valor === true;
  else control.value = esIso(valor) || campo.t !== 'fecha' ? valor ?? '' : '';
  if (campo.t === 'jugador' && !control.value) control.value = '';
  return campo.t === 'check'
    ? h('label', { class: 'casilla' }, control, h('span', { text: campo.e }))
    : h('label', { class: 'campo' }, h('span', { text: campo.e }), control);
}

function pintarEditorLista() {
  const def = EDITORES_LISTA[editorLista.tipo];
  pintar($('#lista-editor'), editorLista.filas.length
    ? editorLista.filas.map((fila, i) => h('article', { class: 'ficha-lista' },
        h('div', { class: 'campos' }, def.campos.map((c) => campoEditor(c, fila[c.k]))),
        h('button', {
          type: 'button', class: 'enlace-discreto', onclick: () => { recogerEditorLista(); editorLista.filas.splice(i, 1); pintarEditorLista(); },
        }, 'Eliminar')))
    : vacio('Todavía no hay nada. Pulsa «+ Añadir».'));
}

/** Pasa lo escrito en pantalla al estado (antes de añadir o borrar fichas). */
function recogerEditorLista() {
  const def = EDITORES_LISTA[editorLista.tipo];
  [...document.querySelectorAll('#lista-editor .ficha-lista')].forEach((ficha, i) => {
    const fila = editorLista.filas[i];
    if (!fila) return;
    def.campos.forEach((c) => {
      const control = ficha.querySelector(`[data-campo="${c.k}"]`);
      if (control) fila[c.k] = c.t === 'check' ? control.checked : control.value.trim();
    });
  });
}

function abrirEditorLista(tipo) {
  const def = EDITORES_LISTA[tipo];
  editorLista = { tipo, filas: (estado.hoja?.[tipo] || []).map((x) => ({ ...x })) };
  $('#dlg-lista-editor-titulo').textContent = def.titulo;
  $('#dlg-lista-editor-ayuda').textContent = def.ayuda;
  pintarEditorLista();
  $('#dlg-lista-editor').showModal();
}

async function guardarEditorLista() {
  recogerEditorLista();
  const tipo = editorLista.tipo;
  const filas = editorLista.filas.filter((f) => Object.values(f).some((v) => v !== '' && v !== false && v !== undefined));
  const ok = await conBotonOcupado($('#guardar-lista-editor'),
    () => enviarStaff({ accion: 'lista', tipo, filas }, 'Guardado ✓'));
  if (!ok) return;
  if (estado.hoja) estado.hoja[tipo] = filas;
  $('#dlg-lista-editor').close();
  pintarTodo();
}

/* Cumpleaños */

function abrirCumples() {
  const contar = () => {
    const n = [...document.querySelectorAll('#lista-cumples-editor input[type="date"]')].filter((i) => i.value).length;
    $('#contador-cumples').textContent = `${n} de ${document.querySelectorAll('#lista-cumples-editor .fila-cumple').length} con fecha`;
  };
  pintar($('#lista-cumples-editor'), plantillaCompleta().map((j) => {
    const cumple = (estado.hoja?.jugadores || []).find((x) => x.id === j.id)?.cumple || '';
    const fecha = h('input', { type: 'date', 'aria-label': `Cumpleaños de ${j.nombre}`, oninput: contar });
    fecha.dataset.id = j.id;
    // La hoja guarda la fecha completa; aquí solo se ve día y mes, así que se usa un año cualquiera.
    fecha.value = /^\d{2}-\d{2}$/.test(cumple) ? `2000-${cumple}` : '';
    const mostrar = h('input', { type: 'checkbox', 'aria-label': `Mostrar el cumpleaños de ${j.nombre}` });
    mostrar.dataset.mostrar = j.id;
    mostrar.checked = Boolean(cumple);
    return h('div', { class: 'fila-cumple' },
      h('span', { class: 'nombre', text: j.nombre }),
      fecha,
      h('label', { class: 'casilla' }, mostrar, h('span', { text: 'Mostrar' })));
  }));
  contar();
  $('#dlg-cumples').showModal();
}

async function guardarCumples() {
  const lista = [...document.querySelectorAll('#lista-cumples-editor input[type="date"]')].map((i) => ({
    id: i.dataset.id,
    cumple: i.value,
    mostrar: document.querySelector(`[data-mostrar="${i.dataset.id}"]`).checked && Boolean(i.value),
  }));
  const ok = await conBotonOcupado($('#guardar-cumples'), () => enviarStaff({ accion: 'cumples', jugadores: lista }, 'Cumpleaños guardados ✓'));
  if (!ok) return;
  if (estado.hoja?.jugadores) {
    const porId = new Map(lista.map((x) => [x.id, x]));
    estado.hoja.jugadores = estado.hoja.jugadores.map((j) => (porId.has(j.id)
      ? { ...j, cumple: porId.get(j.id).mostrar ? porId.get(j.id).cumple.slice(5) : null }
      : j));
  }
  $('#dlg-cumples').close();
  pintarTodo();
}

/* Horario habitual de entreno */

function abrirAjustesEntreno() {
  const e = estado.hoja?.entrenos?.proximo;
  $('#entreno-dias').value = estado.hoja?.ajustesEntreno?.dias || '';
  $('#entreno-hora').value = estado.hoja?.ajustesEntreno?.hora || (e?.habitual ? e.hora : '') || '';
  $('#entreno-lugar').value = estado.hoja?.ajustesEntreno?.lugar || (e?.habitual ? e.lugar : '') || '';
  $('#dlg-ajustes-entreno').showModal();
}

async function guardarAjustesEntreno() {
  const datos = {
    accion: 'ajustes',
    dias: $('#entreno-dias').value.trim(),
    hora: $('#entreno-hora').value.trim(),
    lugar: $('#entreno-lugar').value.trim(),
  };
  const ok = await conBotonOcupado($('#guardar-ajustes-entreno'), () => enviarStaff(datos, 'Horario guardado ✓'));
  if (!ok) return;
  if (estado.hoja) estado.hoja.ajustesEntreno = { dias: datos.dias, hora: datos.hora, lugar: datos.lugar };
  $('#dlg-ajustes-entreno').close();
}

/* Frase motivadora y mensaje del cuerpo técnico */

const SUGERENCIAS_FRASE = [
  'Garra, cabeza y corazón. Somos Black Panthers.',
  'Salimos a morder. Cada balón dividido es nuestro.',
  'Ni un balón por perdido, ni un compañero solo.',
  'La experiencia la traemos de casa; las ganas, las ponemos hoy.',
  'El escudo en el pecho y el equipo por delante.',
  'Hoy se corre por el de al lado.',
  'Somos manada: se gana juntos y se pierde juntos.',
  'Negro por fuera, naranja por dentro. ¡A por ellos!',
];

let tipoMensaje = 'motivador';

function contarFrase() {
  if (tipoMensaje !== 'motivador') return ($('#frase-contador').textContent = '');
  $('#frase-contador').textContent = `${$('#frase-texto').value.length} / 160`;
}

function abrirMensaje(tipo) {
  tipoMensaje = tipo;
  const esMotivador = tipo === 'motivador';
  const mensaje = estado.hoja?.mensajes?.[esMotivador ? 'motivador' : 'tecnico'];
  $('#dlg-frase-titulo').textContent = esMotivador ? 'Frase motivadora' : 'Mensaje del cuerpo técnico';
  $('#frase-etiqueta').textContent = esMotivador ? 'Frase que sale arriba del todo' : 'Mensaje que verá el equipo';
  $('#frase-texto').rows = esMotivador ? 3 : 6;
  $('#frase-texto').maxLength = esMotivador ? 160 : 2000;
  $('#frase-texto').value = mensaje?.texto || (esMotivador ? CONFIG.fraseMotivadora : '');
  $('#frase-campo-firma').hidden = esMotivador;
  $('#frase-firma').value = mensaje?.firma || '';
  $('#frase-titulo-sugerencias').hidden = !esMotivador;
  pintar($('#frase-sugerencias'), esMotivador ? SUGERENCIAS_FRASE.map((t) => h('li', {},
    h('button', { type: 'button', class: 'sugerencia', onclick: () => { $('#frase-texto').value = t; contarFrase(); $('#frase-texto').focus(); } }, t))) : []);
  contarFrase();
  $('#dlg-frase').showModal();
}

async function guardarFrase() {
  const texto = $('#frase-texto').value.trim();
  if (!texto) return aviso('Escribe algo primero', true);
  const firma = tipoMensaje === 'motivador' ? '' : $('#frase-firma').value.trim();
  const ok = await conBotonOcupado($('#guardar-frase'),
    () => enviarStaff({ accion: 'mensaje', tipo: tipoMensaje, texto, firma }, tipoMensaje === 'motivador' ? 'Frase actualizada ✓' : 'Mensaje actualizado ✓'));
  if (!ok) return;
  if (estado.hoja) {
    estado.hoja.mensajes = { ...estado.hoja.mensajes, [tipoMensaje]: { texto, firma, fecha: hoyIso() } };
  }
  $('#dlg-frase').close();
  pintarTodo();
}

function prepararStaff() {
  document.querySelector('[data-staff]').addEventListener('click', alternarStaff);
  $('#guardar-lista').addEventListener('click', guardarLista);
  document.querySelectorAll('[data-todos]').forEach((b) => b.addEventListener('click', () => {
    const valor = b.dataset.todos === 'si' ? lista.estados[0].valor : lista.estados[lista.estados.length - 1].valor;
    jugadores().forEach((j) => lista.seleccion.set(j.id, valor));
    pintarLista();
  }));
  $('#com-anadir').addEventListener('click', () => anadirFilaComentario());
  $('#guardar-comentarios').addEventListener('click', guardarComentariosDialogo);
  prepararFicha();
  $('#guardar-frase').addEventListener('click', guardarFrase);
  $('#guardar-roles').addEventListener('click', guardarRolesDialogo);
  $('#guardar-lista-editor').addEventListener('click', guardarEditorLista);
  $('#anadir-elemento').addEventListener('click', () => {
    recogerEditorLista();
    editorLista.filas.push(EDITORES_LISTA[editorLista.tipo].nuevo());
    pintarEditorLista();
    $('#lista-editor').scrollTop = $('#lista-editor').scrollHeight;
  });
  $('#guardar-cumples').addEventListener('click', guardarCumples);
  $('#votar-soy-yo').addEventListener('click', elegirmeComoVotante);
  $('#votar-guardar').addEventListener('click', guardarVoto);
  $('#guardar-ajustes-entreno').addEventListener('click', guardarAjustesEntreno);
  $('#form-cambiar-pin').addEventListener('submit', guardarPinNuevo);
  $('#dlg-cambiar-pin [data-cerrar]').addEventListener('click', () => $('#dlg-cambiar-pin').close());
  $('#frase-texto').addEventListener('input', contarFrase);
}

/* ───────────────────────── Navegación ───────────────────────── */

const VISTAS = ['equipo', 'competicion', 'tesoreria', 'roles', 'tercer-tiempo'];

function mostrarVista(desdeClic) {
  const pedida = location.hash.slice(1);
  if (pedida && !VISTAS.includes(pedida)) return;
  const actual = pedida || 'equipo';
  VISTAS.forEach((v) => { document.getElementById(v).hidden = v !== actual; });
  document.querySelectorAll('[data-pestana]').forEach((a) => {
    if (a.dataset.pestana === actual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (desdeClic) window.scrollTo({ top: 0 });
}

/* ───────────────────────── Arranque ───────────────────────── */

function iniciar() {
  estado.cf = recuperar(CLAVE_CF);
  estado.hoja = hayHoja() ? recuperar(CLAVE_HOJA) : null;
  estado.staff = hayHoja() && Boolean(recuperar(CLAVE_PIN));
  estado.nivel = ['admin', 'tesoreria'].includes(recuperar(CLAVE_NIVEL)) ? recuperar(CLAVE_NIVEL) : 'staff';
  estado.gestion = modoGestion();
  mostrarVista(false);

  window.addEventListener('hashchange', () => mostrarVista(true));
  document.querySelectorAll('[data-actualizar]').forEach((b) => b.addEventListener('click', () => actualizar({ manual: true })));
  $('#form-equipo').addEventListener('submit', entrarConPinEquipo);
  $('#form-quien').addEventListener('submit', decirQuienSoy);
  prepararStaff();
  aSalvo('la web', pintarTodo);
  apuntarEntrada();

  // Al volver a la pestaña tras un rato, se refresca solo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (estado.cf?.actualizado || 0) > 10 * 60000) actualizar();
  });

  actualizar();
}

iniciar();
