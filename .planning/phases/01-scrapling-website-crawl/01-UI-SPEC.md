---
phase: "01"
slug: "scrapling-website-crawl"
status: draft
shadcn_initialized: true
preset: "shadcn default, project-local components"
created: "2026-10-02"
---

# Phase 01 — UI Design Contract

> Visual and interaction contract for the website crawl workflow in the existing dashboard.

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn-style local component system |
| Preset | default; configured in `components.json` |
| Component library | Radix UI primitives, wrapped by project-local components |
| Icon library | Lucide React (`lucide-react`) |
| Font | Inter, with system sans-serif fallback |

The contract applies to the Configure page's Crawl tab and its crawl result states. Preserve the existing dashboard shell, tabs, and navigation. Do not redesign the unrelated Vectorize, Theme, Preview, or Embed Code tabs as part of this phase.

## Component Inventory

Enumerated by `Get-ChildItem src/components/ui -File | Measure-Object` — 49 components — `nochbot@0.1.0` — 2026-10-02. The following relevant components are a non-exhaustive selection; this list is not a closed allowlist.

| Component | Import path | Notes |
|-----------|-------------|-------|
| Button | `@/components/ui/button` | Crawl, retry, next-step, and upgrade actions |
| Input | `@/components/ui/input` | Website URL entry; retain URL input semantics |
| Label | `@/components/ui/label` | Programmatic and visible URL field label |
| Badge | `@/components/ui/badge` | Compact page outcome labels |
| Alert | `@/components/ui/alert` | Cap, fallback, and retained-knowledge notices |
| Progress | `@/components/ui/progress` | Optional crawl progress only when a real measurable value exists |
| Skeleton | `@/components/ui/skeleton` | Loading placeholder for result summary/list |
| Tooltip | `@/components/ui/tooltip` | Explain unfamiliar icon-only controls; prefer visible labels |
| ScrollArea | `@/components/ui/scroll-area` | Only if the result list requires a bounded desktop region |

## Screen Contract

### Crawl tab

- Keep the established Configure page hierarchy. The primary visual anchor is the URL input and its adjacent primary crawl action; completed results follow immediately beneath it.
- Place a concise heading above the form and a visible label `Website URL`. Use an example URL placeholder, not as the only label.
- Preserve `POST /api/crawl` with request body `{ url }`.
- The primary action reads `Start Website Crawl`; after a successful crawl it reads `Re-crawl Website`. While in flight it reads `Crawling Website…`, shows a small spinner, and is disabled along with the URL field.
- Disable the primary action for blank input. Keep keyboard submission available. Validation and crawl feedback must be announced through an `aria-live="polite"` status region; errors use an assertive alert.
- Show a compact summary with pages indexed and total chunks indexed. Do not imply vector persistence unless the server confirms indexing/publishing succeeded.
- Render one readable row per selected page with page title (when available), URL, outcome/status, safe reason for skipped/blocked/failed pages, and chunks extracted for that page. A failed or skipped page shows `0 chunks` when the count is known; never invent a count.
- At the entry-plan cap, keep the crawl result successful and show this non-blocking copy: `Crawled 15 pages. For more, upgrade your plan.` Link `Upgrade your plan` to the existing `/dashboard/account` destination. A page limit is a deferred/not-crawled outcome, not a crawl failure.
- If the Scrapling provider is unavailable and the legacy crawler completes the crawl, show a non-blocking notice: `Scrapling was unavailable, so the legacy crawler handled this crawl.` Keep the successful page and chunk results visible.
- If a recrawl fails before publication, show: `Crawl failed. Your previously indexed website knowledge is still active. Check the URL and try again.` Do not clear or visually imply loss of the previous active knowledge.
- Do not display raw HTML, internal addresses, provider exception text, credentials, or sensitive query values in page reasons or logs.
- Preserve a visible next action after success: `Review Indexed Content`, advancing to the existing Vectorize tab.

### Responsive behavior

- On desktop, the URL field and primary action share a row; the result summary is a compact horizontal group and page outcomes form a full-width list.
- At narrow widths, stack the field and action, allow the action to fill available width, and wrap summary metrics. Page rows become stacked label/value groups; long titles and URLs wrap safely rather than expanding the viewport or hiding status/chunk data.
- Keep page status and chunk count visible without hover. The 15-page list remains in normal page flow; avoid nested cards and avoid a fixed-height clipped list that hides outcomes.

### Interaction and accessibility

- Use a semantic form, associated input label, buttons for actions, and anchors for navigation. All actions must be keyboard reachable with a visible focus ring.
- Pair status color with a text label and, where appropriate, a Lucide icon. Do not communicate success, warning, or failure by color alone.
- Distinguish indexed, skipped/empty, blocked, failed, and deferred-by-cap outcomes in text.
- Loading state has a visible spinner plus `Crawling Website…`; do not expose fake incremental progress.
- Do not add destructive actions or a destructive confirmation dialog in this phase.
- Respect reduced-motion preferences; the loading indicator may remain static when motion is reduced.

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gap, compact status details |
| sm | 8px | Input/action and row-internal spacing |
| md | 16px | Default gaps and row padding |
| lg | 24px | Crawl panel section spacing |
| xl | 32px | Main panel padding on wide screens |
| 2xl | 48px | Major separation from surrounding dashboard content |
| 3xl | 64px | Not used in this focused workflow |

Exceptions: none. Crawl-specific repeated rows use a maximum 8px corner radius; do not add decorative cards or cards inside cards.

## Typography

Use only these four sizes and two weights in the Crawl tab:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / metadata | 12px | 400 | 16px |
| Body | 14px | 400 | 20px |
| Section heading | 20px | 600 | 28px |
| Result summary number | 28px | 600 | 32px |

Long page titles and URLs wrap within their row. Do not use viewport-scaled type or negative letter spacing.

## Color

Use the existing Configure/dashboard palette for this focused panel. Approximate split is 60/30/10 across the crawl surface:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0a0a0a` | Crawl panel and page background |
| Secondary (30%) | `#1f2228` | Input surface, result rows, restrained section surface |
| Accent (10%) | `#36f4a4` | Primary crawl action, focus indication, indexed/success state |
| Destructive | `#ef4444` | Crawl failure text/border only |
| Warning | `#eab308` | Page-cap and provider-fallback notices, paired with text |
| Muted text | `#7d8187` | Secondary metadata and helper copy |

The green accent is reserved for the primary crawl action, keyboard focus, and confirmed indexed/success states; it is not a blanket color for every interactive control. Amber and red are semantic warning/error colors, not additional decorative accents. Maintain readable contrast against dark surfaces.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Start Website Crawl` |
| In-flight CTA | `Crawling Website…` |
| Repeat CTA | `Re-crawl Website` |
| Empty state heading | `No pages crawled yet` |
| Empty state body | `Enter a website URL to build or refresh your chatbot's knowledge.` |
| Success summary | `{pages} pages indexed · {chunks} chunks added` |
| Cap warning | `Crawled 15 pages. For more, upgrade your plan.` |
| Upgrade link | `Upgrade your plan` |
| Legacy fallback notice | `Scrapling was unavailable, so the legacy crawler handled this crawl.` |
| Page list heading | `Crawled Pages` |
| Error state | `Crawl failed. Your previously indexed website knowledge is still active. Check the URL and try again.` |
| Next step | `Review Indexed Content` |
| Destructive confirmation | None; no destructive UI is introduced. |

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Crawl form and page-results list | ✅ covered | An unfilled form has a visible URL label and the documented empty-state copy; the page list is omitted until results exist. |
| loading | Crawl form, primary action, page-results list | ✅ covered | The URL field/action disable during the request; the action shows a spinner and `Crawling Website…`; result placeholders do not claim progress. |
| error | Crawl form and page-results list | ✅ covered | Actionable error copy explains that previous indexed knowledge remains active and gives the retry path; per-page failures have safe reasons. |
| populated | Page-results list | ✅ covered | Each returned page shows title/URL, outcome, reason where applicable, and chunk count; summary shows total pages and chunks. |
| partial | Page-results list | ✅ covered | Mixed indexed and skipped/blocked/failed outcomes remain visible; page-limit deferrals do not turn successful indexing into a failure. |
| overflow | Page-results list and URL/title content | ✅ covered | The list stays in normal page flow; long content wraps and cannot hide page status or chunk count. |
| zero-one-many | Page-results list and summary | ✅ covered | Empty results use the empty state; one or many results use the same labeled list and actual pluralized counts. |
| long-text | URL field, page title/URL, safe page reason | ✅ covered | Long values wrap within responsive rows; no horizontal viewport overflow or hover-only access is required. |

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official / project-local wrappers | Existing Button, Input, Label, Badge, Alert, Skeleton, Tooltip; no new registry blocks | not required |

No third-party registry components are proposed.

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
