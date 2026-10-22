# Styles — Agent Guide for UI Work

This is the contract for how UI should look across the web frontend
(`frontend/`), the mobile app (`apps/mobile/`), and the chrome extension
(`chrome-extension/`). The design language is **Warm Minimalism**: warm neutral
backgrounds, sage green as the primary accent, amber reserved for highlights,
subtle borders instead of shadows, and full light/dark support. Read this
before creating or modifying any component, layout, or styling. Humans: same
rules apply.

## Platform map

| | Web (`frontend/`) | Mobile (`apps/mobile/`) |
|---|---|---|
| Styling | Tailwind CSS **v4** | NativeWind 4 (Tailwind **v3** preset) |
| UI primitives | shadcn/ui → `frontend/components/ui/` | Hand-rolled → `apps/mobile/components/ui/` |
| Colors defined in | `frontend/app/globals.css` (hex CSS vars, exact parity with `theme-colors.ts`) | `apps/mobile/tailwind.config.js` (hex, paired light + `dark-*` tokens) |
| Dark mode | `.dark` class + `@custom-variant dark` | `dark:` variants of paired `dark-*` tokens |
| Theme switching | `ThemeContext` (`frontend/contexts/theme-context.tsx`): class toggle, `system`/`light`/`dark` preference in `localStorage('theme')` | `ThemeProvider` drives `Appearance.setColorScheme` (`'unspecified'` = follow OS) |
| Icon library | Lucide React | Lucide React Native |
| `cn()` helper | `@/lib/utils` | `apps/mobile/lib/cn` |

**Single source of truth for the palette:** [`packages/shared/src/lib/theme-colors.ts`](packages/shared/src/lib/theme-colors.ts). Both platforms derive their tokens from it. Never invent a color not present there.

**Automated guards (run on every palette change):**
- `packages/shared/src/lib/theme-colors.test.ts` — token contract + WCAG AA contrast for critical pairs.
- `frontend/app/globals-parity.test.ts` — `globals.css` hex values must exactly match `theme-colors.ts`.

## Color rules

- **Never hardcode colors** (hex, oklch, rgb, named, Tailwind palette classes like `text-green-600`). Use tokens.
- Token names are identical across platforms for `bg-primary`, `bg-secondary`, `bg-danger`, `bg-success`, `bg-warning`, `bg-surface`, `border-border`, `text-foreground`.
- Platform differences to watch:
  - Web has shadcn extras: `card`, `popover`, `muted`, `accent`, `destructive`, `ring`, `input`, `sidebar-*`, `chart-1..5`. `--card`/`--popover`/`--destructive`/`--muted-foreground`/`--ring`/`--sidebar-*` alias the canonical shared tokens — don't give them independent values.
  - Mobile's muted text is `text-muted` (mapped from `textMuted`); the web equivalent is `text-muted-foreground`.
  - Mobile always pairs base + dark token: `bg-surface dark:bg-dark-surface`. Web only needs one class; the `.dark` variant resolves via CSS vars.
  - Mobile dark surfaces are registered as separate `dark-*` colors, so on-fill *ink* also needs its dark twin (e.g. `text-primary-foreground dark:text-dark-primary-foreground`).
- Typography/spacing differentiate muted text from foreground rather than adding new grays or opacity hacks (`opacity-50` is reserved for disabled/loading states).

### Palette (`theme-colors.ts`; web `globals.css` mirrors it exactly)

| Role | Light | Dark |
|---|---|---|
| background | `#F5F2EA` (warm) | `#1C1D19` (warm charcoal, never pure black) |
| surface | `#FFFFFF` | `#262821` |
| surface-elevated | `#FFFFFF` | `#33352C` |
| foreground (primary text) | `#30372F` | `#F2EFE6` |
| muted text | `#6A6C61` | `#AAA99F` |
| primary (sage, CTAs/selected/progress) | `#5C6F55` | `#A5B59A` |
| primary-foreground | `#FFFFFF` | `#1C1D19` |
| secondary (warm amber — highlights) | `#D6A36D` | `#D8B58A` |
| accent (sage-tinted hover/selected surface) | `#E3E7DC` | `#2F332A` |
| danger | `#B54D45` | `#D98878` |
| success | `#477653` | `#8FBF96` |
| warning | `#96642A` | `#D8B58A` |
| border | `#E8E3D8` | `#3A3C33` |
| sticky (sticky-note card) | `#F4E8D4` | `#3E3524` |

### Color usage rules

- Warm neutrals are the default; **sage green is reserved for primary actions, selected states, and progress**.
- **Amber (`secondary`) is a highlight, not a text color on light surfaces** — it fails 3:1 there. Use it as a tinted background (`bg-secondary/10`) with dark ink (`text-foreground`), or use `text-warning` when amber text is needed in both modes.
- Semantic colors (success/warning/danger) are for state and feedback only, and are always paired with an icon or label — never color alone.
- Dark mode is role-adapted, not inverted: accents get lighter, backgrounds get warm charcoal.
- WCAG AA is the floor: 4.5:1 normal text, 3:1 large text/UI components. The contrast test enforces the critical pairs; new pairs go into the test.

## Typography

- **Web:** Geist Sans/Mono (already wired via `--font-sans`/`--font-mono`). Playfair Display is available as `font-brand` for the brand mark / editorial headings only — don't spread it to body text.
- **Mobile:** the system default font.
- Scale: page titles 28–32px w600–700; section titles 18–22px w600; body 14–16px w400; supporting text 12–14px; prominent numerals 28–36px w600.
- **Numerals:** apply `tabular-nums` to prominent values and aligned numeric columns (dashboard stats, timers, tables).

## Page header (web)

Every web page renders exactly one shared `PageHeader`
([`frontend/components/ui/page-header.tsx`](frontend/components/ui/page-header.tsx)):
a full-width bar with `border-b border-border`, the `h1` page title plus a
one-line description on the left, and the page's controls (tabs, filters,
primary action) on the right. It stacks vertically below `md`. Page content
lives in its own container *below* the bar — `max-w-4xl mx-auto p-4 md:p-6`
by default, or full-bleed for tool pages like Notes. Do not hand-roll a
per-page header block; pass `title`, `description`, and the controls as
children.

## Spacing, radius, elevation

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 (Tailwind default steps; prefer 4 and 8 over odd values).
- Radius (web, from `--radius: 0.75rem`): buttons/inputs `rounded-md` (10px), cards `rounded-lg` (12px), `rounded-xl` (16px) for hero surfaces. Mobile mirrors with explicit `rounded-*` classes.
- Borders over shadows: 1px `border-border` on cards/surfaces. Shadows only for genuinely floating elements (popovers, menus, toasts) — **never decorative "inset glow" or colored glows**.
- Standard button height `h-10` web (`h-11` for hero CTAs); mobile touch targets ≥ 44×44.
- Cards only for meaningful groups; avoid nesting cards inside cards. Establish hierarchy with spacing, typography, and surface contrast.

## Component reuse rules (in priority order)

1. **Web:** use existing shadcn primitives in `frontend/components/ui/` before writing anything. If a needed one isn't there, add it via shadcn (`npx shadcn@latest add <name>`) rather than hand-rolling.
2. **Mobile:** use `apps/mobile/components/ui/` (`button.tsx`, `card.tsx`, `form-field.tsx`, `option-select.tsx`, `segmented-tabs.tsx`). Extend these with variants/props instead of creating parallel components.
3. **Feature-specific components** (`frontend/components/notes`, `frontend/components/ui/card`, `frontend/components/ui/filterModal`, `apps/mobile/components/activity`, `apps/mobile/components/finance`) hold composed, feature-specific pieces. Promote to `ui/` only when genuinely shared across features or platforms.
4. **Business logic, types, i18n** → `packages/shared`. Never duplicate in frontend/mobile.
5. Feature screens live in `frontend/app/<feature>` (App Router) and `apps/mobile/app/<feature>` (expo-router). Keep styling in components, not pages.

## Baseline look

- Cards: surface background (web `bg-surface`), 1px `border-border`, `rounded-lg`, `p-4`. Titles `font-semibold`; supporting text `text-muted-foreground`.
- Buttons: default = solid `bg-primary`/`text-primary-foreground`; secondary = `bg-muted`; outline = `bg-surface` + border; ghost; destructive = `bg-danger` semantics. All variants keep hover/active/focus/disabled states and `rounded-md`.
- Charts: use the shadcn `chart.tsx` wrapper (`ChartContainer` + `ChartConfig`) with token colors — never raw hex fills. Semantic data (income/expense) maps to success/danger. Gridlines/axes use `border`/`text-muted`.
- Progress: `bg-primary` fill on a `border`/`muted` track; calm, no aggressive animation.
- Feedback: success/warning/danger only from palette tokens; on-fill text uses `primary-foreground` (never bare `text-white` — it fails AA on dark-mode fills).
- Ranking of visual surface (web): `background` < `surface/card` < `popover/surface-elevated`. In dark mode surfaces get lighter, never darker.
- Don't introduce new animation libraries; existing stack covers transitions. Respect reduced-motion for anything beyond micro-transitions.

## Don'ts

- No hardcoded colors, no inline `style={{ color: ... }}` for themed values.
- No new component libraries (no Radix directly outside shadcn wrappers, no new icon packs).
- No per-platform visual divergence beyond what platform primitives require — tokens must stay in sync with `theme-colors.ts` (web parity is test-enforced).
- No pure black (`#000`) backgrounds, pure white text on dark surfaces, or gradients as decoration.
- Don't edit `globals.css` palettes or `apps/mobile/tailwind.config.js` directly for UI changes; change `theme-colors.ts` first, run the contract tests, then propagate.

## Where themes/tokens are wired (for token changes)

- Shared: `packages/shared/src/lib/theme-colors.ts` (+ `theme-colors.test.ts` contract/AA tests).
- Web: `frontend/app/globals.css` (`:root`/`.dark` hex must match `theme-colors.ts` — `app/globals-parity.test.ts`), `@theme inline` token mapping, `frontend/contexts/theme-context.tsx` (class toggle + `system` preference; no runtime var injection), pre-paint theme script in `app/layout.tsx`.
- Mobile: `apps/mobile/tailwind.config.js` (duplicates `theme-colors.ts`; keep in sync), `apps/mobile/lib/theme-provider.tsx`, `apps/mobile/lib/use-colors.ts` (token palette for non-Tailwind props).
- Chrome extension: light-only `:root` variables in `chrome-extension/popup.html`, mirroring the light palette.
