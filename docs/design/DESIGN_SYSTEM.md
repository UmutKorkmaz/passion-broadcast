# Passion Broadcast Design System

The desktop and mobile concept PNGs in this folder are the visual source of truth.

## Direction

- Editorial astronomy meets public radio.
- True dark matte navy background, warm ivory text, coral data emphasis, and restrained cyan graph connections.
- Open bands, rails, dividers, and tables; avoid nested cards and decorative filler.
- No gradients, glass effects, neon glow, hero kicker, or project rankings.

## Tokens

| Role | Value |
|---|---|
| Background | `#03111d` |
| Raised background | `#071a28` |
| Primary text | `#f4eee5` |
| Secondary text | `#9aa8b5` |
| Hairline | `#294050` |
| Coral | `#ff6548` |
| Coral soft | `#e9816c` |
| Cyan | `#69c8e3` |
| Positive | `#8bd4b2` |

Typography uses Geist Sans for editorial and UI text, with deliberate UI sizes of 12–14px and a responsive display headline. Controls use small radii; analytical regions stay open and square.

## Component families

- Quiet header and constellation/waveform mark
- Open metric strip
- Filter toolbar
- SVG passion constellation with selection and zoom affordances
- Entry detail rail on desktop and inline detail section on mobile
- Timeline, distribution bars, and sponsor-technology bars
- Source-linked entry table/list
- Persistent broadcast player with waveform, transcript, and progress

## Allowed first-viewport copy

- `Passion Broadcast`
- `What does DEV care enough to build this weekend?`
- `A live, source-backed map of the projects, people, and motivations shaping Passion Edition.`
- `entries`, `builders`, `archetypes`, `reactions`
- `All archetypes`, `All technologies`, `Refresh`
- `The passion map`, `From the community`
- `Updated ... TRT`

Dynamic values and selected-entry content must come from the source snapshot rather than hard-coded claims.

## Responsive behavior

- Metrics become a two-by-two open grid.
- Filters stack full width.
- The constellation remains the primary visualization and scrolls or scales without losing labels.
- Selected-entry detail moves below the map.
- Charts and entry rows stack.
- The broadcast player becomes a compact sticky bottom control.
