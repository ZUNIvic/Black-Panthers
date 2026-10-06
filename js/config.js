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
  hoja: 'https://script.google.com/macros/s/AKfycbwYtX2GZ3D3TKWUwfm9eKLT3sN6QxLNEv5apXl-6qedDEugeXe1z3srxBxulnETpgAcTg/exec',

  // Carpeta de Drive con los partidos grabados. Vacío = no sale el apartado.
  // Tiene que estar compartida con «cualquiera con el enlace».
  grabaciones: 'https://drive.google.com/drive/folders/1pbioOV3hZgjXoUbXO__GwfP84iiFbxr2',

  // Frase que aparece si la hoja todavía no tiene mensaje motivador.
  fraseMotivadora: 'Garra, cabeza y corazón. Somos Black Panthers.',

  zonaHoraria: 'Europe/Madrid',
};
