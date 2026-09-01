---
version: alpha
name: NWIS-design-system
description: |
  A light, instrument-panel design system for eRTMAC-NWIS — built around the one thing that
  actually makes this product different from a generic SaaS dashboard: depth. Every well is a
  vertical column through geological strata, and the interface borrows that structure instead of
  hiding behind stock rounded cards. The signature element is the Depth Rail — a slim vertical
  strata-gradient strip that lives beside the sidebar and doubles as the system's loading/transition
  motif (bands drift upward like a core sample scrolling past, rather than a generic spinner). The
  base palette is a cool engineering-paper canvas (not cream, not stark white) paired with a deep
  well-navy ink, an oxidized-brass amber for attention states, and an oscilloscope teal for live
  signal traces. Typography pairs a geometric display face with engineering presence against a
  quiet body sans and a monospace face reserved strictly for depth/pressure/coordinate readouts —
  so numbers always look like instrument data, not decoration.

colors:
  ink: "#0A2540"
  ink-deep: "#061627"
  slate: "#3E5164"
  body: "#5B6B7A"
  mute: "#8C99A6"
  canvas: "#F5F7F6"
  canvas-deep: "#EDF1EF"
  surface: "#FFFFFF"
  surface-sunken: "#F0F3F2"
  hairline: "#DFE6E3"
  hairline-strong: "#C7D1CD"
  sidebar-bg: "#0A2540"
  sidebar-ink: "#EAF0EE"
  sidebar-mute: "rgba(234,240,238,0.6)"
  sidebar-active: "#12385C"
  signal-teal: "#1E8A8A"
  signal-teal-soft: "#E3F2F0"
  brass: "#C77A2E"
  brass-soft: "#FBEEDF"
  rust: "#B3261E"
  rust-soft: "#FBE9E7"
  moss: "#2F6F4E"
  moss-soft: "#E7F1EB"
  strata-tan: "#C9A87C"
  strata-slate: "#5C7A99"
  strata-umber: "#7A5C46"
  strata-sage: "#7C9885"
  focus-ring: "rgba(30,138,138,0.45)"

typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.005em
  heading-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0
  heading-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.01em
  data-lg:
    fontFamily: IBM Plex Mono
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.01em
  data-md:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  data-sm:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 10px
  lg: 14px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

motion:
  fast: 120ms
  base: 220ms
  slow: 420ms
  strata: 900ms
  ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1)
  ease-emphasis: cubic-bezier(0.16, 1, 0.3, 1)

components:
  sidebar:
    backgroundColor: "{colors.sidebar-bg}"
    textColor: "{colors.sidebar-ink}"
    width-expanded: 240px
    width-collapsed: 72px
  sidebar-item:
    textColor: "{colors.sidebar-mute}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  sidebar-item-active:
    backgroundColor: "{colors.sidebar-active}"
    textColor: "{colors.sidebar-ink}"
    borderLeft: 3px solid "{colors.signal-teal}"
  depth-rail:
    width: 6px
    gradient: "{colors.strata-tan} 0%, {colors.strata-slate} 35%, {colors.strata-umber} 70%, {colors.strata-sage} 100%"
  topbar:
    backgroundColor: "{colors.surface}"
    borderBottom: 1px solid "{colors.hairline}"
    height: 64px
  card:
    backgroundColor: "{colors.surface}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: 20px
    shadow: 0 1px 2px rgba(10,37,64,0.04), 0 8px 24px rgba(10,37,64,0.05)
  card-hover:
    shadow: 0 2px 4px rgba(10,37,64,0.06), 0 14px 32px rgba(10,37,64,0.09)
    transform: translateY(-2px)
  well-context-card:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sidebar-ink}"
    rounded: "{rounded.lg}"
    padding: 20px
  risk-gauge:
    trackColor: "{colors.hairline-strong}"
    lowColor: "{colors.moss}"
    mediumColor: "{colors.brass}"
    highColor: "{colors.rust}"
    rounded: "{rounded.pill}"
  alert-card-elevated:
    backgroundColor: "{colors.rust-soft}"
    borderLeft: 4px solid "{colors.rust}"
    rounded: "{rounded.md}"
    padding: 16px
  alert-card-watch:
    backgroundColor: "{colors.brass-soft}"
    borderLeft: 4px solid "{colors.brass}"
    rounded: "{rounded.md}"
    padding: 16px
  live-signal-badge:
    backgroundColor: "{colors.signal-teal-soft}"
    textColor: "{colors.signal-teal}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  viewport-3d:
    backgroundColor: "{colors.ink-deep}"
    rounded: "{rounded.lg}"
    padding: 0px
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.heading-sm}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 42px
  button-signal:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 42px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline-strong}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 42px
  input-field:
    backgroundColor: "{colors.surface}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.sm}"
    padding: 9px 12px
    height: 40px
  skeleton-strata:
    gradient: "{colors.strata-tan}, {colors.strata-slate}, {colors.strata-umber}, {colors.strata-sage}"
    rounded: "{rounded.sm}"
---

## Design rationale — what changed, and why

Your old theme was white plus one accent, which reads flat because there's no *structural* reason for it — it's a palette applied on top of the UI rather than pulled from what the product does. This version starts from the opposite direction: **the product's entire mental model is a vertical column through depth** (formation → depth → event → correlation). So the design's one signature move — the **Depth Rail** — is a literal strata gradient that lives in the chrome itself, not just inside well-diagrams. That's the deliberate, subject-specific choice the frontend-design brief calls for, instead of a generic "SaaS card kit with one shared border-radius and a soft grey shadow on everything."

Deliberately avoided:
- **Cream + terracotta** — the most common AI-generated default palette. Canvas here is a cool engineering-paper grey-green (`#F5F7F6`), and the warm accent is a darker, more mustard-brass ochre (`#C77A2E`), not the soft coral-terracotta AI defaults toward.
- **ALL-CAPS eyebrow labels everywhere** — status tags use a colored dot + sentence-case word (`● Elevated risk`) instead of tracked-out caps.
- **Identical shadow on every card** — only `card-hover` gets a shadow lift, and it's a response to a hover/focus action, not ambient decoration. Flat cards otherwise rely on the 1px hairline, matching the instrument-panel feel rather than "floating dashboard tiles."
- **Motion everywhere** — hover lifts and the live-signal pulse are the only continuous motion; page-level transitions (route change, data refresh) use the strata-scroll once per navigation, not stacked fade+slide+scale on every element.

## Overview

NWIS is read by engineers under time pressure, so the system prioritizes **scan speed and evidence legibility** over decoration — but it's still a light, textured, un-dull interface, achieved through the strata palette and the dark ink sidebar/well-context contrast rather than through brightness. The sidebar is permanently dark ink (`{colors.sidebar-bg}`) against a light canvas everywhere else — this is the system's one deliberate light/dark contrast moment, giving the "always-on control room" feeling a live monitoring tool needs without darkening the whole app.

Numbers that come from instruments (depth, pressure, ROP, coordinates) are **always** set in `IBM Plex Mono` (`{typography.data-md}` / `{typography.data-lg}`) — this single rule does more to make the product feel like real engineering software than any color choice.

**Key characteristics:**
- Dark ink sidebar (`{colors.sidebar-bg}`) as the one persistent dark surface; everything else sits on the light `{colors.canvas}`
- The Depth Rail: a 6px strata-gradient strip running the height of the sidebar, and reused as the loading/transition motif site-wide
- Data readouts always in monospace; everything else in Space Grotesk (headings) + Inter (body)
- Cards are flat by default (1px hairline only); shadow appears only on hover/focus, never at rest
- Risk and alert states use brass (watch) and rust (elevated) — red is reserved strictly for the highest-severity state, never used decoratively
- A dedicated `viewport-3d` container spec, dark-inset on the light canvas, ready to host the future Three.js offset-well model without redesigning the shell around it

## Colors

### Ink & Neutrals
- **Ink** (`{colors.ink}` — `#0A2540`) — deep well-navy. Headlines, primary buttons, active nav text.
- **Ink Deep** (`{colors.ink-deep}` — `#061627`) — 3D viewport background, pressed states.
- **Slate** (`{colors.slate}` — `#3E5164`) — secondary headings, card sub-labels.
- **Body** (`{colors.body}` — `#5B6B7A`) — default paragraph and description text.
- **Mute** (`{colors.mute}` — `#8C99A6`) — timestamps, placeholder text, disabled labels.

### Surfaces
- **Canvas** (`{colors.canvas}` — `#F5F7F6`) — page background. Cool, quiet, not stark white, not cream.
- **Canvas Deep** (`{colors.canvas-deep}` — `#EDF1EF`) — section backgrounds that need to sit just behind the card layer.
- **Surface** (`{colors.surface}` — `#FFFFFF`) — cards, inputs, topbar.
- **Surface Sunken** (`{colors.surface-sunken}` — `#F0F3F2`) — table row alternation, inset panels.
- **Hairline** (`{colors.hairline}` — `#DFE6E3`) / **Hairline Strong** (`{colors.hairline-strong}` — `#C7D1CD`) — card borders, dividers, ghost-button borders.

### Sidebar (the one dark surface)
- **Sidebar BG** (`{colors.sidebar-bg}` — `#0A2540`), **Sidebar Ink** (`{colors.sidebar-ink}` — `#EAF0EE`), **Sidebar Mute** (`{colors.sidebar-mute}`), **Sidebar Active** (`{colors.sidebar-active}` — `#12385C`) for the current-page row fill, paired with a 3px `{colors.signal-teal}` left border.

### Signal & Status
- **Signal Teal** (`{colors.signal-teal}` — `#1E8A8A`) — live/current data exclusively: live badges, current-well markers, real-time chart lines. Never used for historical data, so "teal on screen" always means *this is happening right now*.
- **Brass** (`{colors.brass}` — `#C77A2E`) — watch-state alerts, medium risk, secondary CTA on dark surfaces.
- **Rust** (`{colors.rust}` — `#B3261E`) — elevated/high risk only. Scarce by design — at most one rust element per view.
- **Moss** (`{colors.moss}` — `#2F6F4E`) — confirmed/low-risk/success states.

### Strata (data-visualization only)
`{colors.strata-tan}`, `{colors.strata-slate}`, `{colors.strata-umber}`, `{colors.strata-sage}` — reserved for geological/depth visuals: the Depth Rail, well cross-sections, formation legends, and the strata skeleton-loader. Never used as general UI chrome — keeping them scarce is what makes the Depth Rail read as meaningful rather than decorative.

## Typography

- **Space Grotesk** (display/headings) — geometric with just enough engineering character to avoid reading as generic SaaS Inter-everywhere. Used 20px–34px only.
- **Inter** (body, UI labels, buttons) — the quiet workhorse; carries everything below 20px that isn't instrument data.
- **IBM Plex Mono** (data readouts) — depth, pressure, ROP, coordinates, timestamps in live-signal cards. This is a hard rule, not a style preference: if a number came from a sensor or a database field, it's mono; if it's prose, it's Inter.

| Token | Size | Weight | Use |
|---|---|---|---|
| `display-xl` | 34px | 600 | Page-level headline ("Active Well: KD-14") |
| `display-lg` | 26px | 600 | Section headline ("Offset Well Intelligence") |
| `heading-md` | 20px | 500 | Card title |
| `heading-sm` | 16px | 600 | Button label, sidebar section header |
| `body-md` | 15px | 400 | Default paragraph |
| `body-sm` | 13px | 400 | Secondary/meta copy |
| `label-sm` | 12px | 500 | Status-badge text, table column headers |
| `data-lg` | 22px | 500 | Hero metric (risk score, current depth) |
| `data-md` | 14px | 500 | Inline readouts inside cards |
| `data-sm` | 12px | 400 | Timestamps, coordinate strings |

## Layout

- **Shell:** fixed dark sidebar (240px expanded / 72px icon-only collapsed) + Depth Rail (6px) + light content column. Topbar (64px) sits above the content column only — the sidebar runs full height, uninterrupted.
- **Content grid:** 12-column, 24px gutter, max content width 1440px, with a persistent right-hand "Well Context" rail (320px) on well-detail views showing the well-context-card, live signal snapshot, and offset-well shortlist — this is what keeps depth/formation context on-screen even while scrolling long report or timeline views.
- **Cards:** default to a loose 3-up grid on desktop (≥1280px), 2-up on tablet, 1-up on mobile. Never mix card heights within a row — pad short cards rather than let the grid look uneven.

```
┌────┬──┬─────────────────────────────────┬───────────────┐
│ SB │DR│ Topbar                          │               │
│    │  ├─────────────────────────────────┤  Well Context │
│ ico│st│ Content (cards / map / timeline) │  Rail         │
│ nav│ra│                                 │               │
│    │ta│                                 │               │
└────┴──┴─────────────────────────────────┴───────────────┘
```

## Motion

Motion is scarce and always answers something — a route change, a data refresh, a hover, an alert arriving. Nothing loops or plays ambiently.

- **`{motion.fast}` (120ms)** — button press, checkbox toggle.
- **`{motion.base}` (220ms)** — hover lift on `card-hover`, sidebar item highlight, dropdown open.
- **`{motion.slow}` (420ms)** — panel/drawer slide-in (e.g., alert detail), toast entrance.
- **`{motion.strata}` (900ms)** — the signature moment: on route change or a manual data refresh, the Depth Rail's bands shift upward by one cycle before settling, evoking a core sample scrolling past. This is the system's *one* orchestrated motion moment — do not add it to routine hovers.
- **Live-signal pulse:** the `live-signal-badge` dot uses a slow 1.8s opacity breathe (not a spin, not a bounce) — signals "this is live" without being distracting during a 10+ minute monitoring session.
- **Easing:** `{motion.ease-standard}` for UI feedback (buttons, hovers); `{motion.ease-emphasis}` for the Depth Rail strata-scroll and panel entrances, which should feel deliberate, not snappy.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | 1px `{colors.hairline}` border, no shadow | Default resting state for every card, table, input |
| 1 — Hover | `card-hover` shadow + 2px lift | Only on hover/keyboard-focus, never at rest |
| 2 — Contrast surface | `{colors.ink}` / `{colors.ink-deep}` fill | Sidebar, well-context-card, viewport-3d — the system's dark surfaces |
| 3 — Alert | Colored left-border (4px) + soft tint fill | `alert-card-watch`, `alert-card-elevated` — never a shadow, the color border is the elevation cue |

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Topbar, table structural lines |
| `{rounded.sm}` | 6px | Inputs, small badges, strata skeleton blocks |
| `{rounded.md}` | 10px | Buttons, sidebar items, alert cards |
| `{rounded.lg}` | 14px | Cards, well-context-card, viewport-3d container |
| `{rounded.pill}` | 9999px | Risk gauge track, live-signal badge, status chips |

## Components

### Sidebar & Navigation
**`sidebar`** — dark ink fill, icon + label items, collapses to icon-only at 72px with labels appearing as tooltips. **`sidebar-item-active`** uses a filled row (`{colors.sidebar-active}`) plus a 3px teal left border — never rely on color alone, the border gives a second, accessible cue. **`depth-rail`** sits immediately to the right of the sidebar, full height, and is the only strata-gradient element allowed outside of well-diagrams and loaders.

### Topbar
White, 64px, 1px bottom hairline. Left: active well name in `data-md` mono + a `live-signal-badge` if streaming. Right: search, notifications, engineer avatar.

### Cards
**`card`** — flat by default, hover lift only. **`well-context-card`** — dark ink card used specifically for the "currently selected well" summary in the right rail, giving it visual priority without needing a shadow. **`viewport-3d`** — dark-inset, zero internal padding (canvas fills edge-to-edge), with a thin `{colors.hairline}` outer border so it still reads as a bounded panel on the light canvas; reserve a `body-sm` caption row beneath it for orbit-control hints ("drag to rotate · scroll to zoom") once the 3D model ships.

### Risk & Alerts
**`risk-gauge`** — pill-track gauge, three-zone fill (moss → brass → rust), pointer marker, always paired with a `data-lg` numeric score, never color-only. **`alert-card-watch`** / **`alert-card-elevated`** — left-border + soft tint, no shadow; elevated (rust) is reserved for the single highest-priority alert on screen at a time.

### Buttons & Inputs
**`button-primary`** (ink fill) for the default action; **`button-signal`** (teal fill) specifically for "go live / refresh live data" actions, so teal stays meaningfully tied to live state even in buttons; **`button-ghost`** for secondary/cancel actions. **`input-field`** — flat white, hairline border, sm radius, teal focus ring (`{colors.focus-ring}`).

### Loading
**`skeleton-strata`** — instead of a generic grey shimmer bar, loading placeholders use the four strata colors as thin stacked bands that softly shift, tying the loading state to the product's core visual language instead of a stock skeleton screen.

## Do's and Don'ts

### Do
- Reserve `{colors.signal-teal}` for things that are happening *right now* — live streams, current-well markers, real-time chart lines.
- Reserve `{colors.rust}` for the single highest-severity alert visible at once; use `{colors.brass}` for everything one notch below "elevated."
- Set every sensor-derived number in `IBM Plex Mono`, no exceptions — depth, pressure, ROP, timestamps, coordinates.
- Use the Depth Rail's strata-scroll as the one big motion moment per navigation; keep hovers quick and quiet.
- Keep cards flat at rest; let the hairline border do the work until a hover/focus event earns a shadow.

### Don't
- Don't add a shadow to a card that isn't hovered or focused — flat is the resting state.
- Don't use `{colors.strata-*}` tones as general UI chrome (button fills, nav backgrounds) — they mean "geology," not "brand color."
- Don't run the strata-scroll transition on routine hovers or button presses — it's reserved for route/data-refresh moments.
- Don't set body copy in the monospace face "for a technical look" — mono is reserved strictly for instrument-derived numbers.
- Don't stack ALL-CAPS + letter-spacing on every label; use sentence case with a color dot or icon for status instead.

## Responsive

| Breakpoint | Width | Key changes |
|---|---|---|
| desktop-large | 1440px+ | Full shell: sidebar + rail + content + well-context rail |
| desktop | 1280px | Well-context rail narrows to 280px |
| tablet | 1024px | Well-context rail collapses into a slide-over drawer (`{motion.slow}` entrance) |
| tablet-narrow | 768px | Sidebar auto-collapses to icon-only (72px); Depth Rail persists |
| mobile | 640px | Sidebar becomes a bottom-anchored drawer; topbar search collapses to icon; cards stack 1-up |

## Iteration Guide

1. Every number that comes from a sensor, a report, or a coordinate gets `IBM Plex Mono` — check this first on any new component.
2. Before adding a shadow anywhere, confirm it's answering a hover/focus event, not decorating a resting card.
3. Before adding motion, ask whether it's the one strata-scroll moment for this transition, or a hover — don't invent a third motion pattern.
4. New status types should map onto moss/brass/rust before inventing a new color — the system deliberately has only three severity tones.
5. When the 3D viewer ships, it drops into the existing `viewport-3d` slot — dark ink-deep background, zero padding, hairline outer border — without needing new tokens.

## Known Gaps

- **3D viewport interaction states** (loading, orbit-drag active, model-error) are spec'd as a container only — exact in-canvas UI (axis gizmo, layer toggle) should be designed once the actual 3D asset pipeline is chosen.
- **Data-table density options** (compact vs. comfortable) not yet defined — needed once historical-report tables are built out.
- **Print/export styling** (PDF report export) not covered — likely needed for judge-facing or engineer-facing exports later.
