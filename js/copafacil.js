// Lectura de los datos públicos de CopaFácil (la misma base de datos que usa su web, sin iniciar sesión).
const BASE = 'https://copafacil-web.firebaseio.com/events';

// Códigos de la tabla de clasificación de CopaFácil.
const TABLA = { pts: 0, j: 1, g: 2, e: 3, p: 4, gf: 5, gc: 6, dif: 7, tr: 13, ta: 14 };
// Códigos de las estadísticas de jugador.
const JUGADOR = { goles: 0, j: 2, ta: 14, tr: 16 };

async function leer(ruta, filtro) {
  const url = new URL(`${BASE}/${ruta}.json`);
  if (filtro) {
    url.searchParams.set('orderBy', JSON.stringify(filtro.por));
    url.searchParams.set('equalTo', JSON.stringify(filtro.igual));
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`CopaFácil respondió ${r.status} en ${ruta}`);
    return (await r.json()) || {};
  } finally {
    clearTimeout(t);
  }
}

/** "1=1#9=0#5=3#" → {1: 1, 9: 0, 5: 3} */
function decodifica(cadena) {
  const res = {};
  String(cadena || '').split('#').forEach((par) => {
    const [k, v] = par.split('=');
    if (k !== '' && v !== undefined) res[k] = Number(v) || 0;
  });
  return res;
}

const limpia = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export async function cargarCopaFacil({ liga, evento, equipo }) {
  const [info, grupos, equipos, plantilla, campos] = await Promise.all([
    leer(`${evento}/info`),
    leer(`${evento}/fs`),
    leer(`${evento}/teams`),
    leer(`${evento}/player`, { por: 'team', igual: equipo }),
    leer(`${liga}/places`).catch(() => ({})),
  ]);
  const ligaInfo = await leer(`${liga}/info`).catch(() => ({}));

  const nuestro = equipos[equipo];
  if (!nuestro) throw new Error('No encuentro al equipo en CopaFácil');

  // El grupo (división) en el que juega el equipo.
  const grupoId =
    Object.keys(nuestro.dt || {}).find((g) => nuestro.dt[g]?.SH !== false && nuestro.dt[g]?.dt) ||
    Object.keys(nuestro.dt || {})[0];

  const [partidos, jornadas] = await Promise.all([
    leer(`${liga}/matchs`, { por: 'fs', igual: grupoId }),
    leer(`${evento}/m_set`, { por: 'fs', igual: grupoId }),
  ]);

  const infoEquipo = (id) => ({
    id,
    nombre: limpia(equipos[id]?.name) || 'Por definir',
    escudo: equipos[id]?.url || '',
  });

  // Equipos del grupo: los que ya tienen tabla + los que aparecen en el calendario (aunque aún no hayan jugado).
  const delGrupo = new Set(
    Object.keys(equipos).filter((id) => equipos[id].dt?.[grupoId]?.SH !== false && equipos[id].dt?.[grupoId]?.dt)
  );
  Object.values(partidos).forEach((m) => [m.team1, m.team2].forEach((id) => equipos[id] && delGrupo.add(id)));

  const clasificacion = [...delGrupo]
    .map((id) => {
      const g = equipos[id].dt?.[grupoId] || {};
      const d = decodifica(g.dt);
      const fila = { ...infoEquipo(id), pos: g.dt ? g.col ?? null : null, nuestro: id === equipo };
      for (const [k, cod] of Object.entries(TABLA)) fila[k] = d[cod] ?? 0;
      return fila;
    })
    .sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99) || b.pts - a.pts || b.dif - a.dif || b.gf - a.gf)
    .map((f, i) => ({ ...f, pos: i + 1 }));

  const numeroJornada = (id) => {
    const m = String(jornadas[id]?.title || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  const nuestros = Object.entries(partidos)
    .filter(([, m]) => m.team1 === equipo || m.team2 === equipo)
    .map(([id, m]) => {
      const finalizado = m.st === 3 || Boolean(m.finished);
      const campo = campos[m.l];
      return {
        id,
        jornada: numeroJornada(m.m_set),
        fecha: m.d_i || null,
        lugar: campo
          ? { nombre: limpia(campo.title), direccion: limpia(campo.address), lat: campo.loc?.lat || null, lon: campo.loc?.lon || null }
          : null,
        local: infoEquipo(m.team1),
        visitante: infoEquipo(m.team2),
        golesLocal: finalizado ? m.dt?.qt_g1 ?? 0 : null,
        golesVisitante: finalizado ? m.dt?.qt_g2 ?? 0 : null,
        finalizado,
        somosLocal: m.team1 === equipo,
        alineacion: [],
      };
    })
    .sort((a, b) => (a.fecha ?? Infinity) - (b.fecha ?? Infinity) || (a.jornada ?? 99) - (b.jornada ?? 99));

  // Alineación de cada partido ya jugado (quién aparece en el acta de CopaFácil).
  await Promise.all(nuestros.filter((p) => p.finalizado).map(async (p) => {
    try {
      const detalle = await leer(`${evento}/details/${p.id}`);
      p.alineacion = [...new Set(Object.values(detalle.list || {})
        .filter((x) => x.ac === 7 && x.team1 === equipo && x.pl_id1)
        .map((x) => String(x.pl_id1)))];
    } catch {
      p.alineacion = [];
    }
  }));

  const jugadores = Object.entries(plantilla)
    .map(([id, p]) => {
      const n = limpia(p.n);
      const m = n.match(/^(\d+)\s*(.*)$/);
      const st = decodifica(p.dt);
      return {
        id,
        nombre: limpia(p.name),
        dorsal: m ? Number(m[1]) : null,
        nota: m ? m[2] : n, // p. ej. "NO PUEDE JUGAR HASTA EL 28 SEPTIEMBRE 2026"
        foto: p.url || '',
        j: st[JUGADOR.j] || 0,
        goles: st[JUGADOR.goles] || 0,
        ta: st[JUGADOR.ta] || 0,
        tr: st[JUGADOR.tr] || 0,
      };
    })
    .sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    liga: {
      nombre: limpia(ligaInfo.info?.title) || 'Liga',
      temporada: limpia(info.info?.sub_title),
      grupo: limpia(grupos[grupoId]?.title),
    },
    equipo: clasificacion.find((f) => f.nuestro) || null,
    totalEquipos: clasificacion.length,
    clasificacion,
    partidos: nuestros,
    jugadores,
    actualizado: Date.now(),
  };
}
