# Ideas de futuro — Todo el tiempo cuenta

Backlog de mejoras **posteriores al TFM** (versión profesional, con los tutores).
No se tocan durante el máster: aquí el alcance es cerrado y coherente. Esto es
para que ninguna buena idea se pierda.

> Regla: una idea entra aquí cuando es "buena pero no ahora". Cuando llegue su
> momento, se saca, se piensa bien (impacto, esfuerzo, riesgo) y se hace.

## Producto

- **Ranking real de "Colaboradores destacados".** Artistas ordenados por su
  valoración real (no testimonios de demo). Requiere agregar las valoraciones
  —que hoy son por evento— por artista, con una consulta y proyección pública
  nuevas. *(Idea del usuario, 2026-07; le gusta.)*

- **Sección "App" nativa.** Hoy se presenta como "Próximamente" (concepto). En
  el futuro, app móvil real.

- **Filtro por centro en "Huecos abiertos" (vista de artista).** Hoy un artista
  ve todos los huecos abiertos de todos los centros, sin forma de acotar. Con
  pocos centros se navega; con cien, no. Añadir un filtro por centro (y quizá
  por ciudad y tipo de centro), igual que el que ya existe en `/events`.
  **Sin implicación de privacidad**: esa vista es autenticada y solo la ven
  artistas activos, y **ya muestra el nombre del centro y la ubicación** del
  hueco (`slot.hospitalName` · `slot.location`) — el filtro no expondría nada
  nuevo, solo ordena lo que ya se ve. Es trabajo de UX, no de arquitectura.
  *(Idea del usuario, 2026-08.)*

- **Salas gestionables por el centro.** Hoy la "Ubicación" de un hueco es texto
  libre (ej. "Planta 2, sala de estar"). En el futuro, que el hospital pueda dar
  de alta sus **salas/espacios** y elegirlas de una lista al publicar un hueco
  (menos errores, datos consistentes, y base para capacidad/aforo o reservas de
  sala). *(Idea del usuario, 2026-07.)*

## Requiere decisión de arquitectura + legal (NO trivial)

- ~~**Filtro/relación evento ↔ centro.**~~ ✅ **HECHO (2026-08).** Estaba aquí
  como "imposible por diseño (D10)" y se hizo, pero **como tocaba**: no
  quitando el test que molestaba, sino revisando el ADR dos veces, por escrito
  y con motivo.
  1. `events-show-centre` — un evento **nombra su centro** (nombre + ciudad).
     Lo pedía la coherencia: una familia no puede ir a un evento si no sabe
     dónde es.
  2. `centre-event-counts` — cada centro muestra **cuántos eventos** tiene y
     enlaza a su lista filtrada. Se retiró la otra mitad de D10 porque ya no
     protegía nada: el mismo dato se sacaba en dos clics desde el filtro de
     eventos, así que las dos superficies solo se contradecían entre sí.

  **La línea de privacidad que lo sustituye:** la *institución y su nivel de
  actividad* son públicos; *la persona y el sitio exacto*, no. Siguen prohibidos
  y vigilados por tests: la planta/sala (`Slot.location`), la dirección postal,
  los títulos y fechas de eventos en el directorio, propuestas, correos e ids.
  Todo ello en `docs/security-threat-model.md` (nota `centre-event-counts`).

## (Añade aquí tus ideas)

-
