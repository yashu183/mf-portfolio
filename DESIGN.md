# Vesta design system

Vesta is a private portfolio tracker for mutual funds, fixed deposits, gold, silver and EPF. Its look follows
Vercel's design language ([design-md/vercel](https://github.com/VoltAgent/awesome-design-md) in
VoltAgent/awesome-design-md): stark ink on near-white with a Geist dark twin, a grey ladder for every surface
and divider, and type doing the work instead of colour.

The app and the landing page are **one design system**. A change to one is not done until the other matches.

Source of truth: `client/src/index.css` (tokens and shared classes). This document explains it.

---

## 1. Principles

1. **Ink, not colour.** Text, buttons and structure are greys. Colour is kept for data (chart series, the
   asset dots) and state (gain, loss, warning, link).
2. **Hairlines, not borders.** Cards are held by a 1px ring and a soft shadow, never a heavy drop or a thick
   border.
3. **One big number per view.** The left column's balance is the headline. Everything else stays small.
4. **The frame stays put.** The page head, toolbars, section headings and table column heads stay pinned
   while only the content scrolls, on every screen size.
5. **Layout follows the space, not the window.** Lists and grids lay themselves out by the width of their own
   column (container queries), so they never break beside a sidebar.
6. **Light and dark are equals.** Every colour is a role that flips with `<html data-theme>`. Dark is its own
   palette, not an inverted light one.
7. **Private by default.** One switch hides every rupee figure across the app.

---

## 2. Colour

Every colour is a CSS variable on `:root[data-theme]`, exposed to Tailwind through `@theme`. **Use the role
classes (`bg-surface`, `text-body`, `border-line`…), never raw hex values** in components.

### Roles

| Role | Tailwind | Light | Dark | Use |
|---|---|---|---|---|
| `--c-canvas` | `bg-canvas` | `#fafafa` | `#000000` | Page background, pinned bands |
| `--c-surface` | `bg-surface` | `#ffffff` | `#0a0a0a` | Cards, inputs, the sidebar, the page head |
| `--c-surface-strong` | `bg-surface-strong` | `#f2f2f2` | `#1a1a1a` | Inset regions, quiet controls, hover rows, selected toggle |
| `--c-ink` | `text-ink` | `#171717` | `#ededed` | Headings, figures, primary text |
| `--c-body` | `text-body` | `#4d4d4d` | `#a1a1a1` | Body copy, inactive tabs |
| `--c-muted` | `text-muted` | `#6f6f6f` | `#8f8f8f` | Labels, eyebrows, secondary figures |
| `--c-muted-soft` | `text-fog` | `#a1a1a1` | `#5f5f5f` | Disabled, faint hints |
| `--c-line` | `border-line` | `#ebebeb` | `#1f1f1f` | Dividers, row hairlines |
| `--c-line-strong` | `border-line-strong` | `#d4d4d4` | `#2e2e2e` | Control outlines, input rings |
| `--c-primary` | `bg-primary` | `#171717` | `#ededed` | Primary button (black in light, white in dark) |
| `--c-on-primary` | `text-on-primary` | `#ffffff` | `#0a0a0a` | Text on the primary button |
| `--c-link` | `text-link` | `#5367ff` | `#5367ff` | Links, focus outline, "Good" status (Groww's blue; one blue across the app) |
| `--c-up` | `text-gain` | `#1a7f37` | `#63c174` | Gains, "Excellent", the Live dot |
| `--c-down` | `text-loss` | `#c50000` | `#ff6166` | Losses, "Underperforming", errors |
| `--c-warn` | `text-warn` | `#ab570a` | `#f2a20d` | "Monitor", warnings |
| `--c-ring` | - | black 8% | white 10% | The card's 1px ring |

`--c-muted` is one step deeper than Vercel's `#888` in light mode, so it passes as text contrast.

Legacy aliases (`ink-2`, `slate`, `lavender`, `vesta-*`…) point at the same roles. They exist so older
components keep working. **New code uses the role names above.**

### Status

Status always pairs a **dot and a word** and never relies on colour alone:

| Status | Dot | Label |
|---|---|---|
| excellent | `bg-gain` | Excellent |
| good | `bg-link` | Good |
| monitor | `bg-warn` | Monitor |
| poor | `bg-loss` | Underperforming |

### Chart palette

Charts can't read CSS variables inside SVG attributes, so they take colours from `chartPalette(theme)` in
`client/src/hooks/useTheme.js`. These are separate light and dark steps of the same hues, each validated
against its theme's surface.

| Slot | Asset | Light | Dark |
|---|---|---|---|
| 0 | Mutual Funds | `#5367ff` blue | `#5367ff` |
| 1 | Fixed Deposits | `#eb6834` orange | `#d95926` |
| 2 | EPF | `#1baf7a` aqua | `#199e70` |
| 3 | Gold | `#eda100` yellow | `#c98500` |
| 4 | Silver | `#e87ba4` magenta | `#d55181` |

The palette also provides `grid`, `tick`, `muted`, `primary`, `up`, `down`, `invested` (the value cards' blue, `#5367ff` in both themes and the PDF) and `surface` for axes, gridlines
and gaps.

Rules:
- **Colour follows the asset, never its rank.** Mutual Funds is always slot 0, whatever is filtered or sorted.
  The same colour is used in the sidebar icon, the chart and the list dot.
- **The slot order is part of the palette.** Neighbouring slots were checked for colour-blind separation in
  this order. Don't reorder them, and never generate extra hues.
- Status colours (`up`, `down`, `warn`) are never reused as series colours.

---

## 3. Typography

Fonts: **Geist** (400–600) and **Geist Mono** (400, 500), loaded from Google Fonts in `client/index.html`.

| Style | Spec | Where |
|---|---|---|
| Page title (h1) | 28px → 32px from `md`, 600, tracking −0.04em, leading 1.25 | Page head |
| Section heading (h2) | 20px / 28px, 600, tracking −0.035em | Pinned section headings |
| Sub-heading (h3) | 16px, 600, tracking −0.02em | Performance groups, card titles |
| Body | 14px / 20px, `text-body` | Subtitles, descriptions |
| Small | 13px | List rows, tooltips, summary rows |
| Eyebrow (`.eyebrow`) | Geist Mono 12px / 16px, uppercase, tracking 0.02em, `text-muted` | Card labels, table heads |
| Mono meta | Geist Mono 12px, `text-muted` | "17 funds", "flexi cap · 7mo", timestamps |
| Figures (`.num`) | Tabular digits, 500, tracking −0.01em | Every amount in a list or column |
| Headline balance | 44px / 48px (34px when longer than 13 characters), 600, tracking −0.045em | `SummaryPanel` |

Rules:
- **600 is the ceiling.** Headings never go bold (700).
- **Heading tracking is always negative.** Mono labels are slightly positive.
- **Tabular digits are only for columns.** A big standalone figure (`BigAmount`) uses proportional figures,
  with the ₹ sign and the paise set at half size, raised and muted.

---

## 4. Shape, depth and spacing

| Token | Value | Use |
|---|---|---|
| Card radius | 12px | `.card` |
| Floating radius | 8px (`rounded-lg`) | Tooltips, dropdown menus |
| Control radius | 6px (`rounded-md`) | Buttons, inputs, selects, toggles |
| Inner radius | 4–5px | Selected segment inside a toggle, treemap tiles |
| Marketing pill | 100px (`.pill-round`) | **Landing page only** |
| Round | full | Icon buttons, status dots, the "Private" badge |

**Depth**
- `.card`: `background: surface` + `box-shadow: 0 0 0 1px var(--c-ring), var(--c-shadow)`. The ring is drawn
  **outside** the box (see the layout rules in §6 that protect it).
- Floating layers (tooltips, menus): the ring plus a stacked soft shadow (`0 8px 16px -4px`,
  `0 24px 32px -8px`).
- In dark mode `--c-shadow` is transparent: depth comes from the ring and the surface step.

**Spacing**
- Page wrapper (`WRAP` in `Navbar.jsx`): `max-w-[1200px] mx-auto px-4 sm:px-6`.
- Content starts **32px** (`pt-8`) below the page head. This gap is held on every screen (§6).
- Sections in a column: `space-y-10` (40px). Cards in a grid: `gap-4`. Two-column split: `gap-6 lg:gap-8`.
- Heading to content: 12px. List rows: `h-10` (40px) for compact rows, `py-3.5` for two-line rows.
- Card padding: `p-5` (20px), and `md:p-6` for chart cards.

---

## 5. Components

### Buttons (`.pill`)
- 40px high (32px with `.pill-sm`), 6px radius, 14px/500, 8px icon gap, `translateY(1px)` on press.
- `.pill-primary`: ink background (black in light, white in dark).
- `.pill-secondary`: surface background, `line-strong` ring, `surface-strong` on hover.
- Disabled: 50% opacity.
- Icon buttons (theme, hide amounts): 36px round, surface, `line-strong` ring.

### Inputs and selects
- 40px, `bg-surface`, 6px radius, ring `0 0 0 1px line-strong`.
- Focus/open: an ink ring plus a 4px `line` halo (`0 0 0 1px ink, 0 0 0 4px line`).
- The search field shows a `/` key hint, and pressing `/` focuses it.
- The `Select` menu is a floating layer: 8px radius, 36px options, a check on the selected one.
- **Filters take several picks** (`<Select multiple>`): an "All …" row at the top clears the filter, a hairline
  under it, then a 16px checkbox per option; the menu stays open while ticking. The button reads the first pick
  plus a count (`ELSS +2`), and ticking every option is the same as "All". Within one filter a row matches any
  pick; across filters it must match each.
- **One toolbar everywhere** (`FilterBar`): search first, the dropdowns beside it, an optional view switch on the
  right; under it a mono count line (`9 of 17 funds`) and, while anything is set, a quiet underlined
  `✕ clear filters` link on that line, never a button in the row. Pages pass their own dropdowns through
  `selects` (deposits: banks and holders).

### Segmented toggle
- A `surface-strong` track with `p-0.5`. The selected segment gets `bg-surface` and a ring.
- Used for: Current Value / Invested / Returns, the list/grid view switch, and the chart style switch.

### Tabs
- Mutual Funds' sections (Dashboard, Performance, Allocation, Recommendations, Timeline) sit in the page head:
  44px tall, an icon plus a label, and the active tab is `text-ink` with a 2px ink underline sitting on the
  head's bottom border.

### Cards
- **Summary panel** (left column): eyebrow → headline balance → change line (↑/↓, gain/loss colour) →
  hairline-divided label/figure rows.
- **List card**: one `.card` (it doesn't clip), a pinned mono column-head row (`.pin-cols`), then the rows as a
  `<ul className="divide-y divide-line overflow-clip rounded-[12px] @…:rounded-t-none">`, so the rows clip
  their own hover and detail bands. A row opens in place to a detail band on `surface-strong/50`. Every table
  is built this way, including Gold/Silver holdings (a CSS grid with `role="table"`, not a `<table>`, because
  a sticky header can't stop early inside a `<table>`).
- **Column alignment:** the first column (the row's name, with its mono meta line) is always left-aligned. In
  the fund, allocation, plan and holdings tables every other column is right-aligned, figures and states alike,
  with its column head. The **deposits** table centres its other columns (head and cells; a centred head hangs
  its sort arrow outside the caption so the caption stays on the centre), and the **cycle card** inside an
  opened deposit left-aligns all of its columns. The PDF report keeps the right-aligned rule, except that a few
  word columns that identify a row (category, holder) sit left beside the name.
- **Sorting:** every column head of a table is a button (`SortHead` in `Sort.jsx`, `useSort`). Numbers start
  high to low, words A to Z; a second click flips it; a third goes back to the list's own order (a list that has
  a natural ranking, like Performance's XIRR, is passed in already in that order). The arrow shows on hover and
  on the active column. Grid views don't sort; the order chosen in the list carries over.
- **Durations** read as years, months and days (`4 yrs 3 mo 18 days`, `heldFor`/`fundAge` in `formatters.js`);
  a count of months reads `3 yrs 10 mo` (`monthsAsYears`). Mono meta lines wrap rather than end in an ellipsis.
- **Deposits:** the row's circle is the bank's initials tinted with its palette colour (a short name stays
  whole: SBI); the holder is a tinted chip on the title line (`HolderChip`, one palette slot per person, apart
  from the bank colours); the term sits under the rate. An opened deposit shows a card of its cycles with its
  own small column heads: Cycle (rate and exact dates), Principal, Progress (bar, % centred under it), Status
  (dot and word), Value (amount, gain). Nothing in a row repeats what another column says.
  Once a deposit's last cycle has ended, its bar turns green at 100% and the line under it reads "matured"; the
  meta line then drops "cycle N", so it says so once.
- **Allocation cards** (Overview's Allocation, Mutual Funds' Categories): the chart with each share printed on
  its slice (6% and up), the key, then an **Insights** list in the summary panel's row style. On Mutual Funds the
  left column runs: balance, Categories, Top performer, Needs attention, then Insights as a card of its own.
- **Value card** (`ValueSplitCard`, in the left column of Gold, Silver, FDs and EPF): the Allocation card's chart
  with all six styles and their switch, cut into what went in (`chartPalette().invested`: #5367ff in both themes and the PDF, apart from both the gain green and the loss red) and what it earned (`up` green), with
  the key's amounts and shares, then a "Current value" total row: the two slices add up to it. Each page names the
  parts in its own words (Invested and Gain; Principal and Interest; Contributed and Interest). At a loss the
  slices are what's left of the money put in and the loss. The PDF draws it as a donut in each of those sections,
  the current value in the hole. The FD card follows the deposit filters, as the balance above it does.
- **EPF:** each account is one card (identity, details grid, contributed/interest split) whose foot is a
  "Contribution history · N rates" row with a chevron; it shows that account's rates in place on a
  `surface-strong/40` band, open by default, and folds them away like a deposit's cycles.

### Loading
- **Ghost loading, never a page spinner.** While a page's data first loads it shows its own shape in grey blocks
  (`.ghost`, a slow sheen; still under reduced motion): the summary card on the left, then the lists, cards and
  charts it will hold, from `client/src/components/portfolio/Ghost.jsx` (`PageGhost`, `SummaryGhost`,
  `ListGhost`, `CardsGhost`, `ChartGhost`, `PieGhost`, `TextGhost` for Claude's analysis). A refresh keeps the
  figures on screen and only the head's status chip says "Updating". Spinners stay only inside buttons.

### PDF report
- A "PDF" menu sits beside Refresh in the page head (`PdfMenu`): **Full report** or **Masked report**. The masked
  one hides rupee amounts and grams as `****` and keeps percentages, counts and dates; it carries a "Masked"
  badge and `-masked` in the file name. A report from the demo starts `vesta-demo-` (e.g.
  `vesta-demo-overview-…pdf`) and is prepared for "Demo portfolio". With amounts hidden on screen, the masked option comes first.
- Every donut's key gives each slice's exact amount beside its share, then a bold total line under a hairline
  (Total; "Total gains" when a slice at a loss was left out; "Current value" on the value donuts). Masked, the
  amounts read `₹****`. Gold, Silver, FDs and EPF each add the value donut (what went in and what it earned,
  the current value in the hole), as the value card on screen. The landing page's PDF mock shows the same key.
- Overview downloads every section; each asset page downloads only its own. The cover says who it is prepared
  for and the time in IST. Overview and Mutual Funds draw three donuts (current value, invested, returns; assets
  at a loss are named under the returns donut) and a ranked "return on what went in" list, two cards to a row, then
  the insights. Every category gets its own colour (ten series, no "Other"). Percentages print to two decimals; the
  tables' gain columns read "Gain/Loss". Page one's running head is just the Vesta mark, since the cover names the
  report, the person and the time; later pages carry them in the head.
- Built by `client/src/utils/pdfReport.js` (jsPDF + autotable, Geist embedded, loaded on the first click),
  printed in the light theme. Insights come from `client/src/utils/insights.js`, shared with the screens.
- **Grid card** (fund cards): initials plate → name + mono meta → 24px figure → footer with status and XIRR
  above a hairline. Closed cards share one height. A card opens without moving: it gets an ink ring and a turned
  chevron, and its details open in a full-width panel right under its row, with a notch pointing up at it
  (the row end comes from the grid's live column count).

### Status line
- The page head's right side has a "Live" chip (a 6px gain dot, the word, the mono time), a spinner while
  updating and "Offline" on error, plus a Refresh button.

### Info tip (`InfoTip`)
- A 20px info icon (14px `Info` icon, muted, ink on hover/focus) that explains a rule on hover or keyboard focus. The tip
  is a small surface card (8px radius, ring and soft shadow, 12px text, at most 260px wide) drawn on `<body>` with
  fixed positioning, so a scrolling menu or clipped card never cuts it; it opens under the icon (above near the
  window's foot) and stays inside the window. Clicking it never picks a menu row or opens a card.
- Used for the fund statuses: on each option of the status filter, at the right of each Performance group's
  heading, and beside the Status column head, where it lists all four with their dots (`StatusLegend`). The wording comes from `STATUS[...].rule` in `FundsTable.jsx`, which mirrors `deriveStatus` in the
  server: Excellent XIRR ≥ 15%, Good 12–15%, Monitor 0–12% or a SIP 6 months old or less, Underperforming < 0%.

### Tooltip (`ChartTooltip`)
- One tooltip for every chart: a mono uppercase title, then rows of swatch + label + right-aligned figure,
  then an optional total split off by a hairline.

### Navigation
- **≥1024px:** a fixed 240px sidebar (`bg-surface`, right hairline). The Vesta mark with a "Private" badge,
  a "Portfolio" eyebrow, then items with icons in their asset colour. Theme, hide amounts and Lock sit at
  the bottom.
- **Demo (`/demo`):** the same app with a made-up portfolio. The badge reads "Demo" in the link colour (also in
  the phone bar), a tinted note above the switches says what is sample and what is live, and **Exit demo**
  replaces Lock. The overview greets "Welcome to the demo" and the PDF is prepared for "Demo portfolio".
- **<1024px:** a sticky 56px menu bar (`bg-surface/90`, backdrop blur) with the menu button, the current page
  name, hide amounts and theme. The menu opens a 280px drawer from the left over a 50% black scrim.

---

## 6. Layout and scrolling

The aim: **wherever you are, the head and the controls stay put and only the content moves**, and nothing
ever shows through a gap.

### Breakpoints

| Range | Name | Navigation | Scrolling |
|---|---|---|---|
| < 768px | Phone | Menu bar | The page scrolls. The menu bar is pinned. |
| 768–1023px | Tablet | Menu bar | The page scrolls. The menu bar **and** the page head are pinned. |
| ≥ 1024px | Laptop | Sidebar | The page is fixed. Each column scrolls inside itself. |

### The pinned stack

From top to bottom, every pinned layer sits exactly under the one above it:

1. **Menu bar** (phone and tablet, 56px) or nothing (laptop).
2. **Page head**: title, status and tabs. Pinned at `md` and up.
3. **The 32px gap.** On tablets this is a solid 31px band hanging under the head (`::after`, canvas colour),
   so content stops short of the head. It is 31px, not 32, so the 1px ring of a card resting at the top of
   the gap still shows. On laptops the gap comes from the columns starting 32px down.
4. **Toolbar**: search, filters, count. It sits in `ScrollPane`'s toolbar slot, pinned below 1024px and
   static (above the scrolling list) from 1024px.
5. **Section heading** (`.pin-head`): it pins while its section scrolls past, then leaves with the section's
   end so the next heading takes its place.
6. **Column head** (`.pin-cols`): a table's column-head row pins under its section heading (or under the
   toolbar when there is no heading). When only the table's last row is left, the heading and column head stop
   and leave together with it, as a closed card: heading, column head, last row, one hairline between.

`PortfolioTracker` publishes `--head-h`, where the next pinned layer starts:
- **Laptop:** the head's height.
- **Tablet:** 56 + the head's height + 31.
- **Phone:** 56.

`ScrollPane` publishes `--tb-h` (its toolbar's height). `.pin-head` sits at `--head-h + --tb-h` below
1024px, and at `top: -1px` inside its scrolling column from 1024px.

`usePinCols()` (in `ScrollPane.jsx`) is the ref for a `.pin-cols` row. It:
- publishes `--ph-h`, the section heading's height. The row pins at that height, but never less than 1px below
  what's above it, so its own top ring (drawn 1px above it) is never cut off.
- makes the row and its heading stop at the last row. A sticky box stops where its margin box meets its
  container's end, so the row gets a bottom margin as tall as the last row, and the heading one as tall as the
  column head plus the last row. The next element takes the same margin back, so the two collapse and nothing
  moves. It re-measures on resize and when rows are added, removed or filtered.

### Building a view

- **Main column with a toolbar:** wrap it in `<ScrollPane toolbar={…}>`.
- **Main column without one:** put the `PANE` class on the column.
- **Left column:** `<aside>` with `lg:sticky lg:top-[calc(var(--head-h)+32px)]` and its own hidden-scrollbar
  overflow.
- **Two-column grid:** `grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start`.
- **Table column heads:** `<div ref={usePinCols()} className="pin-cols grid … h-10 items-center">` as the
  card's first child, with the rows (a `<ul>`) right after it, inside the same `<section>` as the heading. Put
  the hook in the component, not inline.
- **Section headings:** `<div className="pin-head flex items-baseline justify-between pb-3">` as the first
  child of the `<section>`. Use `pb-3` (padding, not margin), so the pinned band covers the space under the
  title.
  - Inside a `space-y-*` parent, Tailwind v4 puts the gap as a bottom margin **on the heading itself**. Set the
    heading's margin to the gap minus 12px (`mb-1` under `space-y-4`, `mb-0` under `space-y-3`). Never use a
    negative margin, which pulls the card up under the heading.

### Rules that keep edges clean

- **Card rings sit outside the box**, so anything that scrolls or pins must leave room for them:
  - Scrolling columns use `-mx-2 px-2` plus `pt-px` as an inset gutter, so rings aren't clipped at the edge.
  - Pinned bands (toolbar, `.pin-head`) use `-mx-2 px-2` to reach 8px past the column, so the left and right
    ring edges of cards scrolling underneath are covered.
  - `.pin-head` paints everything **except its last pixel**, so the ring of the card directly under it stays
    visible.
  - A pinned `.pin-cols` is the card's top: it draws the 12px top corners and the ring itself (`::after`,
    opaque), and `::before` paints the page colour behind it (1px past each side and above) so rows don't
    show past the rounded corners. It covers its full height, not just the corners: the ring is translucent,
    and the card's own ring beside it would stack into a brighter, doubled line. This is why its card must not
    clip (`overflow-hidden`/`overflow-clip` would cut both off).
- **No uncovered strips.** Every pinned layer starts exactly where the one above ends: band → toolbar →
  heading → column head. A 1px gap shows rows scrolling through it.
- **A scrolling column's `pt-px` counts.** Sticky offsets are measured inside the scroller's padding, so
  `top: 0` in a `pt-px` column leaves a 1px strip. That's why `.pin-head` uses `-1px` from 1024px.
- **No scroll box between a pinned row and its column.** `overflow-x-auto` around a table stops its head
  pinning, so wide tables only scroll sideways below the width they need (`overflow-x-auto
  @[760px]:overflow-x-visible`).
- **Solid bands use `flow-root`**, so a child's bottom margin stays inside the band's background.
- On laptops the footer is hidden, because the page never scrolls there. On phones and tablets the footer
  text is centred.

### Container queries

Lists and grids respond to **their column's width**, not the window's. `ScrollPane` and `PANE` both declare
`@container`, and `FilterBar` is its own container.

| Element | Compact | Full layout from |
|---|---|---|
| Filter bar | Search on its own row, filters wrap below | `@2xl` (672px): one row |
| Fund list | Name + value/returns, 2 columns | `@2xl`: every column |
| Recommendations, Allocation rows | Compact | `@xl` (576px) |
| FD rows | Compact | `@lg` (512px) |
| Card grids | 1 column | `@lg`: 2 columns, `@3xl` (768px): 3 columns |

Use `@…:` variants for anything inside the main column. Use viewport breakpoints (`md:`, `lg:`) only for page
structure.

---

## 7. Data visualisation

Charts use Recharts or plain SVG/HTML, take colours from `chartPalette(theme)`, and share `ChartTooltip`.

**Marks**
- Thin marks and recessive axes: grid lines in `palette.grid`, ticks in `palette.tick`, no vertical
  gridlines.
- Adjacent fills (slices, stacked segments, tiles) are parted by a **2px gap in the surface colour**, never a
  drawn border.
- Text on a coloured block is near-black on light hues and white on dark ones, picked by luminance (`inkOn`).

**Hover and accessibility**
- Every chart has a hover layer. Hovering an item fades the others to 30% and highlights its row in the list
  next to it, and the same works from the list.
- The hit target is larger than the mark.
- Every chart has an accessible name that reads out the whole split.
- Two or more series always come with a legend or labelled list, so colour is never the only cue.

### Allocation chart (`AllocationChart.jsx`)

The Overview's allocation card has six styles, chosen with an icon switch and remembered on the device
(`localStorage` key `vesta-allocation-style`, default `pie`):

| Style | Encoding |
|---|---|
| Pie | Angle by share, 2px surface gaps between slices |
| Waffle | 10×10 squares, 1 per percent; leftover squares go to the largest remainders so it totals 100 |
| Treemap | Tiles sized by share, biggest first, the longer side cut at each split; name and % inside tiles big enough |
| Ranked bars | One bar per asset, largest first, scaled to the largest, name and % above |
| Segmented bar | One 28px bar, 2px gaps, % printed inside blocks of 12% or more |
| Rose | Equal angles, radius by √share (so **area** matches share), faint rings at half and full scale |

The **donut is not used.**

---

## 8. Theme

- `index.html` sets `data-theme` before first paint, from the saved choice or the OS.
- The app follows the OS until the person toggles. Choosing the theme the OS already uses clears the saved
  choice and returns to following the OS (`localStorage` key `vesta-theme`).
- `body` cross-fades `background` and `color` over 0.2s.
- Every new colour needs a value in **both** themes. Dark values are chosen for the dark surface, not
  inverted.

---

## 9. Privacy (hide amounts)

- One switch (sidebar, menu bar) hides every rupee figure. It is remembered on the device
  (`vesta-hide-amounts`).
- `PrivacyMask` watches the rendered text and replaces anything matching `₹…` (including `L`, `Cr`, `K`) with
  `₹****`, including chart axes. Percentages and quantities stay visible.
- Masked text uses `.amount-mask`: Geist asterisks, semibold, scaled 1.3× and lowered to sit level with the
  figures.
- `BigAmount` masks the headline balance itself.
- **To be covered, a new figure only needs the `₹…` text format.** Don't build separate hidden states.

---

## 10. Motion and accessibility

- Transitions are short and functional: colours and shadows 0.15s, opacity fades 0.15s, the drawer slides in
  over 0.2s. Nothing bounces.
- `prefers-reduced-motion` turns off the drawer animation.
- Focus: `:focus-visible` gets a 2px `link` outline with a 2px offset. Never remove it.
- Toggles use `aria-pressed`, tabs use `aria-current="page"`, and icon-only buttons have `aria-label` (and a
  `title` where hovering helps).
- The landing page starts with a skip link. The navigation drawer is a modal dialog, and focus moves into
  it when it opens.
- Text contrast: body and muted roles pass on their surfaces in both themes.

---

## 11. Landing page (`Landing.jsx`)

It uses the same tokens, components and theme switch as the app, plus a few marketing-only allowances:
- 100px `.pill-round` buttons.
- A soft mesh-gradient glow, **only in the hero**.
- A larger display heading (40 → 64px, tracking −0.05em).
- Mock UI cards built from the app's real components (`BigAmount` with `masked`, `.card`, `.asset-plate`).

**Try the demo** sits beside every "Open your portfolio": a secondary pill in the top bar, the phone menu and the
hero (with a muted line under it: a made-up portfolio at live prices, no code needed), an outlined white pill in
the closing band, and a "Live demo" link in the footer. It is a plain link to `/demo` (a full page load, since
the demo is its own app instance).

When the app's look changes, update the landing page in the same change.

---

## 12. Checklist for new UI

- [ ] Colours come from role classes, and both themes look right.
- [ ] Figures use `.num` in columns, or `BigAmount` for the headline, and amounts are written as `₹…`.
- [ ] Labels use `.eyebrow` or mono meta. Headings are 600 with negative tracking.
- [ ] Main-column layouts use `@container` variants, not viewport breakpoints.
- [ ] The view sits in `ScrollPane`/`PANE`, and section headings use `.pin-head` with `pb-3`.
- [ ] Table column heads use `.pin-cols` with `usePinCols()`, the card doesn't clip, and the rows clip
      themselves. Scrolled to a section's end, heading + column head + last row sit as one closed card.
- [ ] Card top, left and right edges are visible at rest, while scrolling and under pinned layers, on phone,
      tablet and laptop.
- [ ] Charts use `chartPalette`, keep asset colours fixed, and have hover, a legend or list, and an
      accessible name.
- [ ] Interactive elements have a focus state and an accessible name.
- [ ] The landing page still matches.

---

## 13. File map

| File | What it holds |
|---|---|
| `client/src/index.css` | Tokens (both themes), `@theme` mapping, `.card`, `.pill`, `.eyebrow`, `.num`, `.pin-head`, `.pin-cols`, `.amount-mask` |
| `client/src/hooks/useTheme.js` | Theme switching, `chartPalette` |
| `client/src/hooks/usePrivacy.js` | Hide amounts, `PrivacyMask` |
| `client/src/components/Navbar.jsx` | Sidebar, menu bar, drawer, `WRAP`, toggles |
| `client/src/components/PortfolioTracker.jsx` | Page head, tabs, `--head-h`, footer |
| `client/src/components/portfolio/ScrollPane.jsx` | `ScrollPane`, `PANE`, `--tb-h`, `usePinCols` |
| `client/src/components/portfolio/FilterBar.jsx` | Search and filter toolbar, count line, clear link |
| `client/src/components/portfolio/Select.jsx` | Single and multi-select dropdown |
| `client/src/components/portfolio/Sort.jsx` | `useSort`, `SortHead` |
| `client/src/components/portfolio/FixedDepositsView.jsx` | Deposits table, holder chips, cycle card |
| `client/src/utils/demo.js` | `IS_DEMO`, `API_ROOT`: the demo switch |
| `client/src/components/portfolio/FundsTable.jsx` | Fund list/grid, `StatusBadge`, `ViewToggle` |
| `client/src/components/portfolio/SummaryPanel.jsx`, `BigAmount.jsx` | The headline balance card |
| `client/src/components/portfolio/ChartTooltip.jsx` | The shared chart tooltip |
| `client/src/components/portfolio/AllocationChart.jsx` | The six allocation chart styles and their switch |
| `client/src/components/Landing.jsx` | The landing page |

> `client/tailwind.config.js` is a leftover from Tailwind v3 (its purple `primary` scale is not loaded). The
> project runs Tailwind v4, which reads its theme from `@theme` in `index.css`. Change tokens there.
