// TFM defense deck — Vivetutiempo ("Todo el tiempo cuenta")
// Generated with pptxgenjs. 17 slides. Calm sage/slate palette.
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
p.author = "Vivetutiempo";
p.title = "Vivetutiempo — TFM Defence";

// ---- palette ----
const INK = "22302F";       // near-black slate green (body text)
const DEEP = "1E2B2D";      // dark slide bg
const SLATE = "2F4A4E";     // primary
const SAGE = "84B59F";      // secondary
const EUCA = "69A297";      // supporting
const ACCENT = "50808E";    // slate-blue accent
const CREAM = "F5F5F2";     // light bg
const CARD = "FFFFFF";      // card bg on light
const CARDLINE = "E4E7E3";  // hairline
const MUTED = "6B7A78";     // muted text
const CARDDK = "27383A";    // card bg on dark

const SANS = "Calibri";
const SERIF = "Cambria";
const W = 13.3, H = 7.5, M = 0.7;

// ---- helpers ----
function bg(slide, color) { slide.background = { color }; }

function pageNum(slide, n) {
  slide.addText(String(n).padStart(2, "0"), {
    x: W - 1.0, y: H - 0.5, w: 0.6, h: 0.3, align: "right",
    fontFace: SANS, fontSize: 10, color: MUTED,
  });
}

function kicker(slide, text, color) {
  slide.addText(text.toUpperCase(), {
    x: M, y: 0.55, w: W - 2 * M, h: 0.3,
    fontFace: SANS, fontSize: 12, bold: true, color: color || EUCA,
    charSpacing: 3, margin: 0,
  });
}

function title(slide, text, color) {
  slide.addText(text, {
    x: M, y: 0.92, w: W - 2 * M, h: 1.1,
    fontFace: SERIF, fontSize: 30, bold: true, color: color || SLATE,
    margin: 0, lineSpacingMultiple: 0.98,
  });
}

// rounded card
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || CARD },
    line: opts.line === null ? { type: "none" } : { color: opts.line || CARDLINE, width: 1 },
    shadow: opts.shadow ? { type: "outer", color: "9AA8A5", opacity: 0.28, blur: 8, offset: 3, angle: 90 } : undefined,
  });
}

// numbered circle motif
function numCircle(slide, x, y, d, label, fill, tcolor) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill || SAGE }, line: { type: "none" } });
  slide.addText(String(label), {
    x, y, w: d, h: d, align: "center", valign: "middle",
    fontFace: SANS, fontSize: 15, bold: true, color: tcolor || "FFFFFF", margin: 0,
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  const runs = items.map((t, i) => ({
    text: t,
    options: {
      bullet: { code: "2022", indent: 16 },
      fontFace: SANS, fontSize: opts.fontSize || 14.5, color: opts.color || INK,
      paraSpaceAfter: opts.gap != null ? opts.gap : 9, breakLine: true,
    },
  }));
  slide.addText(runs, { x, y, w, h, valign: "top", margin: 0 });
}

// mono/code block on light
function codeBlock(slide, text, x, y, w, h) {
  card(slide, x, y, w, h, { fill: "1E2B2D", line: null });
  slide.addText(text, {
    x: x + 0.2, y: y + 0.12, w: w - 0.4, h: h - 0.24, valign: "middle",
    fontFace: "Courier New", fontSize: 12.5, color: "CFE3DC", margin: 0, lineSpacingMultiple: 1.05,
  });
}

// ============================================================ SLIDE 1 — Title
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  // motif: three soft dots
  [SAGE, EUCA, ACCENT].forEach((c, i) =>
    s.addShape("ellipse", { x: M + i * 0.32, y: 1.5, w: 0.18, h: 0.18, fill: { color: c }, line: { type: "none" } }));
  s.addText("VIVETUTIEMPO — TRABAJO FIN DE MÁSTER", {
    x: M, y: 2.0, w: W - 2 * M, h: 0.35, fontFace: SANS, fontSize: 13, bold: true, color: SAGE, charSpacing: 3, margin: 0,
  });
  s.addText("Todo el tiempo cuenta", {
    x: M, y: 2.45, w: W - 2 * M, h: 1.1, fontFace: SERIF, fontSize: 52, bold: true, color: "FFFFFF", margin: 0,
  });
  s.addText("Coordinación segura de actividades culturales en centros de cuidado — hospitales y cinco tipos más.", {
    x: M, y: 3.7, w: 9.6, h: 0.8, fontFace: SANS, fontSize: 18, color: "CFE3DC", margin: 0, lineSpacingMultiple: 1.1,
  });
  // flow strip
  const flow = "Centro  →  Artista  →  Decisión  →  Evento publicado  →  Personas y familias";
  s.addText(flow, { x: M, y: 4.9, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 15, bold: true, color: EUCA, margin: 0 });
  s.addText("[AUTOR] · Máster [programa] · Curso [año] · Tutor/a [nombre]", {
    x: M, y: 6.4, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 13, italic: true, color: "9FB4AF", margin: 0,
  });
  s.addNotes("Este proyecto no es un sistema clínico y no gestiona historiales de salud. Aborda un problema de coordinación más acotado pero real: convertir el tiempo disponible en centros de cuidado — un hospital, pero también una residencia, un centro de día, un hospital de día, un centro ocupacional o una unidad de cuidados paliativos — y las ofertas culturales en eventos públicos seguros y trazables.");
})();

// ============================================================ SLIDE 2 — Problem
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "El problema"); title(s, "El tiempo disponible requiere coordinación, no solo buenas ideas");
  const items = [
    "Las personas en centros de cuidado — y sus familias — pasan largos periodos esperando, acompañando o recuperándose.",
    "Las actividades culturales y humanas pueden mejorar esa experiencia.",
    "Lo difícil es la coordinación operativa: disponibilidad, propuestas, aprobación, gobernanza y comunicación pública segura.",
    "El contexto asistencial vuelve sensibles, por sí mismo, la ubicación, la identidad y los mensajes privados.",
  ];
  bullets(s, items, M, 2.15, 6.9, 4.4, { gap: 14, fontSize: 15.5 });
  // right: coordination gap visual
  const rx = 8.1, rw = 4.5;
  ["Agenda del centro", "Oferta del artista", "Información pública"].forEach((t, i) => {
    const cy = 2.2 + i * 1.05; card(s, rx, cy, rw, 0.85, { shadow: true, line: null });
    s.addText(t, { x: rx + 0.3, y: cy, w: rw - 0.6, h: 0.85, valign: "middle", fontFace: SANS, fontSize: 14, bold: true, color: SLATE, margin: 0 });
  });
  card(s, rx, 5.5, rw, 0.9, { fill: SLATE, line: null });
  s.addText("La capa de coordinación que falta", { x: rx, y: 5.5, w: rw, h: 0.9, align: "center", valign: "middle", fontFace: SANS, fontSize: 15, bold: true, color: "FFFFFF", margin: 0 });
  pageNum(s, 2);
  s.addNotes("El diferenciador no es inventar cultura en entornos de cuidado. Es modelar la capa de coordinación que conecta un hueco disponible en un centro con propuestas de actividad que compiten, preservando gobernanza y confidencialidad.");
})();

// ============================================================ SLIDE 3 — Solution flow
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "La solución"); title(s, "Vivetutiempo: del hueco de agenda al evento público");
  const steps = [
    ["1", "El centro publica un hueco de agenda (Slot)."],
    ["2", "Artistas activos envían propuestas que compiten."],
    ["3", "El centro propietario acepta una o rechaza."],
    ["4", "La aceptación crea y publica un Evento."],
    ["5", "Cualquiera navega los eventos publicados de forma anónima."],
  ];
  let y = 2.2;
  steps.forEach(([n, t], i) => {
    numCircle(s, M, y, 0.5, n, i === 2 ? ACCENT : SAGE);
    s.addText(t, { x: M + 0.75, y: y - 0.02, w: 7.4, h: 0.55, valign: "middle", fontFace: SANS, fontSize: 15.5, color: INK, margin: 0 });
    y += 0.82;
  });
  // right note card
  card(s, 8.6, 2.2, 4.0, 3.8, { fill: SLATE, line: null });
  s.addText("No es orden de llegada", { x: 8.9, y: 2.5, w: 3.4, h: 0.5, fontFace: SERIF, fontSize: 19, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("Un hueco puede tener varias propuestas y el centro elige la que mejor encaja en su contexto — la misma regla para un hospital, una residencia o una unidad de paliativos.", { x: 8.9, y: 3.1, w: 3.4, h: 2.6, fontFace: SANS, fontSize: 14, color: "CFE3DC", margin: 0, lineSpacingMultiple: 1.12 });
  pageNum(s, 3);
  s.addNotes("La regla central no es deliberadamente 'primero que llega'. Un Slot puede tener varias propuestas y el centro propietario elige la que mejor encaja en su contexto — la misma regla para un hospital, una residencia o una unidad de paliativos.");
})();

// ============================================================ SLIDE 4 — MVP scope
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Alcance del MVP"); title(s, "Profundidad antes que amplitud");
  const rows = [
    ["Bloque 1 · Núcleo", "Onboarding, coordinación Slot/Propuesta, publicación de Eventos, navegación pública.", "Desplegado y cubierto por tests ejecutados. Hardening y dominio en revisión (PR #31/#32).", SAGE],
    ["Bloque 2 · Valoración", "Una valoración por cuenta Paciente/Familia y evento completado.", "Implementado (PR #10, mergeado).", EUCA],
    ["Bloque 3 · Mecenazgo", "Campañas simuladas tras un puerto PaymentGateway.", "Simulación sin pagos reales (PR #12, mergeado).", ACCENT],
  ];
  let y = 2.15;
  rows.forEach(([b, sc, st, c]) => {
    card(s, M, y, W - 2 * M, 1.28, { shadow: true, line: null });
    s.addShape("roundRect", { x: M, y, w: 0.14, h: 1.28, rectRadius: 0.04, fill: { color: c }, line: { type: "none" } });
    s.addText(b, { x: M + 0.35, y: y + 0.12, w: 3.0, h: 1.05, valign: "top", fontFace: SANS, fontSize: 15, bold: true, color: SLATE, margin: 0 });
    s.addText(sc, { x: M + 3.5, y: y + 0.12, w: 4.6, h: 1.05, valign: "top", fontFace: SANS, fontSize: 13, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(st, { x: M + 8.3, y: y + 0.12, w: 3.4, h: 1.05, valign: "top", fontFace: SANS, fontSize: 13, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    y += 1.45;
  });
  s.addText("Seis tipos de centro (D16–D20): mergeado y desplegado. Sin EHR, app nativa, pagos reales, Kubernetes ni AWS en el MVP.", { x: M, y: y + 0.02, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 13, italic: true, color: MUTED, margin: 0 });
  pageNum(s, 4);
  s.addNotes("El alcance es intencionadamente secuencial. Un núcleo completo y demostrable es más defendible que varios módulos a medias. Los pagos reales quedan explícitamente fuera; el bloque simulado modela solo un límite de adaptador. La generalización a seis tipos de centro está mergeada y desplegada; la revisión nativa de euskera y el reseed de producción siguen pendientes.");
})();

// ============================================================ SLIDE 5 — Tech choices
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Decisiones técnicas"); title(s, "Tecnología, y el porqué de cada elección");
  const cells = [
    ["Next.js · TypeScript · Tailwind", "Un repositorio web con entrega tipada y UI."],
    ["PostgreSQL · Prisma", "Persistencia transaccional; adaptadores verificados contra Postgres real en CI."],
    ["Vitest · Playwright", "Unit, integración y E2E, los tres ejecutándose en CI."],
    ["Vercel · Postgres gestionado", "Desplegado y en vivo."],
    ["Monolito sobre microservicios", "Menos modos de fallo distribuido sin una necesidad actual."],
    ["Sesiones en BD sobre JWT", "Revocación inmediata tras rechazo/desactivación de perfil."],
  ];
  const cw = (W - 2 * M - 0.4) / 2, ch = 1.25; let i = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const x = M + c * (cw + 0.4), y = 2.15 + r * (ch + 0.3);
    card(s, x, y, cw, ch, { shadow: true, line: null });
    s.addText(cells[i][0], { x: x + 0.25, y: y + 0.14, w: cw - 0.5, h: 0.5, fontFace: SANS, fontSize: 14.5, bold: true, color: SLATE, margin: 0 });
    s.addText(cells[i][1], { x: x + 0.25, y: y + 0.6, w: cw - 0.5, h: 0.55, fontFace: SANS, fontSize: 13, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    i++;
  }
  pageNum(s, 5);
  s.addNotes("El proyecto elige simplicidad intencionada. Microservicios o Kubernetes añadirían complejidad de despliegue y observabilidad sin mejorar este flujo. Las sesiones se eligen porque la gobernanza exige revocación, no porque JWT sea inherentemente incorrecto.");
})();

// ============================================================ SLIDE 6 — Hexagonal
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Arquitectura"); title(s, "Hexagonal en un único repositorio");
  const layers = [
    ["domain/", "Entidades sin framework, máquinas de estado, reglas puras."],
    ["application/", "Casos de uso y puertos; orquesta el dominio."],
    ["infrastructure/", "Repositorios Prisma, 3 units of work transaccionales, sesiones, hashing, rate limiting, HTTP."],
    ["ui/ · app/", "Presentación + entradas finas de Next.js: 5 páginas públicas, 3 áreas de rol, 11 rutas API mutantes."],
  ];
  let y = 2.15;
  layers.forEach(([h, d]) => {
    card(s, M, y, 6.9, 0.98, { shadow: true, line: null });
    s.addText(h, { x: M + 0.25, y: y + 0.1, w: 2.3, h: 0.8, valign: "middle", fontFace: "Courier New", fontSize: 15, bold: true, color: ACCENT, margin: 0 });
    s.addText(d, { x: M + 2.5, y: y + 0.1, w: 4.2, h: 0.8, valign: "middle", fontFace: SANS, fontSize: 12.5, color: INK, margin: 0, lineSpacingMultiple: 1.02 });
    y += 1.12;
  });
  // right — orthogonal axes
  card(s, 8.1, 2.15, 4.5, 4.45, { fill: SLATE, line: null });
  s.addText("Dos ejes ortogonales (D16–D20)", { x: 8.35, y: 2.35, w: 4.0, h: 0.5, fontFace: SERIF, fontSize: 17, bold: true, color: "FFFFFF", margin: 0 });
  s.addText([
    { text: "Rol", options: { fontFace: SANS, fontSize: 13, bold: true, color: SAGE, breakLine: true, paraSpaceAfter: 2 } },
    { text: "admin · centre · artist · patient  → autorización", options: { fontFace: SANS, fontSize: 12.5, color: "CFE3DC", breakLine: true, paraSpaceAfter: 12 } },
    { text: "Tipo de centro (CentreType)", options: { fontFace: SANS, fontSize: 13, bold: true, color: SAGE, breakLine: true, paraSpaceAfter: 2 } },
    { text: "hospital · nursing_home · day_centre · day_hospital · occupational_centre · palliative_unit  → dato", options: { fontFace: SANS, fontSize: 12.5, color: "CFE3DC", breakLine: true, paraSpaceAfter: 12 } },
    { text: "Añadir un séptimo tipo es dato, no código: un valor de enum + una migración + una etiqueta i18n. Cero cambios en guards ni en el predicado de seguridad.", options: { fontFace: SANS, fontSize: 12.5, italic: true, color: "FFFFFF", breakLine: true } },
  ], { x: 8.35, y: 2.95, w: 4.0, h: 3.5, valign: "top", margin: 0 });
  pageNum(s, 6);
  s.addNotes("La prueba arquitectónica es simple: las reglas de negocio deben seguir siendo testeables si reemplazamos Prisma o el framework de entrega. La afirmación graduable más fuerte del proyecto vive aquí: como rol y tipo de centro son ejes separados, ampliar de un tipo de centro a seis tocó el eje de datos y el copy, pero no la superficie de autorización — el predicado de seguridad siguió siendo un único literal, type: 'CENTRE', nunca una lista de seis valores.");
})();

// ============================================================ SLIDE 7 — State machines
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Modelo de dominio"); title(s, "Máquinas de estado explícitas");
  const machines = [
    ["Profile", "pending → active | rejected\nactive → deactivated\nrejected → pending"],
    ["Slot", "open → filled | closed"],
    ["Proposal", "submitted → accepted | rejected"],
    ["Event", "created → published → completed"],
  ];
  const cw = (W - 2 * M - 0.4) / 2, ch = 1.55; let i = 0;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const x = M + c * (cw + 0.4), y = 2.15 + r * (ch + 0.3);
    card(s, x, y, cw, ch, { shadow: true, line: null });
    s.addShape("ellipse", { x: x + 0.28, y: y + 0.28, w: 0.42, h: 0.42, fill: { color: [SAGE, EUCA, ACCENT, SLATE][i] }, line: { type: "none" } });
    s.addText(machines[i][0], { x: x + 0.85, y: y + 0.24, w: cw - 1.1, h: 0.5, valign: "middle", fontFace: SERIF, fontSize: 18, bold: true, color: SLATE, margin: 0 });
    s.addText(machines[i][1], { x: x + 0.3, y: y + 0.85, w: cw - 0.6, h: 0.6, fontFace: "Courier New", fontSize: 12.5, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
    i++;
  }
  s.addText("Las factorías fuerzan el estado inicial; las transiciones rechazan cambios ilegales. Reglas de dominio testeadas sin framework ni base de datos.", { x: M, y: 6.35, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 13, italic: true, color: MUTED, margin: 0 });
  pageNum(s, 7);
  s.addNotes("Los estados explícitos hacen visibles los caminos inválidos. Por ejemplo, una Propuesta terminal no puede volver a aceptarse, y un Perfil no activo no puede ejecutar sus acciones de rol. El estado 'completed' del Evento es una costura deliberada para el Bloque 2.");
})();

// ============================================================ SLIDE 8 — Critical invariant
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Invariante crítico"); title(s, "Aceptar una propuesta resuelve el Slot entero");
  s.addText("Precondiciones: centro propietario activo · Slot abierto · propuesta enviada que coincide.", { x: M, y: 2.05, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 14, color: MUTED, margin: 0 });
  const out = [
    ["Propuesta elegida", "→ accepted"],
    ["Slot", "→ filled"],
    ["Rivales enviadas", "→ rejected"],
    ["Nuevo Evento", "→ published"],
  ];
  const cw = (W - 2 * M - 0.9) / 4;
  out.forEach(([a, b], i) => {
    const x = M + i * (cw + 0.3), y = 2.6;
    card(s, x, y, cw, 1.25, { shadow: true, line: null });
    s.addText(a, { x: x + 0.15, y: y + 0.2, w: cw - 0.3, h: 0.5, align: "center", fontFace: SANS, fontSize: 13.5, bold: true, color: SLATE, margin: 0 });
    s.addText(b, { x: x + 0.15, y: y + 0.72, w: cw - 0.3, h: 0.4, align: "center", fontFace: "Courier New", fontSize: 14, color: EUCA, bold: true, margin: 0 });
  });
  s.addText("Una operación pura, cuatro resultados. Cerrar un Slot rechaza igualmente cada propuesta enviada.", { x: M, y: 4.05, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 13.5, italic: true, color: MUTED, margin: 0 });
  codeBlock(s, "lock Slot primero  →  releer Slot + todas las propuestas  →  decisión pura  →  persistencia atómica", M, 4.7, W - 2 * M, 0.85);
  s.addText("Nueve escenarios de carrera forzados con barreras en ambos órdenes, ejecutados contra PostgreSQL real en CI — no contra dobles en memoria.", { x: M, y: 5.75, w: W - 2 * M, h: 0.7, fontFace: SANS, fontSize: 13.5, bold: true, color: SLATE, margin: 0, lineSpacingMultiple: 1.05 });
  pageNum(s, 8);
  s.addNotes("La idea clave vino de una revisión adversarial: bloquear después de una decisión es demasiado tarde. Una propuesta concurrente podría sobrevivir en un Slot filled. El contrato se implementa como SELECT … FOR UPDATE sobre la fila del Slot antes de cualquier lectura que informe la decisión, y está probado — nueve escenarios de carrera forzados con barreras explícitas en ambos órdenes, ejecutados contra PostgreSQL real en CI.");
})();

// ============================================================ SLIDE 9 — SDD
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Proceso"); title(s, "Spec-Driven Development");
  const flow = ["Propuesta", "Especificaciones", "Diseño / ADRs", "Plan de tareas", "Implementación", "Verificación", "Revisión"];
  let x = M; const y = 2.3, bw = 1.62, gap = 0.12;
  flow.forEach((t, i) => {
    card(s, x, y, bw, 0.8, { fill: i % 2 ? EUCA : SAGE, line: null });
    s.addText(t, { x: x + 0.05, y, w: bw - 0.1, h: 0.8, align: "center", valign: "middle", fontFace: SANS, fontSize: 11.5, bold: true, color: "FFFFFF", margin: 0 });
    x += bw + gap;
  });
  bullets(s, [
    "La propuesta define problema, alcance y criterios de éxito.",
    "Las especificaciones usan escenarios concretos Given/When/Then.",
    "Los ADRs convierten requisitos en decisiones técnicas y alternativas descartadas.",
    "Las tareas dan trazabilidad de diseño a implementación y verificación.",
  ], M, 3.5, W - 2 * M, 2.6, { gap: 12, fontSize: 15 });
  pageNum(s, 9);
  s.addNotes("La especificación no es documentación escrita al final. Es el contrato usado para decidir qué debe implementarse y, tan importante como eso, qué no debe afirmarse todavía.");
})();

// ============================================================ SLIDE 10 — AI as tool
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Método"); title(s, "La IA como herramienta de ingeniería dirigida");
  const flow = ["Decisión humana", "Tarea de IA acotada", "Código / artefacto de revisión", "Validación humana"];
  let x = M; const y = 2.3, bw = 2.85, gap = 0.25;
  flow.forEach((t, i) => {
    card(s, x, y, bw, 0.95, { shadow: true, line: null });
    s.addText(t, { x: x + 0.15, y, w: bw - 0.3, h: 0.95, align: "center", valign: "middle", fontFace: SANS, fontSize: 13, bold: true, color: SLATE, margin: 0 });
    if (i < 3) s.addText("→", { x: x + bw - 0.02, y, w: gap, h: 0.95, align: "center", valign: "middle", fontFace: SANS, fontSize: 18, bold: true, color: EUCA, margin: 0 });
    x += bw + gap;
  });
  bullets(s, [
    "El trabajo de IA está acotado por especificaciones, límites de alcance y reglas de capa.",
    "Roles distintos para implementación y para revisión adversarial independiente.",
    "El juicio humano posee requisitos, trade-offs, aceptación y responsabilidad final.",
    "Artefactos, tests e informes de revisión hacen el proceso inspeccionable.",
  ], M, 3.7, W - 2 * M, 2.5, { gap: 12, fontSize: 15 });
  pageNum(s, 10);
  s.addNotes("El valor de la IA es aceleración con restricciones, no corrección automática. El proyecto trata la salida generada como una entrada a un proceso de ingeniería revisable, no como evidencia por sí misma.");
})();

// ============================================================ SLIDE 11 — Adversarial review
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  kicker(s, "Revisión adversarial", SAGE); title(s, "Evidencia de rigor, no solo caminos felices", "FFFFFF");
  const rows = [
    ["Planificación", "Carrera por lectura obsoleta.", "Diseño lock-first del MatchingUnitOfWork."],
    ["Dominio", "Faltaba soporte de persistencia para DEACTIVATED y trazabilidad de re-registro.", "Esquema/migración aplicada a BD vacía en CI."],
    ["Aplicación", "Un allow-list de TypeScript no es redacción en runtime; el re-registro no probaba credenciales.", "DTO campo a campo con test HTTP no-leak; re-registro verificado por contraseña."],
  ];
  let y = 2.2;
  rows.forEach(([a, f, r]) => {
    card(s, M, y, W - 2 * M, 1.28, { fill: CARDDK, line: null });
    s.addText(a, { x: M + 0.3, y: y + 0.12, w: 2.2, h: 1.05, valign: "top", fontFace: SANS, fontSize: 14, bold: true, color: SAGE, margin: 0 });
    s.addText("Hallazgo: " + f, { x: M + 2.6, y: y + 0.12, w: 4.7, h: 1.05, valign: "top", fontFace: SANS, fontSize: 12.5, color: "E7EEEB", margin: 0, lineSpacingMultiple: 1.05 });
    s.addText("Resultado: " + r, { x: M + 7.5, y: y + 0.12, w: 4.2, h: 1.05, valign: "top", fontFace: SANS, fontSize: 12.5, color: "CFE3DC", margin: 0, lineSpacingMultiple: 1.05 });
    y += 1.45;
  });
  s.addText("Los hallazgos que quedaron abiertos se registraron como abiertos — y los de dominio y hardening ahora están cerrados y en revisión (PR #31/#32).", { x: M, y: y + 0.05, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 13, italic: true, color: "9FB4AF", margin: 0 });
  pageNum(s, 11);
  s.addNotes("Este es un diferenciador central del proyecto. El proceso de revisión no oculta defectos. Los convierte en cambios de diseño explícitos o en compuertas de release. Los hallazgos de dominio y hardening que la revisión dejó abiertos ahora están cerrados y en revisión.");
})();

// ============================================================ SLIDE 12 — Testing
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Estrategia de calidad"); title(s, "Tests donde está el riesgo");
  // pyramid as stacked cards
  const levels = [
    ["E2E", "Navegación pública, cadena de demo completa, matriz de denegación de autorización — ejecutados en CI.", 5.0],
    ["Integración", "Transacciones Postgres, locks, índices parciales y adaptador de sesión — serial, ejecutados en CI.", 7.5],
    ["Unit (aplicación)", "Roles, chequeos de perfil vivo, orquestación de casos de uso, contratos de puerto.", 9.8],
    ["Unit (dominio)", "Estados, factorías, propiedad, cascadas y transiciones ilegales.", 11.9],
  ];
  let y = 2.15;
  levels.forEach(([h, d, w], i) => {
    const x = M + (11.9 - w) / 2;
    card(s, x, y, w, 0.92, { fill: [ACCENT, EUCA, SAGE, SLATE][i], line: null });
    s.addText(h, { x: x + 0.25, y: y + 0.1, w: 2.4, h: 0.72, valign: "middle", fontFace: SANS, fontSize: 14, bold: true, color: "FFFFFF", margin: 0 });
    s.addText(d, { x: x + 2.7, y: y + 0.08, w: w - 2.9, h: 0.78, valign: "middle", fontFace: SANS, fontSize: 11.5, color: "F2F6F4", margin: 0, lineSpacingMultiple: 1.0 });
    y += 1.05;
  });
  card(s, M, 6.35, W - 2 * M, 0.75, { fill: "1E2B2D", line: null });
  s.addText([
    { text: "Evidencia titular:  ", options: { fontFace: SANS, fontSize: 14, color: "CFE3DC" } },
    { text: "suite verde en CI contra PostgreSQL real + Playwright.  ", options: { fontFace: SANS, fontSize: 14, bold: true, color: "FFFFFF" } },
    { text: "[AUTOR: refrescar recuentos exactos el día de la defensa]", options: { fontFace: SANS, fontSize: 12.5, italic: true, color: SAGE } },
  ], { x: M + 0.3, y: 6.35, w: W - 2 * M - 0.6, h: 0.75, valign: "middle", margin: 0 });
  pageNum(s, 12);
  s.addNotes("El TDD estricto selectivo se enfoca en las reglas más valiosas: transiciones de estado e invariantes de negocio. Los dobles en memoria prueban orquestación pero no un row lock o un rollback — por eso la evidencia de concurrencia viene de PostgreSQL real en CI. Localmente estos tests de carrera se saltan por defecto; CI con un Postgres local es el registro autoritativo. Refrescá los recuentos exactos antes de la defensa.");
})();

// ============================================================ SLIDE 13 — Security
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Seguridad por diseño"); title(s, "Minimizar la superficie pública y privilegiada");
  // three columns: allow-list / never / hardening
  const cols = [
    ["Salida pública permitida", SAGE, [
      "Título, descripción, fecha/hora, duración",
      "Nombre artístico del artista",
      "Directorio: tipo de centro (categoría de 6 valores), ciudad, CP, coordenadas",
    ]],
    ["Nunca se expone", ACCENT, [
      "Sala/planta, mensaje de propuesta",
      "Email, IDs internos, type interno",
      "Ninguna sub-etiqueta más fina que la categoría",
    ]],
    ["Controles implementados", SLATE, [
      "argon2id parametrizado, sesiones revocables (solo hash)",
      "CSRF en las 11 rutas mutantes; falla cerrado si falta APP_ORIGIN",
      "Headers + CSP con nonce + audit de dependencias (PR #32)",
    ]],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  cols.forEach(([h, c, items], i) => {
    const x = M + i * (cw + 0.3), y = 2.15, ch = 3.7;
    card(s, x, y, cw, ch, { shadow: true, line: null });
    s.addShape("ellipse", { x: x + 0.25, y: y + 0.25, w: 0.3, h: 0.3, fill: { color: c }, line: { type: "none" } });
    s.addText(h, { x: x + 0.65, y: y + 0.2, w: cw - 0.85, h: 0.5, valign: "middle", fontFace: SANS, fontSize: 14, bold: true, color: SLATE, margin: 0 });
    bullets(s, items, x + 0.25, y + 0.85, cw - 0.5, ch - 1.1, { gap: 10, fontSize: 12.5, color: INK });
  });
  card(s, M, 6.1, W - 2 * M, 0.95, { fill: "F0EDE4", line: "E3DFD2" });
  s.addText([
    { text: "Riesgo aceptado y documentado (T-22):  ", options: { fontFace: SANS, fontSize: 13, bold: true, color: "8A6D3B" } },
    { text: "ampliar el onboarding a residencias, centros ocupacionales y paliativos eleva el listón de protección (adultos vulnerables) mientras la verificación sigue siendo autodeclarada con validación de admin. Verificación institucional real = siguiente hito, no un control ya existente. Falta aún: logging de seguridad.", options: { fontFace: SANS, fontSize: 12, color: "6B5B36" } },
  ], { x: M + 0.3, y: 6.1, w: W - 2 * M - 0.6, h: 0.95, valign: "middle", margin: 0, lineSpacingMultiple: 1.02 });
  pageNum(s, 13);
  s.addNotes("La seguridad es arquitectura e implementación. Los controles que una revisión anterior del threat model llamó pendientes — el DTO público en runtime, CSRF en cada ruta, el adaptador de sesión, el rate limiting atómico — están integrados y cada uno cita un test que se ejecutó. Los headers, el CSP con nonce y el escaneo de dependencias ahora están implementados (PR #32, en revisión). Lo que sigue sin estar es el logging de seguridad. Es un MVP defendible, no un servicio listo para internet, y el threat model lo dice control por control.");
})();

// ============================================================ SLIDE 14 — Demo scenario
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Demostración"); title(s, "La historia de extremo a extremo a mostrar");
  const steps = [
    "El admin activa un perfil de Centro y uno de Artista.",
    "El Centro activo publica un Slot futuro.",
    "Un Artista activo envía una Propuesta; un segundo puede competir.",
    "El Centro propietario acepta una Propuesta.",
    "El sistema rellena el Slot, rechaza rivales y publica un Evento.",
    "Un visitante anónimo ve solo la proyección pública del Evento.",
  ];
  let y = 2.15;
  steps.forEach((t, i) => {
    numCircle(s, M, y, 0.48, i + 1, i === 4 ? ACCENT : SAGE);
    s.addText(t, { x: M + 0.72, y: y - 0.02, w: 7.7, h: 0.52, valign: "middle", fontFace: SANS, fontSize: 14.5, color: INK, margin: 0 });
    y += 0.72;
  });
  card(s, 9.0, 2.15, 3.6, 4.3, { fill: SLATE, line: null });
  s.addText("Probado, no aspiracional", { x: 9.3, y: 2.45, w: 3.0, h: 0.5, fontFace: SERIF, fontSize: 17, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("e2e/demo-chain.spec.ts automatiza exactamente estos seis pasos y pasa en CI contra Postgres real. Un test compañero verifica que la respuesta pública contiene solo los campos permitidos.", { x: 9.3, y: 3.05, w: 3.0, h: 2.2, fontFace: SANS, fontSize: 13, color: "CFE3DC", margin: 0, lineSpacingMultiple: 1.12 });
  s.addText("[AUTOR] Decidir demo del día: grabada (identificada como tal, misma revisión desplegada) o en vivo diciendo que CI es el registro reproducible.", { x: 9.3, y: 5.3, w: 3.0, h: 1.0, fontFace: SANS, fontSize: 11.5, italic: true, color: SAGE, margin: 0, lineSpacingMultiple: 1.05 });
  pageNum(s, 14);
  s.addNotes("Esta cadena no es aspiracional: e2e/demo-chain.spec.ts automatiza exactamente estos seis pasos y pasó en CI contra PostgreSQL real y datos semilla, y un test compañero afirma que la respuesta pública contiene solo los campos permitidos. Decidí cómo correr la demo el día: o grabás una de antemano identificada como grabada y con la misma revisión desplegada, o la hacés en vivo siendo explícito de que CI es el registro reproducible.");
})();

// ============================================================ SLIDE 15 — Honest status
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Estado honesto del proyecto"); title(s, "Lo implementado, lo pendiente y lo planificado");
  const cols = [
    ["Implementado y probado por un test ejecutado", SAGE, [
      "Máquinas de estado y cascadas de dominio",
      "Puertos, casos de uso y guards de aplicación",
      "Repositorios Prisma, migraciones, row locks, índices parciales",
      "Sesiones, CSRF en cada mutación, rate limiter atómico",
      "Allow-list público en runtime, UI y rutas API",
      "Despliegue sirviendo datos semilla · 6 tipos de centro",
    ]],
    ["Implementado, en revisión (PR #31/#32)", EUCA, [
      "Matriz de estados del agregado + límites de texto (dominio)",
      "Security headers, CSP con nonce",
      "Dependabot + audit de dependencias en CI",
      "Verificado contra build de producción",
    ]],
    ["Pendiente", ACCENT, [
      "Logging de seguridad y alertas",
      "Validación de esquema/tamaño de body",
      "Enriquecer experiencia pública",
      "Repo público · memoria · euskera · vídeo",
    ]],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  cols.forEach(([h, c, items], i) => {
    const x = M + i * (cw + 0.3), y = 2.15, ch = 4.15;
    card(s, x, y, cw, ch, { shadow: true, line: null });
    s.addShape("roundRect", { x: x, y: y, w: cw, h: 0.62, rectRadius: 0.08, fill: { color: c }, line: { type: "none" } });
    s.addText(h, { x: x + 0.2, y: y, w: cw - 0.4, h: 0.62, valign: "middle", fontFace: SANS, fontSize: 12.5, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 0.95 });
    bullets(s, items, x + 0.22, y + 0.8, cw - 0.44, ch - 1.0, { gap: 8, fontSize: 11.8, color: INK });
  });
  s.addText("[AUTOR] Si el repo sigue privado en la defensa, decilo en esta diapositiva: una limitación declarada se lee como rigor; una descubierta, no.", { x: M, y: 6.55, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 12, italic: true, color: MUTED, margin: 0 });
  pageNum(s, 15);
  s.addNotes("Esta diapositiva es deliberadamente explícita, y la columna del medio es la honesta. Un TFM defendible no convierte una decisión de diseño en una garantía de producción — pero tampoco debe infravalorar la evidencia que existe. El núcleo está desplegado y sus propiedades de concurrencia, autorización y minimización de datos están probadas por tests que se ejecutaron. El siguiente hito es logging y observabilidad, no alcance de features. Si el repo sigue privado, decilo abiertamente.");
})();

// ============================================================ SLIDE 16 — Future work
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "Trabajo futuro"); title(s, "Después de un núcleo seguro");
  const items = [
    ["Terminar el hardening del Bloque 1", "Logging de seguridad, validación de request, gobernanza de dependencias."],
    ["Bloque 2 — Valoraciones", "Solo tras Event.completed, una por cuenta/evento."],
    ["Bloque 3 — Mecenazgo simulado", "A través de PaymentGateway; los pagos reales exigen su propio modelo legal, de privacidad y de fraude."],
    ["Experiencia pública", "Información de accesibilidad y filtros no sensibles."],
    ["Controles operativos", "Monitorización, respuesta a incidentes, retención/borrado, gobernanza de dependencias."],
  ];
  let y = 2.15;
  items.forEach(([h, d], i) => {
    card(s, M, y, W - 2 * M, 0.85, { shadow: true, line: null });
    numCircle(s, M + 0.22, y + 0.19, 0.47, i + 1, EUCA);
    s.addText(h, { x: M + 0.9, y: y + 0.1, w: 4.2, h: 0.65, valign: "middle", fontFace: SANS, fontSize: 14, bold: true, color: SLATE, margin: 0 });
    s.addText(d, { x: M + 5.2, y: y + 0.1, w: 6.5, h: 0.65, valign: "middle", fontFace: SANS, fontSize: 12.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.02 });
    y += 0.98;
  });
  pageNum(s, 16);
  s.addNotes("La arquitectura deja puntos de extensión, pero extender no es licencia para saltar la seguridad. Pagos, integraciones externas y features más ricas de cara al paciente requieren cada una su propio modelado de amenazas antes de implementarse.");
})();

// ============================================================ SLIDE 17 — Conclusions
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  kicker(s, "Conclusiones", SAGE); title(s, "Un núcleo de coordinación seguro antes que amplitud de features", "FFFFFF");
  bullets(s, [
    "Un problema social puede abordarse con un núcleo acotado, testeable y desplegable.",
    "Los estados e invariantes de dominio explícitos hacen revisable la corrección de negocio.",
    "Los límites hexagonales mantienen reemplazables framework y persistencia.",
    "Concurrencia y minimización de datos públicos son preocupaciones de diseño de primera clase.",
    "SDD, tests y revisión adversarial convierten el trabajo asistido por IA en ingeniería inspeccionable.",
  ], M, 2.3, 11.9, 3.0, { gap: 13, fontSize: 15.5, color: "E7EEEB" });
  card(s, M, 5.7, W - 2 * M, 1.0, { fill: CARDDK, line: null });
  s.addText("El proyecto es más fuerte cuando expresa evidencia y riesgos abiertos con la misma precisión que las features terminadas.", { x: M + 0.35, y: 5.7, w: W - 2 * M - 0.7, h: 1.0, valign: "middle", fontFace: SERIF, fontSize: 17, italic: true, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.05 });
  pageNum(s, 17);
  s.addNotes("El aprendizaje principal no es una elección de framework. Es la disciplina de tratar las reglas de negocio, las restricciones de seguridad y la evidencia de verificación como parte del producto. Gracias — las preguntas son bienvenidas.");
})();

// Writes next to this script. Move/keep the result as docs/tfm-defense-deck.pptx.
p.writeFile({ fileName: "tfm-defense-deck.pptx" })
  .then((f) => console.log("WROTE", f))
  .catch((e) => { console.error(e); process.exit(1); });
