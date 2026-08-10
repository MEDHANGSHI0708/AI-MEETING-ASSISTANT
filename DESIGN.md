---
version: alpha
name: Quiet Orbit
description: Dark, breathy, near-black galaxy theme for the AI Meeting Assistant frontend. One accent color, sparse stars, restrained motion.
colors:
  bg: "#0b090f"
  surface: "#14121a"
  surfaceHover: "#1d1a23"
  border: "#2c2934"
  borderInput: "#5f5b6b"
  ink: "#f2f1f5"
  inkMuted: "#a6a2b0"
  inkFaint: "#6a6773"
  accent: "#A284E3"
  accentHover: "#b597f7"
  accentActive: "#8c67d2"
  accentInk: "#0a0614"
  star: "#f2f0f8"
typography:
  h1:
    fontFamily: Geist Sans
    fontSize: 34px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.02em
  h2:
    fontFamily: Geist Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.01em
  body:
    fontFamily: Geist Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  small:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  mono:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  base: 16px
  md: 24px
  lg: 40px
  xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accentInk}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.borderInput}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  sidebar-item-active:
    backgroundColor: "{colors.surfaceHover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
---

## Overview

Quiet Orbit is a dark, near-black theme built around a single accent, `#A284E3`. The mood is a clear night sky at high altitude, not a starfield poster: mostly calm dark space, a handful of soft points of light, one color used with intent. The theme should read as restrained and unhurried before it reads as "space themed" — atmosphere, not decoration.

shadcn/ui's **Mira** style (the compact preset, tight radii and padding, built for dense product UI) governs component internals. To keep the "breathy" feel despite Mira's density, generous **outer** spacing (page margins, section gaps, sidebar padding) does the breathing-room work, while components themselves stay compact and efficient.

## Colors

Color strategy: **Restrained**. A near-black, faintly violet-tinted neutral ramp carries the whole surface; the accent is reserved for interactive and focus moments and should never exceed roughly 10% of any screen's surface area.

- `bg` (#0b090f) — page background. Not pure black; carries a whisper of the accent's hue so it reads as "space," not "OS dark mode."
- `surface` (#14121a) / `surfaceHover` (#1d1a23) — cards, the sidebar, the input bar, hover states.
- `border` (#2c2934) — decorative dividers only (low contrast by design; not for anything that needs to read as interactive).
- `borderInput` (#5f5b6b) — borders on inputs, buttons, anything the user must recognize as an interactive boundary. Verified ≥3:1 against `bg`.
- `ink` (#f2f1f5) — primary text. 17.6:1 against `bg`.
- `inkMuted` (#a6a2b0) — secondary text, timestamps, placeholders. 7.9:1 against `bg` — deliberately well above the 4.5:1 floor; muted gray-on-dark is the easiest place for contrast to quietly fail, so this shade was picked with margin.
- `inkFaint` (#6a6773) — decorative-only (icon strokes, disabled states). 3.6:1 — large text / non-text UI only, never body copy.
- `accent` / `accentHover` / `accentActive` — the brand purple and its interaction states.
- `accentInk` (#0a0614) — text/icon color placed on top of `accent`. Use this, not white, on accent buttons (6.6:1 vs. white's 3.0:1).
- `star` (#f2f0f8) — the starfield dot color, always at low opacity (see Components: Galaxy background below), never at full white.

## Typography

One family, multiple weights: **Geist Sans** for all UI text, **Geist Mono** reserved for anything tabular or literal (durations, timestamps in a transcript view). Both ship with Next.js via `next/font`, no external font loading. Headings stay small and quiet (h1 caps at 34px) — this is a product surface, not a landing page; hierarchy comes from weight and spacing, not scale.

## Layout & Spacing

Two-pane shell: a fixed sidebar (~280px) and a fluid main pane. The main pane's content sits inside a centered column with real margin on wide screens — never edge-to-edge. Spacing scale is deliberately wide at the top end (`lg`/`xl`) so sections have room around them; Mira's component-level compactness is offset by generous section-level gaps.

## Elevation & Depth

No drop shadows as a default — depth comes from the `bg` → `surface` → `surfaceHover` step, not from shadow. The one exception is the galaxy backdrop itself, which uses a very soft, large-radius radial glow (blurred, low-opacity accent) behind the hero area to suggest depth without a literal shadow.

## Shapes

Mira's compact radii: `sm` (6px) for chips/badges, `md` (10px) for buttons and list items, `lg` (16px) for the input bar and cards, `full` for avatars and the record/mic control.

## Components

- **Galaxy background**: a fixed, full-viewport layer behind all content. Sparse (dozens, not hundreds) of small `star`-colored dots at low opacity (0.15–0.6), placed with deliberate irregularity (no visible grid), a handful with a very slow opacity pulse. One soft, large, blurred radial gradient in `accent` at very low opacity anchored off-canvas top-right, suggesting a distant nebula rather than a lit-up sky. Everything here must pass as "barely there" on first glance — if it's the first thing a user mentions, it's overdone. Must fully disable the pulse animation under `prefers-reduced-motion: reduce`.
- **Sidebar**: `surface` background, `New meeting` primary action at top, a `MEETINGS` list of past sessions below (title + relative time), active item gets `surfaceHover` + a left-aligned accent-colored dot (not a side-stripe border), account control pinned to the bottom.
- **Greeting + suggested actions**: large quiet headline, muted subheading, a short vertical list of suggested actions (icon + label + chevron) using `surface` rows separated by `border` hairlines, not individual cards.
- **Input bar**: pill-shaped (`rounded.lg`), `surface` background, `borderInput` border, attach/plus control on the left, freeform text input, a compact source-type indicator and mic/record control on the right. Sits with real breathing room above the viewport's bottom edge, not flush.

## Do's and Don'ts

- Do keep the accent to interactive moments: buttons, active states, focus rings, the one nebula glow. Don't tint large background regions with it.
- Do let `inkMuted` (not `inkFaint`) carry any secondary body text. Don't use `inkFaint` for anything readable.
- Do keep the starfield sparse and mostly static. Don't animate every star, and don't let the field become the visual focus of the page.
- Don't use literal space iconography (planets, rockets, satellites). Don't use neon glow, laser gradients, or gradient text.
- Don't add drop shadows as a default elevation method; use the surface-step ramp instead.
