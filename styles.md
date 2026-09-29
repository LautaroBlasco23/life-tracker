# Styles — Agent Guide for UI Work

This is the contract for how UI should look across the web frontend
(`frontend/`) and the mobile app (`apps/mobile/`). Read this before creating or
modifying any component, layout, or styling. Humans: same rules apply.

## Platform map

| | Web (`frontend/`) | Mobile (`apps/mobile/`) |
|---|---|---|
| Styling | Tailwind CSS **v4** | NativeWind 4 (Tailwind **v3** preset) |
| UI primitives | shadcn/ui → `frontend/components/ui/` | Hand-rolled → `apps/mobile/components/ui/` |
| Colors defined in | `frontend/app/globals.css` (oklch CSS vars, shadcn convention) | `apps/mobile/tailwind.config.js` (hex, paired light + `dark-*` tokens) |
| Dark mode | `.dark` class + `@custom-variant dark` | `dark:` variants of paired `dark-*` tokens |
| Theme switching | `ThemeContext` (`frontend/contexts/theme-context.tsx`) sets CSS vars from `themeColors` | `ThemeProvider` drives `Appearance.setColorScheme` |
| Icon library | Lucide React | Lucide React |
| `cn()` helper | `@/lib/utils` | `apps/mobile/lib/cn` |

**Single source of truth for the palette:** [`packages/shared/src/lib/theme-colors.ts`](packages/shared/src/lib/theme-colors.ts). Both platforms derive their tokens from it. Never invent a color not present there.

## Color rules

- **Never hardcode colors** (hex, oklch, rgb, named). Use tokens.
- Token names are identical across platforms for `bg-primary`, `bg-danger`, `bg-success`, `bg-warning`, `border-border`, `text-foreground`.
- Platform differences to watch:
  - Web has shadcn extras: `card`, `popover`, `secondary`, `accent`, `destructive`, `ring`, `input`, `sidebar-*`, `chart-1..5`.
  - Mobile's muted text is `text-muted` (mapped from `textMuted`); secondary text on mobile has no separate token — use `text-muted`.
  - Mobile always pairs base + dark token: `bg-surface dark:bg-dark-surface`. Web only needs one class; the `.dark` variant resolves via CSS vars.
- Typography/spacing differentiate muted text from foreground rather than adding new grays or opacity hacks (`opacity-50` is reserved for disabled/loading states).

### Palette (web reference; mobile mirrors it via `theme-colors.ts`)

| Role | Light | Dark |
|---|---|---|
| background | `#ffffff` | `#0d1117` |
| surface / card | `#f6f8fa` | `#161b22` |
| foreground (primary text) | `#1f2328` | `#f0f6fc` |
| muted text | `#57606a` | `#c9d1d9` |
| primary (links, CTAs, progress) | `#0583f2` | `#61dafb` |
| secondary / accent | `#61dafb` / `#79c0ff` | `#79c0ff` / `#a5d6ff` |
| danger | `#cf222e` | `#ff7b72` |
| success | `#1a7f37` | `#56d364` |
| warning | `#9a6700` | `#e3b341` |
| border | `#d0d7de` | `#30363d` |

## Component reuse rules (in priority order)

1. **Web:** use existing shadcn primitives in `frontend/components/ui/` before writing anything. If a needed one isn't there, add it via shadcn (`npx shadcn@latest add <name>`) rather than hand-rolling.
2. **Mobile:** use `apps/mobile/components/ui/` (`button.tsx`, `card.tsx`, `form-field.tsx`, `option-select.tsx`, `segmented-tabs.tsx`). Extend these with variants/props instead of creating parallel components.
3. **Feature-specific components** (`frontend/components/notes`, `frontend/components/ui/card`, `frontend/components/ui/filterModal`, `apps/mobile/components/activity`, `apps/mobile/components/finance`) hold composed, feature-specific pieces. Promote to `ui/` only when genuinely shared across features or platforms.
4. **Business logic, types, i18n** → `packages/shared`. Never duplicate in frontend/mobile.
5. Feature screens live in `frontend/app/<feature>` (App Router) and `apps/mobile/app/<feature>` (expo-router). Keep styling in components, not pages.

## Baseline look

- Cards: rounded (web `rounded-xl`+, mobile `rounded-xl`), 1px border token, surface background, `p-4`. Titles `font-semibold`, body `text-base`.
- Buttons: height `h-11`, `rounded-lg`, `px-4`, medium-weight labels. Variants: default (primary bg), outline (transparent + border), ghost (transparent + primary text), destructive. Disabled/loading → `opacity-50` + disabled state.
- Inputs: bordered with `--input-border` / `border` token, consistent radius with buttons.
- Feedback: success/warning/danger only from palette tokens; danger text on white/destructive bg keeps contrast.
- Ranking of visual surface (web): `background` < `surface/card` < `popover`. In dark mode the surfaces get lighter, never darker.
- Don't introduce new animation libraries; existing stack covers transitions.

## Don'ts

- No hardcoded colors, no inline `style={{ color: ... }}` for themed values.
- No new component libraries (no Radix directly outside shadcn wrappers, no new icon packs).
- No per-platform visual divergence beyond what platform primitives require — tokens must stay in sync with `theme-colors.ts`.
- Don't edit `globals.css` palettes or `apps/mobile/tailwind.config.js` directly for UI changes; change `theme-colors.ts` first, then propagate to both platforms.

## Where themes/tokens are wired (for token changes)

- Web: `frontend/app/globals.css` (shadcn vars + `@theme inline`), `frontend/contexts/theme-context.tsx` (applies `themeColors` to CSS vars at runtime).
- Mobile: `apps/mobile/tailwind.config.js` (duplicates `theme-colors.ts`; keep in sync), `apps/mobile/global.css`.
