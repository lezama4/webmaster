/**
 * The reference landmass for the mocked hospital-finder map (ADR D11).
 *
 * The outline is stored as **real `[latitude, longitude]` coordinates**, never
 * as pre-computed viewBox numbers, and is projected at render time through the
 * very same `projectCoordinates` the pins use. That is the whole point: the
 * coastline and the pins are registered against one bounding box, so changing
 * that box moves both together and a hospital can never drift into the sea.
 *
 * Resolution is deliberately coarse — roughly sixty capes, river mouths, border
 * crossings and major ports. It is a recognisable silhouette, not a survey: the
 * projection is a linear lat/lng stretch with no Mercator correction, and the
 * visible caption ("indicative map, not to scale") is what keeps that honest to
 * the reader. Do not present this as navigation.
 */

/** `[latitude, longitude]`. */
export type GeoPoint = readonly [number, number];

/**
 * Mainland Spain, traced clockwise from the northern tip of Galicia: the
 * Cantabrian coast eastward, the Pyrenean border, the Mediterranean south to
 * Tarifa, the Atlantic west to the Portuguese frontier, that frontier north,
 * and the Galician coast back to the start.
 */
export const SPAIN_MAINLAND_RING: readonly GeoPoint[] = [
  // Cantabrian coast, west to east.
  [43.79, -7.69], // Estaca de Bares
  [43.54, -7.04], // Ribadeo
  [43.54, -6.54], // Luarca
  [43.66, -5.85], // Cabo Peñas
  [43.55, -5.66], // Gijón
  [43.46, -5.06], // Ribadesella
  [43.42, -4.75], // Llanes
  [43.39, -4.4], // San Vicente de la Barquera
  [43.46, -3.8], // Santander
  [43.38, -3.22], // Castro Urdiales
  [43.35, -3.03], // Abra de Bilbao
  [43.42, -2.72], // Bermeo
  [43.32, -1.98], // Donostia
  [43.37, -1.79], // Hondarribia
  // Pyrenean border, west to east.
  [43.01, -1.32], // Roncesvalles
  [42.75, -0.52], // Canfranc
  [42.6, 0.52], // Benasque
  [42.6, 1.53], // Andorra
  [42.43, 1.93], // Puigcerdà
  [42.43, 3.16], // Portbou
  [42.32, 3.32], // Cap de Creus
  // Mediterranean coast, north to south.
  [41.85, 3.13], // Palamós
  [41.67, 2.79], // Blanes
  [41.38, 2.18], // Barcelona
  [41.12, 1.25], // Tarragona
  [40.72, 0.87], // Delta del Ebro
  [40.36, 0.41], // Peñíscola
  [39.98, 0.03], // Castellón
  [39.47, -0.33], // Valencia
  [39.17, -0.25], // Cullera
  [38.84, 0.11], // Dénia
  [38.73, 0.23], // Cabo de la Nao
  [38.34, -0.48], // Alicante
  [37.63, -0.69], // Cabo de Palos
  [37.6, -0.98], // Cartagena
  [37.4, -1.58], // Águilas
  [36.72, -2.19], // Cabo de Gata
  [36.84, -2.46], // Almería
  [36.72, -3.52], // Motril
  [36.72, -4.42], // Málaga
  [36.51, -4.89], // Marbella
  [36.42, -5.15], // Estepona
  [36.01, -5.61], // Tarifa
  // Atlantic south-west, east to west.
  [36.53, -6.29], // Cádiz
  [36.78, -6.35], // Sanlúcar de Barrameda
  [37.26, -6.95], // Huelva
  [37.21, -7.41], // Ayamonte
  // Portuguese frontier, south to north.
  [37.5, -7.45],
  [38.2, -7.03],
  [38.9, -7.13],
  [39.6, -7.3],
  [40.1, -6.87],
  [40.9, -6.8],
  [41.4, -6.55],
  [41.9, -6.62],
  [41.95, -7.15],
  [41.87, -8.2],
  // Galician coast, south to north.
  [41.87, -8.87], // Miño estuary
  [42.24, -8.72], // Vigo
  [42.43, -8.65], // Pontevedra
  [42.55, -8.95], // Ría de Arousa
  [42.78, -9.06], // Muros
  [42.88, -9.27], // Fisterra
  [43.19, -9.18], // Costa da Morte
  [43.37, -8.4], // A Coruña
  [43.49, -8.23], // Ferrol
  [43.68, -7.85], // Ortigueira
];

/** The Balearics sit inside the same bounding box, so they belong on the canvas. */
export const BALEARIC_ISLANDS: readonly { readonly centre: GeoPoint; readonly rx: number; readonly ry: number }[] = [
  { centre: [39.6, 2.98], rx: 3.4, ry: 2.1 }, // Mallorca
  { centre: [39.98, 4.09], rx: 1.6, ry: 1.1 }, // Menorca
  { centre: [38.98, 1.43], rx: 1.8, ry: 1.4 }, // Eivissa
];

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Converts a closed ring of points into a smooth cubic SVG path using a
 * uniform Catmull-Rom spline.
 *
 * Straight segments between sixty-odd vertices read as a jagged polygon,
 * because real coastlines curve and polylines do not. Interpolating instead of
 * connecting is what makes a coarse point set look like a coast rather than a
 * mistake — and it costs nothing at runtime, since the path is computed once
 * per render from static data.
 *
 * Returns an empty string for a ring too short to describe a closed area,
 * so a caller can render nothing rather than a malformed `d` attribute.
 */
export function toClosedSmoothPath(ring: readonly Point[]): string {
  if (ring.length < 3) return "";

  const at = (index: number): Point => ring[((index % ring.length) + ring.length) % ring.length]!;
  const round = (value: number): string => value.toFixed(2);

  const segments: string[] = [`M${round(at(0).x)} ${round(at(0).y)}`];

  for (let i = 0; i < ring.length; i += 1) {
    const previous = at(i - 1);
    const current = at(i);
    const next = at(i + 1);
    const following = at(i + 2);

    // Uniform Catmull-Rom to cubic Bézier: each control point leans a sixth
    // of the way along the chord spanning its neighbours.
    const c1 = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const c2 = { x: next.x - (following.x - current.x) / 6, y: next.y - (following.y - current.y) / 6 };

    segments.push(
      `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(next.x)} ${round(next.y)}`,
    );
  }

  segments.push("Z");
  return segments.join(" ");
}
