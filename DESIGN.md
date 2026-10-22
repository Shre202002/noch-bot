---
name: NochBot
description: A near-black working surface for organizers, where one mint signal marks what is live, ready or done.
colors:
  void-black: "oklch(0 0 0)"
  paper-white: "oklch(0.98 0 0)"
  card-black: "oklch(0.06 0 0)"
  sidebar-black: "oklch(0.04 0 0)"
  well-grey: "oklch(0.12 0 0)"
  raised-grey: "oklch(0.14 0 0)"
  quiet-text: "oklch(0.6 0 0)"
  hairline: "oklch(1 0 0 / 10%)"
  desk-black: "#0a0a0a"
  panel-line: "#2a2d35"
  panel-raised: "#1f2228"
  text-secondary: "#9095a0"
  text-tertiary: "#878b93"
  icon-muted: "#73777f"
  signal-mint: "#36f4a4"
  waiting-amber: "#eab308"
  refused-red: "#ef4444"
  destructive: "oklch(0.6 0.22 25)"
  chart-blue: "oklch(0.62 0.22 264)"
  chart-violet: "oklch(0.55 0.24 300)"
  chart-green: "oklch(0.7 0.17 162)"
  chart-amber: "oklch(0.77 0.19 70)"
  chart-rose: "oklch(0.65 0.25 16)"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(4rem, 18vw, 16rem)"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
  code:
    fontFamily: "Source Code Pro, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.void-black}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.paper-white}"
  button-outline:
    backgroundColor: "{colors.void-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  button-signal:
    backgroundColor: "{colors.signal-mint}"
    textColor: "{colors.void-black}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 24px"
  card:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.void-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  badge-status:
    backgroundColor: "{colors.signal-mint}"
    textColor: "{colors.void-black}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: NochBot

## Overview

**Creative North Star: "The Night Desk"**

NochBot is a dark working surface: a near-black desk where an organizer, or a person at a dim door, does one job at a time. Pure black and a few steps of grey carry almost everything; a single mint signal says what is live, ready, scanned or about to happen. The mood is calm and exact, never decorative. Nothing competes with the data on screen.

The system serves two kinds of surface. The organizer dashboard is an operating tool: dense but quiet, built from hairline-bordered black cards, pill buttons and plain tables. The public pages (scanner, tickets, the embedded chat) are single-column and thumb-sized, always dark, with large results that read at arm's length. The marketing landing page borrows the same black and mint but spends more atmosphere (an aurora background and an oversized wordmark); it is the one place where the system is allowed to be loud.

The embedded website assistant is a separate world: it wears each organizer's own theme from Bot Config and is not governed by this file.

**Key Characteristics:**
- Pure-black canvas with tonal layering (black, card black, well grey) instead of shadows
- One accent, signal mint (#36f4a4), reserved for live, ready, done and primary emphasis
- Hairline structure: 10% white borders, no heavy outlines
- Pills for actions and status, soft 8-16px corners for containers
- Inter throughout, tightly tracked headings, tabular numerals for counts
- Status is never colour alone: every state has a word or an icon

## Colors

A monochrome field with a single living colour. Black and grey establish depth; mint, amber and red are signals with fixed meanings.

### Primary
- **Signal Mint** (#36f4a4, Tailwind `signal`): the one accent. Primary actions on public and operational screens, the "Live" and "Scanned" states, success banners, focus glow, progress fill. It is the most-used colour in the product and still appears on a small share of any screen.

### Secondary
- **Waiting Amber** (#eab308): waiting for approval, already scanned, anything that needs a human look but is not an error.
- **Refused Red** (#ef4444): refused tickets, test tickets, blocked accounts, destructive actions. The theme's destructive token (oklch(0.6 0.22 25)) is its calmer cousin for system components.

### Neutral
- **Void Black** (oklch(0 0 0)): the page background and the base of inputs and outline buttons.
- **Paper White** (oklch(0.98 0 0)): primary text and the default button fill. Never a page background.
- **Card Black** (oklch(0.06 0 0)): cards and popovers. **Sidebar Black** (oklch(0.04 0 0)) sits slightly deeper for the dashboard rail.
- **Well Grey** (oklch(0.12 0 0)) and **Raised Grey** (oklch(0.14 0 0)): secondary fills, hover and accent surfaces, table stripes.
- **Desk Black** (#0a0a0a, Tailwind `desk`): the solid surface of standalone public pages such as the scanner, with **Panel Line** (#2a2d35) for solid dividers and **Panel Raised** (#1f2228) for inset panels.
- **Hairline** (oklch(1 0 0 / 10%)): the default border and input stroke.
- **Quiet Text** (oklch(0.6 0 0)), **Secondary Text** (#9095a0), **Tertiary Text** (#878b93), **Muted Icon** (#73777f): the four text and icon roles under primary, each tuned to clear WCAG AA on the dark surfaces they sit on (the tuning is documented in globals.css).
- **Chart colours** (blue, violet, green, amber, rose): analytics charts only; never used for interface chrome.

### Named Rules
**The One Signal Rule.** Signal mint is the only accent. It marks what is live, ready, scanned or primary, and it earns its power by being rare. Amber means waiting, red means refused or destructive; no other hue carries meaning.

**The Never-White-Page Rule.** Pages are black. Paper white is for text and the default button, never a surface behind content. The one sanctioned exception is the dashboard's opt-in light theme (header sun/moon toggle, `:root.dashboard-light` in `globals.css`), which is scoped to the dashboard and never applies to public pages, the landing page or the embedded widget.

**The Grey Ladder Rule.** Secondary text steps down through the four named greys, not through arbitrary opacity. Small captions use the Secondary Text step or brighter, never fainter.

## Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Label/Mono Font:** Source Code Pro for codes and measurements (ticket codes use the browser monospace)

**Character:** One family, many weights. Inter at heavy weights with tight tracking gives headings an engineered, confident voice; at 14px regular it stays out of the way. The stylistic sets ss01 and cv11 are on for the open, single-storey letterforms.

### Hierarchy
- **Display** (700, clamp(4rem, 18vw, 16rem), 0.85, -0.04em): the landing wordmark only.
- **Headline** (900, 2.25-2.5rem, 1.1, -0.04em): dashboard page titles ("Bookings", "Scanning") and the event name on tickets.
- **Title** (700, 1.125rem, 1.3, -0.04em): card titles and section headings.
- **Body** (400, 0.875rem, 1.5): everything else. Long reading text stays within 65-75ch.
- **Label** (500, 0.6875rem, 0.05em, uppercase): column headers and counter captions. Sparing; never an eyebrow above a heading.
- **Counters** (900, 1.875-2.25rem, tabular numerals): live numbers such as Scanned, Left, Total.

### Named Rules
**The Tight Heading Rule.** Every h1-h4 is tracked at -0.04em (set globally); body text keeps default tracking.

**The Tabular Rule.** Any number that changes while someone watches (counts, times, prices) uses tabular numerals so the layout does not jitter.

## Layout

The dashboard is a persistent sidebar plus a content column. The sidebar is sticky, full height, bordered on its right edge, 14rem wide at medium screens and 16rem at large, and collapses to a 5rem icon rail; below the medium breakpoint it becomes a drawer (min(20rem, 85vw)) that respects the device's safe areas. Content sits in a centred column capped at max-w-6xl with 24-32px between sections and generous bottom padding. Cards live in two-column grids at medium widths and one column on phones; counter groups stay three across even on a phone.

Public pages (scanner, ticket, booking) are a single narrow column (max-w-md, up to max-w-4xl when a phone is held sideways) with the primary control in the thumb zone. Breakpoints are Tailwind's (640, 768, 1024) plus a custom `short-landscape` variant for a phone held sideways, where the camera moves beside the results. Spacing follows a 4px scale; 8, 16, 20 and 24px do most of the work. Wide data (attendee tables) is a table from tablet up and a card list on phones, never a sideways scroll.

## Elevation & Depth

Depth is tonal first: black page, card black cards, well grey wells, hairline borders. Surfaces are flat at rest. Shadows appear only on things that float (popovers, dialogs, menus, the cookie notice, sticky previews), and there they are large and soft (shadow-2xl, shadow-xl). Small controls carry at most a barely visible lift (shadow-sm at 5% black).

### Shadow Vocabulary
- **Float** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`, Tailwind shadow-2xl): popovers, dialogs, the dashboard user menu.
- **Control lift** (`shadow-sm shadow-black/5`): default buttons and inputs, barely perceptible.
- **Signal focus** (`box-shadow: 0 0 0 3px rgba(54, 244, 164, 0.18)`): focused inputs in forms where mint is the accent; it replaces a heavier ring, with a visible outline kept for keyboard focus on buttons.

### Named Rules
**The Flat-By-Default Rule.** A surface has no shadow until it floats above others. Shadows are a response to stacking, not decoration.

## Shapes

Two shape voices. **Pills** (fully rounded) are for anything a person acts on or reads as a label: buttons on operational screens, status badges, filter chips, the Live indicator. **Soft rectangles** (8px for system controls, 12-16px for panels, up to 20px for large public panels and ticket cards) hold content. Borders are one pixel and hairline; emphasis comes from fill, not from heavier strokes. Result banners on the scanner are the exception: a 2px tinted border so a verdict reads from a distance.

## Components

### Buttons
- **Shape:** 8px corners for the default system button (36px tall), fully rounded for the signal button.
- **Primary:** paper white fill, black text, 8px 16px padding; hover drops the fill to 90%.
- **Signal:** mint fill, black text, bold, pill (the `signal` variant of the shared Button). Used for the main action on operational and public screens (Approve, Create scanner link, Start camera).
- **Outline / Ghost:** hairline outline on black, accent-grey hover fill; ghost has no outline.
- **Hover / Focus:** colour transitions only; keyboard focus shows a 2px outline offset by 2px in the ring colour.
- **Touch:** on phones, any control a thumb must hit grows to at least 44px tall.

### Chips and Badges
- **Style:** fully rounded, 12px semibold text. Status badges fill with the signal colour (Scanned, Approved) or sit as a quiet secondary fill (Not yet).
- **Filter chips:** hairline outline, mint outline and tint when pressed; the pressed state is also exposed to assistive tech.

### Cards / Containers
- **Corner Style:** 8px by default; 12-16px for dashboard panels.
- **Background:** card black on a black page, or a 40% card black wash on dashboards.
- **Border:** hairline, brightening slightly on hover for clickable cards.
- **Internal Padding:** 20px (12px on phones where space is tight).

### Inputs / Fields
- **Style:** hairline stroke, black fill, 8px corners, 36px tall on the dashboard; 48px tall with an inset icon on public sign-in screens.
- **Focus:** border and soft mint glow; placeholders at readable contrast.
- **Error:** the error text sits under the field in plain words, announced to screen readers; invalid fields turn red.

### Navigation
The sidebar groups pages under collapsible section labels (10px, bold, uppercase, wide tracking: Assistant, Events, Insights) with an icon and a title per item. The current page is a paper-white filled row with black text (40px tall, 12px corners, a soft shadow), and the group holding it can never be collapsed. Other items are muted grey and gain the raised-grey fill on hover. On phones it opens as a drawer. There is no top bar clutter: page titles live in the content.

### Result Banner (signature)
The scanner's verdict: a full-width tinted panel with a thick icon, a heavy title ("Admitted", "Already scanned", "Fake ticket"), a detail line and the code in monospace. Green, amber or red is always paired with an icon and a word, so the verdict never depends on colour alone.

### Live Indicator (signature)
A pill with a pulsing dot: mint and "Live" when data is flowing, amber and "Reconnecting…" when it stalls, red and "Stopped" when updates have ended. The pulse stops under reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep signal mint (#36f4a4) to the roles it owns: primary action, live, ready, scanned, focus.
- **Do** build depth from black, card black and well grey with hairline borders before reaching for a shadow.
- **Do** pair every status colour with a word or icon, and give counters tabular numerals.
- **Do** make phone controls at least 44px tall and keep primary actions within thumb reach.
- **Do** use pills for actions and status and soft 8-16px rectangles for containers.
- **Do** write errors in plain words next to what went wrong, with a way to retry.

### Don't:
- **Don't** put a white or light surface behind public-page content, or behind the dashboard unless the user chose the light theme.
- **Don't** introduce a second accent hue for chrome; blue, violet and rose belong to charts.
- **Don't** use mint for body text on light backgrounds, or as a decorative gradient.
- **Don't** rely on colour alone to say "scanned", "waiting" or "refused".
- **Don't** make secondary text fainter than the Secondary Text grey (#9095a0).
- **Don't** add heavy borders or hard offset shadows; structure is hairline, emphasis is fill.
- **Don't** apply this system to the embedded chat widget, which follows each organizer's own theme.
