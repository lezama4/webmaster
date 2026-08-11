# Guion técnico — Vídeo de presentación · "Todo el tiempo cuenta"

**Dirección de rodaje para un vídeo de una sola persona (tú), grabado en casa
con OBS.** Integra la narración a Brais, la demo en vivo del producto, los
planos y la dirección de actuación. No es para leer en cámara: es el mapa desde
el que grabas.

## Ficha técnica

| | |
|---|---|
| **Destinatario** | Brais Moure (tutor del Máster) |
| **Duración** | ~9–10 min |
| **Formato** | 1920×1080, 30 fps, MP4 |
| **Registro** | Screencast + cámara (picture-in-picture), OBS Studio |
| **Tono** | Personal, honesto, cercano. Le hablas a una persona, no a un tribunal. |
| **Apoyos** | `tfm-pitch-deck.pptx` (9 slides) + la web desplegada (demo en vivo) |

## Los tres planos (Escenas de OBS)

Crea **tres escenas** en OBS y vas cambiando entre ellas:

- **PLANO A · "Cámara"** — tú a pantalla (casi) completa. Para los momentos
  personales: apertura, el porqué, las decisiones y el cierre.
- **PLANO B · "Diapositiva"** — el slide llena la pantalla, tú en un recuadro
  pequeño en una esquina (abajo a la izquierda, para no tapar el número de
  página). Para la narración con apoyo visual.
- **PLANO C · "Demo"** — el navegador llena la pantalla (la web real), tú en el
  mismo recuadro pequeño. Para el recorrido en vivo.

> Cambiar de plano = clic en la escena correspondiente de OBS. Usa **corte
> seco** o un **fundido de 0,3 s** (Ajustes → Transiciones). Nada más.

## Escaleta (orden de rodaje)

| # | Escena | Plano | Slide / pantalla | Aprox | Acumulado |
|---|--------|-------|------------------|------:|----------:|
| 1 | Apertura | A | — (tú) | 0:35 | 0:35 |
| 2 | De dónde nace | B | Slide 2 | 1:00 | 1:35 |
| 3 | Qué es | B | Slide 5 | 0:50 | 2:25 |
| 4 | Cómo funciona | B | Slide 6 | 0:45 | 3:10 |
| 5 | **Demo en vivo** | C | Navegador | 2:35 | 5:45 |
| 6 | Las decisiones | A | (o Slide 8) | 1:30 | 7:15 |
| 7 | A quién ayuda | B | Slide 7 | 0:45 | 8:00 |
| 8 | Honestidad | B | Slide 9 | 0:45 | 8:45 |
| 9 | Cierre | A | — (tú) | 0:45 | 9:30 |

---

# GUION DETALLADO

> Cada escena: **PLANO** · **EN PANTALLA** · **DIÁLOGO** (guía, no lo leas) ·
> **DIRECCIÓN** (cómo actuarlo).

## ESCENA 1 — Apertura · `0:00`
- **PLANO A** (Cámara).
- **EN PANTALLA:** tú, mirando al objetivo.
- **DIÁLOGO:**
  > "Hola, Brais. Te voy a presentar mi proyecto de fin de máster, y te lo voy a
  > contar sin tecnicismos — toda la parte técnica la tienes en el repositorio,
  > documentada. Aquí quiero contarte lo que de verdad importa: qué es, por qué
  > lo hice y para quién."
- **DIRECCIÓN:** Sonríe. Contacto visual directo. Este primer plano es la
  conexión humana: que se note que le hablas a él. Sin prisa.

## ESCENA 2 — De dónde nace · `0:35`
- **PLANO B** (Diapositiva). **Transición desde A.**
- **EN PANTALLA:** Slide 2 — *"el tiempo pesa"*.
- **DIÁLOGO** *(es personal — cuéntalo con tus palabras):*
  > "Empezó con algo muy personal. Un familiar mío ingresado en un hospital, y el
  > paso de las horas… ese tiempo que se hace eterno, que pesa. Y pensé: no tiene
  > por qué ser tiempo perdido. Podría ser tiempo con vida — una actividad,
  > música, un taller. No quería hacer un proyecto de juguete para aprobar;
  > quería construir algo que sirviera de verdad a gente real."
- **DIRECCIÓN:** Baja el ritmo. Es el corazón emocional del vídeo. Permítete una
  pausa después de "que pesa". La verdad de tu anécdota vale más que cualquier
  frase perfecta.

## ESCENA 3 — Qué es · `1:35`
- **PLANO B.** **EN PANTALLA:** Slide 5 — *"Todo el tiempo cuenta"*.
- **DIÁLOGO:**
  > "De ahí sale Todo el tiempo cuenta. Es una plataforma que conecta a los
  > centros de cuidado — hospitales, residencias, centros de día — con artistas o
  > fundaciones dispuestos a aportar, para llevar actividades a quienes más las
  > necesitan. En una frase: convertir el tiempo de espera en tiempo de vida."
- **DIRECCIÓN:** Sube ligeramente la energía. Es el giro de "problema" a
  "solución": que se te note que aquí empieza lo bueno.

## ESCENA 4 — Cómo funciona · `2:25`
- **PLANO B.** **EN PANTALLA:** Slide 6 — *los 4 pasos*.
- **DIÁLOGO:**
  > "Por encima, funciona en cuatro pasos. El centro abre un hueco en su agenda.
  > Varios artistas proponen. El centro elige la que mejor encaja. Y esa
  > actividad se convierte en un evento real que las familias pueden ver.
  > **Y esto no te lo cuento en abstracto: te lo enseño, ahora mismo, en la web
  > real.**"
- **DIRECCIÓN:** La última frase es el **puente a la demo**. Dila mirando a
  cámara, con un punto de "mirá esto". Ahí cortas a PLANO C.

## ESCENA 5 — DEMO EN VIVO · `3:10`  ⏱ el momento clave
- **PLANO C** (Demo — navegador + tú en la esquina).
- **PREPARADO DE ANTEMANO** (ver "Montaje de la demo" abajo): dos ventanas
  logueadas (centro y artista) y una pestaña en `/events`.

**5.1 · El centro abre un hueco** — *[ventana Centro, "Tus huecos"]*
  > "Aquí soy el centro. Abro un hueco de mi agenda."
  - **ACCIÓN:** rellenas el formulario **"Publicar un hueco"** — título
    *"Concierto de guitarra para la planta"*, descripción, **fecha futura**,
    duración, ubicación, público — y pulsas **"Publicar hueco"**.
  > "Ya está publicado, aquí lo tengo, en estado abierto."

**5.2 · La artista propone** — *[ventana Artista, "Huecos abiertos"]*
  > "Ahora soy una artista. Veo justo el hueco que el centro acaba de publicar."
  - **ACCIÓN:** **"Proponer una actividad"** → escribes en *"Tu propuesta"*
    (*"Puedo ofrecer un repertorio acústico adaptado a la sala"*) → **"Enviar
    propuesta"**.
  > "Enviada. El centro la revisará." *(aparece el mensaje en verde)*

**5.3 · El centro elige** — *[ventana Centro]*
  > "Vuelvo a ser el centro."
  - **ACCIÓN:** **refresca la ventana** (la otra no se entera sola). Bajo tu
    hueco aparece la propuesta con el nombre y el mensaje de la artista. Pulsas
    **"Aprobar"**.
  > "Y mira qué pasa solo: el hueco pasa a 'lleno', y se crea el evento."

**5.4 · El resultado público** — *[pestaña `/events`, "Próximos eventos"]*
  > "Y esto es lo que ve cualquiera, sin registrarse."
  - **ACCIÓN:** refresca; aparece el evento nuevo.
  > "El evento, publicado. Y fíjate: se ve la actividad, cuándo, en qué centro y
  > cuánta gente cabe —lo que una familia necesita para poder ir—. Pero nunca la
  > sala exacta, ni datos de nadie."

- **CIERRE DE DEMO** *(vuelta a los slides, PLANO B o A):*
  > "Eso es Todo el tiempo cuenta funcionando de verdad. No una maqueta."
- **DIRECCIÓN:** **Ensaya la demo entera una vez sin grabar.** Ve sin prisa;
  cada clic, un segundo de pausa para que se lea en pantalla. Si algo falla, para
  y repite el paso: se corta en edición.

## ESCENA 6 — Las decisiones de las que estoy orgulloso · `5:45`
- **PLANO A** (Cámara) — *o PLANO B con Slide 8 si prefieres apoyo.*
  Recomiendo **A**: es tu momento fuerte y gana en cercanía mirándote a ti.
- **DIÁLOGO:**
  > "Te cuento tres decisiones, porque creo que son las que hacen que esto sea un
  > proyecto y no solo una demo.
  > La primera: no es 'el primero que llega'. El centro elige la propuesta que
  > mejor encaja con sus personas. Es una decisión de producto: prioriza el
  > criterio humano.
  > La segunda: la privacidad y la dignidad, lo primero. Es un entorno de salud,
  > así que desde el minuto uno diseñé todo para que nunca se expusiera nada
  > delicado.
  > Y la tercera, la que más me costó: la disciplina de alcance. Preferí hacer una
  > cosa entera y bien hecha antes que cinco a medias. Suena menos vistoso, pero
  > creo que es la decisión más madura del proyecto."
- **DIRECCIÓN:** Seguro pero humilde. Marca las tres con los dedos si te sale
  natural. Aquí demuestras criterio sin tocar una línea de código — que se note
  que sabes por qué hiciste lo que hiciste.

## ESCENA 7 — A quién ayuda · `7:15`
- **PLANO B.** **EN PANTALLA:** Slide 7 — *"A quién ayuda"*.
- **DIÁLOGO:**
  > "¿Y a quién ayuda? A tres a la vez: a las personas, que reciben un rato de
  > vida; a las familias, que ven que a los suyos los acompañan; y a los artistas,
  > que encuentran dónde su talento suma. Y no es solo para hospitales: sirve para
  > residencias, centros de día, hospitales de día, centros ocupacionales y
  > unidades de cuidados paliativos."
- **DIRECCIÓN:** Cálido. Al enumerar los tipos de centro, no corras: cada uno es
  gente distinta a la que llegas.

## ESCENA 8 — Honestidad · `8:00`
- **PLANO B.** **EN PANTALLA:** Slide 9 — *"Está funcionando hoy"*.
- **DIÁLOGO** *(ya has enseñado que funciona; aquí el foco es la honestidad):*
  > "Acabas de verlo funcionando, así que no te lo tengo que vender. Lo que sí
  > quiero es ser honesto con lo que está hecho y lo que queda para el futuro —
  > está todo documentado en el repo, sin adornos. Prefiero que veas exactamente
  > dónde estoy antes que venderte humo."
- **DIRECCIÓN:** Sereno, maduro. La honestidad aquí es un punto fuerte, no una
  disculpa.

## ESCENA 9 — Cierre · `8:45`
- **PLANO A** (Cámara). **Transición desde B.**
- **EN PANTALLA:** tú, mirando al objetivo.
- **DIÁLOGO:**
  > "Y si te soy sincero, Brais, más que un proyecto de máster siento que he
  > construido algo que podría ayudar a gente real. He aprendido a dirigir un
  > proyecto de principio a fin, a decidir y a defender mis decisiones, y a decir
  > 'no' a lo que sobraba. Esto es Todo el tiempo cuenta. Gracias por acompañarme
  > en el camino."
- **DIRECCIÓN:** Cierre emotivo y tranquilo. Mira a cámara. **Aguanta la mirada
  un segundo en silencio antes de cortar** — ese silencio final le da peso.

---

## Montaje de la demo (preparar ANTES de grabar la Escena 5)

- **Ventana 1 (normal)** → logueada como **CENTRO**: `hospital.sanjuan@vtt.test`
  / `VivetuTiempo2026!` → en **"Tus huecos"**.
- **Ventana 2 (incógnito)** → logueada como **ARTISTA**: `artist.clara@vtt.test`
  / misma contraseña → en **"Huecos abiertos"**.
- **Pestaña** en `/events` ("Próximos eventos").
- El hueco que publiques debe tener **fecha futura** (el sistema lo exige).
- Nota honesta: la demo **crea datos reales** en la web (un hueco y un evento
  nuevos). Es normal; si quieres dejarla impecable, se pueden limpiar después.

## Notas del director

- **Graba por bloques, no de una tirada.** Cada escena por separado y luego las
  unes. Baja muchísimo la presión y si te equivocas repites solo esa escena.
- **Cabezas y colas:** deja ~2 s de silencio al empezar y al terminar cada toma.
  Te da margen para cortar limpio en edición.
- **Si te trabas, no cortes la grabación:** para, respira, y repite la frase
  desde el principio. En edición te quedas con la buena.
- **Mira a la cámara, no a la pantalla.** Es lo que hace que Brais sienta que le
  hablas a él.
- **Micro decente y sala en silencio** valen más que cualquier cámara cara.
- Ten un vaso de agua cerca. Vídeo de 10 minutos, la voz se seca.

## Checklist antes de grabar

- [ ] OBS con las 3 escenas (A / B / C) creadas y probadas.
- [ ] Deck abierto (en modo ventana si tienes un solo monitor).
- [ ] Dos ventanas logueadas (centro + artista) y pestaña `/events`.
- [ ] Grabación de prueba de 30 s revisada: cara con luz, micro limpio, no tapas
      texto de los slides.
- [ ] Portada del deck con tu nombre (no `[AUTOR]`). ✔ ya está.

## Post-producción

1. Une los bloques y corta los errores (cualquier editor sirve: CapCut, DaVinci
   Resolve gratis, o incluso Clipchamp de Windows).
2. Exporta a **MP4 1080p**.
3. Sube a **YouTube (oculto)** o Drive con acceso **"cualquiera con el enlace"**.
4. **Pruébalo en incógnito** antes de pegar la URL en el formulario.
