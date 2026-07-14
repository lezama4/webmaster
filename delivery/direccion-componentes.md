# Vivetutiempo — dirección de componentes (Sage clínico)

Mapeo de `src/ui/components/ui.tsx` a los nuevos tokens. No cambia estructura ni props, solo clases.

## Botones
- Primario: `bg-primary text-primary-foreground rounded-[13px] px-5 py-2.5 font-semibold text-sm hover:bg-primary-hover transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`
- Secundario: `border border-border text-foreground bg-surface rounded-[13px] px-5 py-2.5 font-semibold text-sm hover:bg-surface-2 transition-colors duration-150`
- Deshabilitado: `opacity-45 pointer-events-none`

## Cards
- `bg-surface border border-border rounded-[20px] p-4 shadow-sm hover:shadow-md transition-shadow duration-180`

## Inputs (Field)
- `border border-border rounded-[8px] px-3 py-2.5 text-sm bg-surface placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`

## Badges / estados
- Pendiente: `bg-surface-2 text-primary-hover` (verde tenue)
- En revisión: `bg-[color-mix(in_oklch,var(--color-accent)_20%,white)] text-accent` (ámbar tenue)
- Rechazado: `bg-danger/10 text-danger`

## Tipografía
- Títulos (`h1`, `h2`): `font-heading` (Newsreader), peso 500.
- `h3` y navegación: `font-body` (Geist) peso 600 — mantiene la app legible/funcional sin recargar de serif.
- Body: `font-body` peso 400, `text-[14.5px] leading-[1.55]`.

## Motion
- Transiciones de color/sombra: 150–180ms ease-out, sin easing "bouncy".
- Sin animaciones de entrada llamativas — solo fade 120ms en cambios de ruta si ya existe ese mecanismo.

## Fuente
Agregar Newsreader (400/500/600 + itálica 500) junto a Geist vía `next/font/google` o `<link>`; no reemplaza Geist, se usa solo para headings.

## Dark mode
Los tokens `.dark` ya están calculados en `globals-tokens.css` manteniendo contraste AA (foreground #eef1ea sobre background #0f1310 ≈ 15:1; primary #6fa87e sobre background ≈ 6.8:1).

## Añadidos al entregable

### Tokens de foco y semánticos (nuevos — en delivery/globals-tokens.css)
Además de los tokens de marca, incluí (light y dark, contraste AA en ambos):

- **Foco:** `--ring` debe ser un color de foco **claramente visible y diferenciado** para
  navegación por teclado, legible sobre todas las superficies (surface, surface-2, primary).
  Ya lo consume `*:focus-visible { outline: 2px solid var(--ring) }` en globals.css.

- **Estados semánticos** (SEPARADOS del acento de marca `--primary` — no reutilizar el acento
  para éxito/error). Para cada uno, un color de texto/borde y un fondo tenue:
  - `--success`, `--success-foreground`, `--success-subtle`
  - `--danger`, `--danger-foreground`, `--danger-subtle`   (errores de formulario, rechazos)
  - `--warning`, `--warning-foreground`, `--warning-subtle` (opcional; estados intermedios)
  Indicá también las líneas a añadir en `@theme inline`
  (`--color-success: var(--success)`, `--color-danger: var(--danger)`, etc.).

### Mapeo de estados (en delivery/direccion-componentes.md)
Con esos tokens semánticos, mapeá además:
- **Errores de formulario:** hoy el texto de error usa `text-primary` (el acento de marca) —
  pasarlo a `text-danger`. Aplica a login/register/publish-slot/propose y `Field` (prop `error`).
- **Confirmaciones de éxito:** p. ej. "Proposal sent" / "Request received" → `text-success`.
- **Pills de estado** (hoy con colores ad-hoc):
  - Slot: Open → `success`, Filled → `accent`/neutral, Closed → `muted`/neutral.
  - Proposal: Accepted → `success`, Rejected → `danger`, Pending → `muted`/`warning`.
  Dame el string de clases de cada variante de pill.
