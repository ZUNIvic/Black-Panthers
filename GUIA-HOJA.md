# Guía: conectar la hoja de Google (10 minutos, una sola vez)

La hoja es donde tú y tu staff escribís todo lo que no viene de CopaFácil: anuncios, entrenos,
lesionados, mensajes, normativa, roles, tesorería, quedadas y fotos. La web la lee sola.

Nadie tiene que registrarse en nada: la hoja está en tu cuenta de Google y los jugadores solo abren la web.

---

## 1. Crear la hoja

1. Entra en **https://sheets.new** con tu cuenta de Google.
2. Arriba a la izquierda, ponle de nombre: **Black Panthers – Datos web**.
3. Menú **Archivo → Configuración → Zona horaria**: elige **(GMT+01:00) Madrid** y guarda.

## 2. Pegar el script

1. Menú **Extensiones → Apps Script**. Se abre una pestaña nueva con un editor.
2. Arriba a la izquierda, cambia "Proyecto sin título" por **Black Panthers web**.
3. Borra todo lo que hay en `Código.gs` y pega **entero** el contenido del archivo
   [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
4. Pulsa el icono del disquete 💾 (Guardar).

## 3. Preparar la hoja (crea las pestañas y trae la plantilla de CopaFácil)

1. En la barra de arriba del editor, en el desplegable de funciones, elige **`prepararHoja`**.
2. Pulsa **▶ Ejecutar**.
3. Google pedirá permiso. Es normal con scripts personales:
   - **Revisar permisos** → elige tu cuenta.
   - Saldrá "Google no ha verificado esta aplicación" → **Configuración avanzada** →
     **Ir a Black Panthers web (no seguro)** → **Permitir**.
   - El script es tuyo y solo toca esta hoja; el aviso sale siempre que alguien usa un script propio.
4. El script te pedirá **tres PIN** (de 4 a 8 cifras cada uno). Elígelos tú y **apúntalos**:
   - **PIN del míster**: convocatorias y comentarios de los partidos.
   - **PIN del tesorero**: cuotas y multas.
   - **Tu PIN de administrador**: lo puede todo.
5. Vuelve a la pestaña de la hoja: verás un aviso con los tres PIN y todas las pestañas creadas.
   Se guardan fuera de la hoja (en las propiedades del script). Si se te olvida alguno, desde la web
   y con tu PIN de administrador puedes **verlos** en cualquier momento.

## 4. Publicar el script para que la web lo pueda leer

1. En el editor de Apps Script: botón azul **Implementar → Nueva implementación**.
2. En el engranaje ⚙ de "Seleccionar tipo", elige **Aplicación web**.
3. Rellena:
   - Descripción: `Web`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
5. **Pásame esa URL** y la conecto a la web (o pégala tú en `js/config.js`, en `hoja: ''`).

> ¿Es seguro "Cualquier usuario"? Sí: esa dirección solo entrega lo que marquéis con **Mostrar**,
> y para cambiar cualquier cosa pide un PIN. La hoja en sí sigue siendo privada.

## 5. Rellenar lo básico

- **AJUSTES**: días, hora y lugar del entreno habitual (ej.: `Martes, Jueves` · `20:30` · `Camp UE Tancat`).
- **ANUNCIOS**: lo primero que se ve al entrar. Marca **Importante** para resaltarlo y **Caduca** para que desaparezca solo.
- **MENSAJES**: el de tipo **Motivador** sale arriba del todo, junto al escudo.
- **COMENTARIOS**: lo que dice el cuerpo técnico de cada partido. Número de jornada y, en **Para**,
  "Todo el equipo" o el jugador. Una fila por comentario; la web los agrupa por partido.
- **MEJORAR** y **FUERTES**: aspectos a mejorar y puntos fuertes. Deja **Para** vacío (o «Todo el equipo»)
  para algo del equipo, o elige un jugador para que salga en su ficha.
- **NORMATIVA**, **LESIONES**, **QUEDADAS**, **FOTOS**: una fila por cosa.
- **JUGADORES**: además de dorsal y apodo, cada jugador tiene **Nombre corto** (el que sale en Roles del equipo),
  **Roles** (Míster, Capitán, Segundo capitán, Presidente, Vicepresidente, Delegado, Tesorero, Vocal, Miembro fundador;
  separados por comas), **Cuotas pendientes** y **Multas pendientes** (número). Los roles del equipo ya vienen puestos.
- **AJUSTES**: el 2º y el 3er entrenador (salen solo con el nombre en Roles del equipo).
- **Regla de oro**: si la casilla **Mostrar** no está marcada, la web no lo enseña.

Los cambios tardan como mucho **1 minuto** en verse en la web.

## 6. Quién puede editar qué

En la web, el botón del candado **Staff** (arriba a la derecha) pide un PIN. Se pide una sola vez en
cada móvil. Según el PIN, aparecen unos botones u otros:

| Quién | Con qué PIN | Qué puede editar |
|---|---|---|
| **Los jugadores** | Ninguno | **Nada.** Solo mirar. |
| **El míster** | PIN del míster | Convocatorias (de cualquier jornada), comentarios de cada partido (al equipo y jugador a jugador) e instrucciones del cuerpo técnico. |
| **El tesorero** | PIN del tesorero | Cuotas y multas de cada jugador. |
| **Tú** | Tu PIN de administrador | Todo lo anterior y todo lo demás. |

Quien no tenga permiso no ve el botón; y si lo intentara igualmente, el script lo rechaza.

### Todo lo que puedes editar desde la web con tu PIN

| Apartado | Botón | Qué cambia |
|---|---|---|
| Equipo | **Cambiar frase** | La frase motivadora de arriba (con sugerencias). |
| Equipo | **Editar anuncios** | Anuncios: título, texto, fecha, si es importante y cuándo caduca. |
| Competición | **Pasar lista** / **Horario** | Asistencia a un entreno / días, hora y lugar del entreno habitual. |
| Equipo | **Editar plantilla** o **✎** | Ficha del jugador: dorsal, nombre en la web, activo y bajas o lesiones. |
| Equipo | **Editar bajas y lesiones** | Lo mismo, entrando por la lista de lesionados. |
| Equipo | **Editar** (aspectos a mejorar / puntos fuertes) | Del equipo o de un jugador concreto. Lo de cada jugador sale también en su ficha. |
| Competición | **Escribir instrucciones** | Instrucciones del cuerpo técnico para el próximo partido (también las puede escribir el míster). |
| Equipo | **Editar normativa** | Normas internas. |
| Competición | **Convocatoria** | Convocado / No viene / No convocado, en cualquier jornada. |
| Equipo y Competición | **Comentar** | Comentarios del partido, al equipo y a cada jugador. |
| Tesorería | **− / +** y **Guardar cambios** | Cuotas y multas pendientes de cada jugador. |
| Equipo / Tesorería | **Cambiar el PIN…** / **Ver los PIN** | El PIN del míster (en Equipo) y el de tesorería (en Tesorería). Tú puedes cambiar los tres y consultarlos. |
| Roles | **Editar roles** | Cuerpo técnico, capitanes, junta, fundadores y nombres cortos. |
| Tercer tiempo | **Editar quedadas / cumpleaños / fotos** | Quedadas, cumpleaños (día y mes) y fotos. |

**La votación al MVP**: en cada partido ya jugado sale un desplegable dorado «VOTA AL MVP». La usan los
jugadores **sin PIN**: eligen su nombre (solo la primera vez en cada móvil) y reparten de 1 a 3 estrellas
a todos los compañeros que jugaron, sin poder votarse a sí mismos. **La votación se cierra dos días
después del partido**; a partir de ahí el desplegable solo enseña el resultado. Al abrirlo aparece el
podio con los tres primeros y las **estrellas** que ha recibido cada uno. Nada de notas sobre 10: un
recuento de estrellas no se lee como un aprobado o un suspenso, y es lo mismo que ordena el podio. Las **estrellas de la temporada** de cada jugador las veis **solo el cuerpo técnico y tú**, en la columna
**★** de la plantilla y en la ficha. Los jugadores no la ven, ni siquiera la suya.
Lo que sí ve todo el equipo es la columna **MVP**: cuántas veces ha sido cada uno el mejor del partido.
Eso es un trofeo y motiva; una clasificación con notas, no. El MVP de la última jornada sí se ve nada más entrar en
**Competición**, para todos. Se puede cambiar el voto mientras esté abierta: el último sustituye al anterior. Todo
queda en la pestaña **VOTOS**.

**La ficha de cada jugador**: en la plantilla, al tocar a un jugador se abre su ficha con todas sus
estadísticas (partidos, % de partidos, faltas, entrenos, goles, tarjetas, convocatorias y nota MVP), sus puntos
fuertes, lo que tiene que mejorar y los comentarios que le ha dejado el cuerpo técnico. La puede ver todo el equipo.

En un partido **ya jugado**, la convocatoria es la lista de quién vino: «Vino» cuenta para el
**% de partidos** y «No vino» cuenta como **falta** (sale en rojo en la plantilla). Si en un partido no
hay convocatoria, se usa la alineación del acta de CopaFácil.

Los jugadores **no activos** no salen en estadísticas, convocatorias ni listas (no se borran: se pueden
reactivar desde **Editar plantilla**).

### El PIN del equipo

La web solo se abre con el **PIN del equipo**, el mismo para los 19 jugadores. Se escribe una vez en cada
móvil y no se vuelve a pedir. Sin él, el script no entrega **nada** (ni plantilla, ni cuotas, ni anuncios),
así que no vale con mirar el código de la página.

- Lo cambias tú desde **Equipo → Cambiar el PIN del equipo**, o desde la hoja con **🐾 Black Panthers →
  Cambiar PIN**. Al cambiarlo, todos tendrán que escribir el nuevo.
- Los PIN del míster, del tesorero y el tuyo también sirven para abrir la web: no hace falta llevar dos.
- Es un secreto compartido: protege de curiosos, no de alguien que se lo pida a un jugador. La
  clasificación y el calendario son públicos en CopaFácil de todas formas.

### Las dos direcciones

- **La del equipo** (la que mandas al grupo): la dirección normal. No enseña ni «Actualizar», ni
  «Importar desde CopaFácil», ni el botón del PIN. Los jugadores solo miran… y votan al MVP.
- **La de gestión** (la tuya, y la del míster y el tesorero): la misma dirección con **`?gestion`** al
  final. Añade el botón para entrar con PIN; **sin PIN no edita nada**, así que si el enlace se
  reenvía por error no pasa nada.
- Para que un móvil vuelva a ser «del equipo», se abre la dirección con **`?gestion=0`**.
- **Actualizar** e **Importar desde CopaFácil** solo los ve el administrador. Da igual: la web trae los
  datos de CopaFácil sola al abrirla y cada vez que se vuelve a ella pasados unos minutos.

### Quién entra en la web

Al entrar, después del PIN, cada uno **elige su nombre** una vez en su móvil. Con eso:

- En **Equipo → Quién entra en la web** (solo lo ves tú y el cuerpo técnico) sale la lista de **todos**
  los jugadores con las entradas de los **últimos 7 días**, el **total** y la **última vez**. Los que no
  han entrado nunca salen con «nunca», que es justo lo que querías saber.
- Se apunta como mucho una entrada por jugador cada media hora, para no llenar la hoja.
- Queda en la pestaña **ENTRADAS**.

### Quién va al entreno

Debajo del cuadro amarillo del próximo entreno hay un desplegable **«Jugadores que van al entreno»**:
cada uno pulsa **Voy** o **No voy** y todo el equipo ve la lista. Es solo una previsión, **no cuenta
como asistencia**: la asistencia de verdad la sigue pasando el cuerpo técnico con «Pasar lista», y es la
que cuenta para las estadísticas. Queda en la pestaña **PREENTRENO**.

### La prelista y la lista definitiva

En **Competición → Convocatoria** hay ahora dos listas, las dos visibles para todo el equipo:

1. **Prelista**: cada jugador pulsa **Voy** o **No voy** para el próximo partido. Se guardan **por orden
   de apuntarse** y se numeran, tal y como dice la normativa («las 8 plazas restantes por orden de
   inscripción»). Cada uno solo puede tocar lo suyo, y puede cambiar de opinión o borrarse.
2. **Lista definitiva**: la sigue haciendo el cuerpo técnico con su PIN. Es la que manda.

Queda en la pestaña **PRELISTA**.

### Avisar por WhatsApp

Con el PIN del míster o el tuyo, debajo de la convocatoria sale **«Avisar por WhatsApp»**: abre WhatsApp
con el mensaje ya escrito (jornada, rival, día, hora, campo y el enlace de la web). Tú eliges el grupo y
envías. La web no puede mandarlo sola: WhatsApp no lo permite sin pagar.

### Las fotos del tercer tiempo

En **Tercer tiempo → Editar fotos** puedes **subir la foto directamente desde el móvil** con «Elegir
foto»: la web la reduce, la guarda en tu Drive (carpeta «Black Panthers — fotos de la web», compartida
con «cualquiera con el enlace») y pone el enlace sola. También puedes pegar a mano el enlace de una foto
que ya tengas. La primera vez hay que activarlo desde la hoja: **🐾 Black Panthers → Activar la subida de
fotos** (Google pedirá permiso para tu Drive).

### El MVP a mano

Si en un partido no votó nadie (o el cuerpo técnico quiere decidirlo), en el desplegable del MVP de ese
partido hay un selector **«MVP a mano»**. Lo que se elija ahí manda sobre la votación y sale en la
cabecera de Competición.

### Los PIN

- Son cuatro: **equipo**, **míster**, **tesorero** y **administrador**.
- **Cada uno cambia solo el suyo**: el míster, desde **Equipo**; el tesorero, desde **Tesorería**.
  Tú, con tu PIN de administrador, puedes cambiar los tres y **verlos** (botón **Ver los PIN**).
- **Desde la hoja**: menú **🐾 Black Panthers → Cambiar PIN**. Solo funciona para el propietario de la hoja.
- Los tres tienen que ser **distintos entre sí**; el script no deja repetirlos.
- **No hace falta teclearlo cada vez**: cada móvil u ordenador lo recuerda hasta que se pulse
  «Salir del modo staff» o se borren los datos del navegador.
- Si cambias el del míster o el del tesorero, avísales: los dispositivos con el antiguo pedirán el nuevo.

### Dónde está cada cosa en la web

| Apartado | Qué contiene |
|---|---|
| **Equipo** | Escudo y frase, anuncios, estadísticas, aspectos a mejorar y puntos fuertes (con los comentarios de cada jornada desplegables), plantilla, lesionados y normativa. |
| **Competición** | Próximo entreno y próximo partido, instrucciones del cuerpo técnico, convocatoria, **estrategia**, **votación al MVP**, calendario, clasificación y resultados. |
| **Tesorería** | Cuotas y multas pendientes de cada jugador. |
| **Roles del equipo** | Cuerpo técnico, capitanes, junta directiva y fundadores. |
| **Tercer tiempo** | Quedadas, cumpleaños y fotos. |

---

## Preguntas frecuentes

**He cambiado el código del script y la web no lo nota.**
Hay que publicar versión nueva: **Implementar → Gestionar implementaciones → ✏️ Editar →
Versión: Nueva versión → Implementar**. La URL no cambia.

**Ha fichado alguien nuevo.**
Menú de la hoja **🐾 Black Panthers → Actualizar jugadores desde CopaFácil**. (Al convocar desde la web
también se actualiza sola si detecta a alguien nuevo.)

**Las fotos no se ven.**
En Google Drive, la foto tiene que estar compartida como **"Cualquier persona con el enlace"**.
Los álbumes de Google Fotos se muestran como enlace, no como miniatura.

**Un entreno cambia de día o de sitio.**
Añade una fila en **ENTRENOS** con la fecha, hora y lugar nuevos, y marca **Mostrar**.
Tiene prioridad sobre el horario habitual.

**Pasar lista en un entreno.**
En **ENTRENOS**, en la fila de ese día, marca a los que vinieron. Un entreno sin nadie marcado
no cuenta para el porcentaje de asistencia.

**Nueva temporada en CopaFácil.**
Cambia el código de temporada (`evento`, ahora `-o2nrr@1e38`) en `js/config.js` y en el script
(`COPAFACIL.evento`), y publica versión nueva del script.
