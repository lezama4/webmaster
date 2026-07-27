// "Todo el tiempo cuenta" — non-technical PITCH deck (sell the idea).
// Audience: a non-technical person. No jargon. Warm, human, benefit-driven.
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "Todo el tiempo cuenta";
p.title = "Todo el tiempo cuenta — Presentación del proyecto";

// ---- warm, human palette ----
const DEEP = "2A2432";     // deep warm aubergine-charcoal (dark slides)
const CARDDK = "372F42";
const AMBER = "E0A24A";     // warm hopeful accent (time / light)
const AMBERSOFT = "F0C989";
const SAGE = "7FA891";      // life / care
const CORAL = "DE8C6E";     // warmth (secondary accent, used sparingly)
const CREAM = "FBF6EE";     // content background
const CARD = "FFFFFF";
const CARDLINE = "ECE3D6";
const INK = "312C2A";
const MUTED = "8C8279";

const SANS = "Calibri";
const SERIF = "Cambria";
const W = 13.3, H = 7.5, M = 0.85;

function bg(s, c) { s.background = { color: c }; }
function pageNum(s, n) {
  s.addText(String(n).padStart(2, "0"), { x: W - 1.0, y: H - 0.5, w: 0.6, h: 0.3, align: "right", fontFace: SANS, fontSize: 10, color: MUTED });
}
function brandTag(s, color) {
  s.addText("TODO EL TIEMPO CUENTA", { x: M, y: H - 0.62, w: 6, h: 0.3, fontFace: SANS, fontSize: 10, bold: true, color: color || MUTED, charSpacing: 3, margin: 0 });
}
function card(s, x, y, w, h, opts = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.09, fill: { color: opts.fill || CARD }, line: opts.line === null ? { type: "none" } : { color: opts.line || CARDLINE, width: 1 },
    shadow: opts.shadow ? { type: "outer", color: "C9BEAF", opacity: 0.3, blur: 9, offset: 3, angle: 90 } : undefined });
}
function numCircle(s, x, y, d, label, fill, tcolor) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill || AMBER }, line: { type: "none" } });
  s.addText(String(label), { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: SANS, fontSize: 17, bold: true, color: tcolor || "FFFFFF", margin: 0 });
}
// small heart motif (brand)
function heart(s, x, y, sz, color) {
  s.addShape("heart", { x, y, w: sz, h: sz, fill: { color }, line: { type: "none" } });
}

// ============================== S1 — HOOK
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  heart(s, M, 1.55, 0.5, CORAL);
  s.addText("Todo el tiempo cuenta", { x: M, y: 2.25, w: 11.4, h: 1.3, fontFace: SERIF, fontSize: 56, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("Convertimos el tiempo de espera en tiempo de vida.", { x: M, y: 3.75, w: 10.5, h: 0.8, fontFace: SANS, fontSize: 22, color: AMBERSOFT, margin: 0 });
  s.addText("Actividades culturales que llegan a hospitales, residencias y centros de cuidado — a las personas y familias que más lo necesitan.", { x: M, y: 4.75, w: 10.2, h: 1.0, fontFace: SANS, fontSize: 15.5, color: "D8D0DE", margin: 0, lineSpacingMultiple: 1.15 });
  s.addText("[AUTOR] · Presentación del proyecto", { x: M, y: 6.5, w: 8, h: 0.35, fontFace: SANS, fontSize: 12.5, italic: true, color: "9C93A6", margin: 0 });
  s.addNotes("Todo el tiempo cuenta. Una idea simple: el tiempo que las personas pasan en centros de cuidado puede convertirse en tiempo de vida. Hoy os cuento cómo.");
})();

// ============================== S2 — THE HUMAN PROBLEM
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("En un hospital, una residencia, un centro de día…\nel tiempo pesa.", { x: M, y: 1.7, w: 11.6, h: 1.9, fontFace: SERIF, fontSize: 38, bold: true, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
  s.addText("Las personas — y sus familias — pasan largas horas esperando, acompañando o recuperándose. Horas que se hacen eternas.", { x: M, y: 3.9, w: 9.6, h: 1.0, fontFace: SANS, fontSize: 18, color: MUTED, margin: 0, lineSpacingMultiple: 1.2 });
  // big soft stat / emphasis
  card(s, M, 5.35, 11.6, 1.15, { fill: "F3EADB", line: null });
  s.addText([
    { text: "Ese tiempo no tiene por qué ser tiempo perdido. ", options: { fontFace: SANS, fontSize: 17, bold: true, color: INK } },
    { text: "Puede ser tiempo que acompaña, distrae y da vida.", options: { fontFace: SANS, fontSize: 17, color: "7A5A2E" } },
  ], { x: M + 0.35, y: 5.35, w: 10.9, h: 1.15, valign: "middle", margin: 0, lineSpacingMultiple: 1.05 });
  brandTag(s); pageNum(s, 2);
  s.addNotes("Pensad en alguien ingresado, o en una residencia, o acompañando a un familiar. Se pasan horas larguísimas. Ese tiempo pesa, para quien lo vive y para quien acompaña. Pero no tiene por qué ser tiempo perdido.");
})();

// ============================== S3 — THE INSIGHT
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("Ese tiempo puede convertirse en vida.", { x: M, y: 1.7, w: 11.6, h: 1.1, fontFace: SERIF, fontSize: 38, bold: true, color: INK, margin: 0 });
  s.addText("Un concierto en la sala. Un taller de acuarela. Un cuentacuentos para los más pequeños.", { x: M, y: 2.9, w: 10.5, h: 0.8, fontFace: SANS, fontSize: 18, color: MUTED, margin: 0, lineSpacingMultiple: 1.15 });
  const items = [
    ["Momentos", "Actividades que rompen la rutina y devuelven la sonrisa."],
    ["Compañía", "Cultura y calor humano donde más se agradecen."],
    ["Dignidad", "Cuidar también es cuidar cómo se vive el tiempo."],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  items.forEach(([h, d], i) => {
    const x = M + i * (cw + 0.3), y = 4.1;
    card(s, x, y, cw, 2.0, { shadow: true, line: null });
    s.addShape("ellipse", { x: x + 0.35, y: y + 0.35, w: 0.55, h: 0.55, fill: { color: [AMBER, SAGE, CORAL][i] }, line: { type: "none" } });
    s.addText(h, { x: x + 0.35, y: y + 1.0, w: cw - 0.7, h: 0.45, fontFace: SERIF, fontSize: 20, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: x + 0.35, y: y + 1.42, w: cw - 0.7, h: 0.5, fontFace: SANS, fontSize: 13.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
  });
  brandTag(s); pageNum(s, 3);
  s.addNotes("La idea de fondo no es inventar la cultura en los centros. Es que sabemos que funciona: una actividad rompe la rutina, acompaña, devuelve dignidad al tiempo. La pregunta es cómo lograr que ocurra de verdad, y a menudo.");
})();

// ============================== S4 — WHY IT'S HARD
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("Lo difícil no es la cultura.\nEs coordinarla.", { x: M, y: 1.7, w: 11.6, h: 1.8, fontFace: SERIF, fontSize: 38, bold: true, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
  s.addText("¿Quién tiene un hueco libre? ¿Qué artista puede ir? ¿Quién da el permiso? ¿Cómo se avisa a las familias sin exponer datos delicados?", { x: M, y: 3.7, w: 10.2, h: 1.0, fontFace: SANS, fontSize: 18, color: MUTED, margin: 0, lineSpacingMultiple: 1.2 });
  card(s, M, 5.15, 11.6, 1.3, { fill: DEEP, line: null });
  s.addText([
    { text: "Sin una herramienta que lo ordene, ", options: { fontFace: SANS, fontSize: 18, color: "E8E2F0" } },
    { text: "la buena voluntad se queda en nada.", options: { fontFace: SANS, fontSize: 18, bold: true, color: AMBERSOFT } },
  ], { x: M + 0.4, y: 5.15, w: 10.8, h: 1.3, valign: "middle", margin: 0 });
  brandTag(s); pageNum(s, 4);
  s.addNotes("Aquí está el problema real. No falta gente con ganas: faltan las tuberías. Coordinar disponibilidad, propuestas, permisos y una comunicación segura es un lío, y en un entorno de salud hay datos delicados de por medio. Sin algo que lo ordene, la buena voluntad se pierde.");
})();

// ============================== S5 — THE SOLUTION
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  heart(s, M, 1.55, 0.42, CORAL);
  s.addText("Todo el tiempo cuenta", { x: M + 0.6, y: 1.5, w: 10, h: 0.6, valign: "middle", fontFace: SANS, fontSize: 15, bold: true, color: AMBER, charSpacing: 2, margin: 0 });
  s.addText("Una plataforma que conecta centros de cuidado con artistas, para llevar actividades a quienes las necesitan.", { x: M, y: 2.5, w: 11.4, h: 1.8, fontFace: SERIF, fontSize: 34, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.08 });
  s.addText("Simple, segura y pensada para el mundo real de un hospital o una residencia.", { x: M, y: 4.6, w: 10.5, h: 0.7, fontFace: SANS, fontSize: 17, color: "D8D0DE", margin: 0 });
  brandTag(s, "9C93A6"); pageNum(s, 5);
  s.addNotes("Todo el tiempo cuenta es la herramienta que faltaba. Conecta a los centros de cuidado con artistas dispuestos a aportar, y lo hace de forma simple y segura, pensada para cómo funciona de verdad un hospital o una residencia.");
})();

// ============================== S6 — HOW IT WORKS
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("Cómo funciona", { x: M, y: 0.85, w: 11.6, h: 0.9, fontFace: SERIF, fontSize: 34, bold: true, color: INK, margin: 0 });
  const steps = [
    ["El centro abre una tarde", "Publica un hueco libre en su agenda: \"tenemos este día para una actividad\"."],
    ["Los artistas proponen", "Varios artistas ofrecen lo que saben hacer para ese momento."],
    ["El centro elige", "Escoge la propuesta que mejor encaja con sus personas. No es el primero que llega."],
    ["Nace un evento real", "La actividad se confirma y se publica. Las familias pueden verla."],
  ];
  let y = 2.05;
  steps.forEach(([h, d], i) => {
    card(s, M, y, W - 2 * M, 1.05, { shadow: true, line: null });
    numCircle(s, M + 0.28, y + 0.26, 0.52, i + 1, [AMBER, SAGE, CORAL, DEEP][i]);
    s.addText(h, { x: M + 1.1, y: y + 0.16, w: 4.3, h: 0.75, valign: "middle", fontFace: SANS, fontSize: 16.5, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: M + 5.5, y: y + 0.16, w: 6.0, h: 0.75, valign: "middle", fontFace: SANS, fontSize: 13.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    y += 1.2;
  });
  brandTag(s); pageNum(s, 6);
  s.addNotes("Cuatro pasos, en lenguaje de calle. El centro dice: tengo esta tarde libre. Varios artistas ofrecen actividades. El centro elige la que mejor encaja con sus personas, no la primera que llegó. Y esa actividad se convierte en un evento real que las familias pueden ver. Así de simple por fuera.");
})();

// ============================== S7 — WHO IT HELPS
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("A quién ayuda", { x: M, y: 0.85, w: 11.6, h: 0.9, fontFace: SERIF, fontSize: 34, bold: true, color: INK, margin: 0 });
  const who = [
    ["Las personas", "Pacientes y mayores que reciben un rato de vida en su día.", AMBER],
    ["Las familias", "Que ven que a su gente la acompañan, no solo la atienden.", SAGE],
    ["Los artistas", "Que encuentran un lugar donde su talento suma de verdad.", CORAL],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  who.forEach(([h, d, c], i) => {
    const x = M + i * (cw + 0.3), y = 2.0;
    card(s, x, y, cw, 2.1, { shadow: true, line: null });
    s.addShape("ellipse", { x: x + 0.35, y: y + 0.4, w: 0.6, h: 0.6, fill: { color: c }, line: { type: "none" } });
    s.addText(h, { x: x + 0.35, y: y + 1.1, w: cw - 0.7, h: 0.5, fontFace: SERIF, fontSize: 20, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: x + 0.35, y: y + 1.52, w: cw - 0.7, h: 0.5, fontFace: SANS, fontSize: 13.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
  });
  card(s, M, 4.4, W - 2 * M, 1.55, { fill: "F3EADB", line: null });
  s.addText("No solo hospitales", { x: M + 0.4, y: 4.6, w: 11, h: 0.45, fontFace: SANS, fontSize: 15, bold: true, color: "7A5A2E", margin: 0 });
  s.addText("Hospitales · residencias de mayores · centros de día · hospitales de día · centros ocupacionales · unidades de cuidados paliativos.", { x: M + 0.4, y: 5.05, w: 11, h: 0.8, fontFace: SANS, fontSize: 15.5, color: INK, margin: 0, lineSpacingMultiple: 1.15 });
  brandTag(s); pageNum(s, 7);
  s.addNotes("Ayuda a tres grupos a la vez: a las personas, que reciben un rato de vida; a las familias, que ven que a su gente la acompañan; y a los artistas, que encuentran dónde aportar. Y no es solo para hospitales: sirve para seis tipos de centro de cuidado.");
})();

// ============================== S8 — WHY DIFFERENT
(function () {
  const s = p.addSlide(); bg(s, CREAM);
  s.addText("Por qué es distinto", { x: M, y: 0.85, w: 11.6, h: 0.9, fontFace: SERIF, fontSize: 34, bold: true, color: INK, margin: 0 });
  const pts = [
    ["El centro elige", "No es \"el primero que llega\". El centro escoge la actividad que mejor encaja con sus personas."],
    ["Privacidad y dignidad", "Cuida los datos delicados: nada de exponer dónde está ni la vida privada de nadie."],
    ["Sin ánimo de lucro", "El objetivo es el bienestar de las personas, no el negocio."],
  ];
  let y = 2.0;
  pts.forEach(([h, d], i) => {
    card(s, M, y, W - 2 * M, 1.35, { shadow: true, line: null });
    heart(s, M + 0.35, y + 0.42, 0.5, [AMBER, SAGE, CORAL][i]);
    s.addText(h, { x: M + 1.15, y: y + 0.2, w: 3.9, h: 0.95, valign: "middle", fontFace: SANS, fontSize: 18, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: M + 5.1, y: y + 0.2, w: 6.4, h: 0.95, valign: "middle", fontFace: SANS, fontSize: 14, color: MUTED, margin: 0, lineSpacingMultiple: 1.08 });
    y += 1.5;
  });
  brandTag(s); pageNum(s, 8);
  s.addNotes("Tres cosas lo hacen distinto. Primero, el centro elige: no premia a quien llega antes, sino a lo que mejor encaja con sus personas. Segundo, respeta la privacidad y la dignidad, algo básico en salud. Y tercero, no busca lucro: busca bienestar.");
})();

// ============================== S9 — IT'S REAL + VISION
(function () {
  const s = p.addSlide(); bg(s, DEEP);
  s.addText("No es una idea en un papel.", { x: M, y: 1.7, w: 11.4, h: 0.9, fontFace: SANS, fontSize: 20, color: AMBERSOFT, margin: 0 });
  s.addText("Está funcionando hoy.", { x: M, y: 2.45, w: 11.4, h: 1.2, fontFace: SERIF, fontSize: 46, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("Una plataforma real, en marcha, lista para llevar más vida a más centros.", { x: M, y: 3.85, w: 10.5, h: 0.8, fontFace: SANS, fontSize: 17, color: "D8D0DE", margin: 0, lineSpacingMultiple: 1.15 });
  card(s, M, 5.0, 11.6, 1.35, { fill: CARDDK, line: null });
  s.addText([
    { text: "Convertir tiempo de espera en tiempo de vida — ", options: { fontFace: SERIF, fontSize: 20, italic: true, bold: true, color: "FFFFFF" } },
    { text: "a escala.", options: { fontFace: SERIF, fontSize: 20, italic: true, bold: true, color: AMBER } },
  ], { x: M + 0.4, y: 5.0, w: 10.8, h: 1.35, valign: "middle", margin: 0 });
  brandTag(s, "9C93A6"); pageNum(s, 9);
  s.addNotes("Y lo más importante: esto no es una maqueta ni un powerpoint. Es una plataforma real, funcionando hoy, lista para llevar más vida a más centros. Porque al final la idea cabe en una frase: convertir tiempo de espera en tiempo de vida, a escala. Gracias.");
})();

p.writeFile({ fileName: "tfm-pitch-deck.pptx" })
  .then((f) => console.log("WROTE", f))
  .catch((e) => { console.error(e); process.exit(1); });
