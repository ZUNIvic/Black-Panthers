# Black Panthers F.C. — web del equipo

Web estática (HTML + CSS + JavaScript, sin instalaciones ni compilación) para el equipo de veteranos F7.

- **Equipo**: frase motivadora, escudo, anuncios, estadísticas, aspectos a mejorar y puntos fuertes
  (del equipo y jugador a jugador, con los comentarios de cada jornada), plantilla con la ficha de cada
  jugador, lesionados y normativa interna.
- **Competición**: MVP de la última jornada, próximo entreno y partido, instrucciones del cuerpo técnico,
  convocatoria, votación al MVP (la hacen los jugadores, sin PIN, y se cierra dos días después del
  partido; el podio sale con nota sobre 10), calendario, clasificación y resultados.
- **Tesorería**: cuotas y multas pendientes de cada jugador («Al día» si no debe nada).
- **Roles del equipo**: cuerpo técnico, capitanes, junta directiva y miembros fundadores.
- **Tercer tiempo**: quedadas, cumpleaños y fotos.

## De dónde salen los datos

| Dato | Fuente |
|---|---|
| Clasificación, calendario, resultados, plantilla, goles, tarjetas, partidos jugados | CopaFácil (lectura pública, sin usuario ni contraseña) |
| Anuncios, entrenos y asistencia, lesionados, mensajes, comentarios de partido, normativa, roles, tesorería, quedadas y fotos | Hoja de Google del equipo (solo filas con **Mostrar**) |
| Casi todo lo anterior | Se edita desde la web con PIN y se guarda en la hoja |

## Dos direcciones

| Para quién | Dirección | Qué se ve |
|---|---|---|
| **El equipo** | https://zunivic.github.io/Black-Panthers/ | Solo la web: nada de «Actualizar», «Importar desde CopaFácil» ni botón de PIN. |
| **Gestión** (administrador, míster y tesorero) | https://zunivic.github.io/Black-Panthers/?gestion | Lo mismo, más el botón para **entrar con PIN**. |

La dirección de gestión **no da acceso por sí sola**: solo enseña la puerta; para editar sigue haciendo
falta el PIN. El aparato se queda marcado como «de gestión» hasta que se abra `…/?gestion=0`, que lo
devuelve a ser uno normal. **Actualizar** e **Importar desde CopaFácil** solo los ve el administrador;
los datos de CopaFácil se refrescan solos al abrir la web y al volver a ella tras un rato.

## Permisos

| Quién | Qué edita |
|---|---|
| Jugadores (sin PIN) | Nada |
| PIN del míster | Convocatorias, comentarios de los partidos e instrucciones del cuerpo técnico |
| PIN del tesorero | Cuotas y multas |
| PIN de administrador | Todo, incluidos los tres PIN |

Los PIN se guardan en las propiedades del script, nunca en la hoja. Cada uno cambia solo el suyo;
el administrador cambia los tres y puede consultarlos.

## Archivos

```
index.html            estructura de la web
css/styles.css        estilos (naranja y negro)
js/config.js          ajustes: códigos de CopaFácil y URL de la hoja
js/copafacil.js       lectura de CopaFácil
js/hoja.js            lectura/escritura de la hoja
js/app.js             pintado de la web y convocatorias
apps-script/Codigo.gs script que se pega en la hoja de Google
GUIA-HOJA.md          guía paso a paso para crear la hoja
assets/               escudo e iconos
```

## Publicación

Se publica con GitHub Pages: cada cambio que se sube a la rama `main` se refleja en la web en 1-2 minutos.
