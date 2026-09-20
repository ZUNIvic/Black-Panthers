// Ajustes de la web. Es lo único que hay que tocar al cambiar de temporada o conectar la hoja.
export const CONFIG = {
  equipo: 'Black Panthers F.C.',

  // CopaFácil: https://www.copafacil.com/-o2nrr@1e38
  copafacil: {
    liga: '-o2nrr',          // la liga (El Tancat)
    evento: '-o2nrr@1e38',   // la temporada 2026-2027
    equipo: '-OwzuKi8TTHWdaqkVAho', // Black Panthers FC dentro de CopaFácil
    web: 'https://www.copafacil.com/-o2nrr@1e38',
  },

  // URL de la "aplicación web" del script de la hoja de Google (ver GUIA-HOJA.md).
  // Mientras esté vacía, la web funciona solo con CopaFácil.
  hoja: '',

  // Frase que aparece si la hoja todavía no tiene mensaje motivador.
  fraseMotivadora: 'Garra, cabeza y corazón. Somos Black Panthers.',

  zonaHoraria: 'Europe/Madrid',
};
