---
title: Tailwind v3 to v4 upgrade plan
description: Tailwind CSS v4 inside the Worker and ProjectDO (workerd, no fs, no native code). Implemented; this doc records the design, measurements and what changes for generated CSS.
---

# Tailwind v3 to v4

**Status: implemented.** Code: `src/generate-tailwind.ts`, `src/shadcn-theme.css`, `src/build.ts`. Project CSS files are inlined, then compiled together with the base CSS in one `compile()` call. Agents must write v4 class names (see the drift table).

**Verdict:** upgrade. Use `tailwindcss@4.3.3` `compile()` directly in the Worker. Add our own candidate scanner. Skip lightningcss at first.

```
 source files ──▶ scanCandidates() ──┐
                                     ├──▶ compile(baseCss + userCss).build(candidates) ──▶ index.css
 loadStylesheet: theme/utilities/    │        (pure JS, no fs, no native)
 preflight text imports ─────────────┤
 loadModule: static typography ──────┘
```

Everything below marked **(measured)** was run in `/var/folders/8w/wvmrpgms5hngywvs8s99xnmm0000gn/T/opencode/tw4-spike` in Node 24 and in `wrangler dev` (workerd). Marked **(not verified)** was not run.

## 1. Why it works in workerd

| Package | Verdict |
|---|---|
| `tailwindcss` 4.3.3 | **Use.** Zero runtime deps. `compile(css, { loadStylesheet, loadModule }).build(candidates)` is pure JS. `dist/lib.mjs` is 250 KB (63 KB gz). (measured) |
| `@tailwindcss/browser` | Not usable server side. It is an IIFE (282 KB, 74 KB gz) that scans `document` with a MutationObserver. Its `loadModule` throws, so no `@plugin`/typography. But its source is the best template: `packages/@tailwindcss-browser/src/index.ts` shows the `loadStylesheet` mapping. |
| `@tailwindcss/node` | Not usable. Depends on `node:fs`, `jiti`, `enhanced-resolve`, native `lightningcss`. (read from source, not run in workerd) |
| `@tailwindcss/oxide` | Not usable. Native NAPI scanner. A wasm32-wasi build exists, **(not verified)** and not needed. |
| `lightningcss-wasm` 1.33.0 | Works in workerd (measured) but costs a 15.8 MB wasm (3.8 MB gz). Optional. |

### Candidate scanner (replaces oxide)

oxide only extracts candidate strings. `build()` ignores invalid ones, so the scanner can over-generate. Spike scanner (`scan.mjs`, 10 lines):

```ts
export function scanCandidates(source: string): string[] {
  const out = new Set<string>()
  for (const tok of source.split(/[\s"'`{}]+/)) {
    if (!tok) continue
    out.add(tok)
    // glued tokens like cn(`a`,`b`) or foo(bar); keep [...] arbitrary values intact
    for (const part of tok.split(/[,;()=]+(?![^\[]*\])/)) if (part) out.add(part)
  }
  return [...out]
}
```

Verified candidates (measured): `p-4`, `bg-primary`, `bg-primary/50`, `hover:bg-blue-500`, `dark:bg-slate-900`, `md:flex`, `w-[calc(100%-2rem)]`, `bg-[#1da1f2]`, `bg-(--brand)`, `[&>svg]:size-4`, `data-[state=open]:rotate-90`, `grid-cols-[1fr_auto]`, `prose`, `animate-accordion-down`. Do **not** split on `<>` (breaks `[&>svg]:size-4`; the first spike run lost it).

Known gap: classes built by string interpolation (`mt-${n}`) are never detected. Same as v3. Add `@source inline("mt-{1..8}")` to the base CSS if needed.

## 2. Reference repos

GitHub code search for Workers-specific usage returned nothing. Nobody publishes this exact setup. Closest real code:

| Repo | File | Notes |
|---|---|---|
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | `packages/@tailwindcss-browser/src/index.ts`, `packages/tailwindcss/src/index.ts` (`compile`, `Polyfills`) | Official fs-less runtime. |
| [ephraimduncan/shadcn-playground](https://github.com/ephraimduncan/shadcn-playground) (55 stars) | `lib/playground/tailwind-worker.ts` | `compile()` in a web worker, CSS files inlined as text, `loadModule` throws, shadcn `tw-animate-css` in `loadStylesheet`. Same shape as our plan. |
| [SelfMadeSystem/monaco-tailwind](https://github.com/SelfMadeSystem/monaco-tailwind) (8 stars) | `src/tailwind.worker.ts` | `import index from 'tailwindcss/index.css' with { type: 'text' }` for index/preflight/theme/utilities. |
| [BenKhz/tailweb](https://github.com/BenKhz/tailweb) (0 stars) | `packages/tailweb/src/worker.ts` | Off-thread v4 compiler. |

## 3. Packages

| Change | Package | Version |
|---|---|---|
| remove | `tailwindcss` v3, `postcss`, `autoprefixer` | `^3.4.17`, `^8.5.6`, `^10.4.21` |
| add | `tailwindcss` | `4.3.3` |
| keep | `@tailwindcss/typography` | `0.5.20` (peer allows v4; plugin loaded via `loadModule`, measured) |
| optional later | `lightningcss-wasm` | `1.33.0` |

Check first that `postcss` has no other user in the repo (`rg "from 'postcss'" src`).

## 4. Approach comparison

| | (a) `compile()` + own scanner in Worker | (b) browser runtime on client | (c) keep v3 |
|---|---|---|---|
| Worker size added | `lib.mjs` 63 KB gz + 3 CSS files ~57 KB (measured). **Smaller than v3** (no postcss, no autoprefixer/browserslist). | 0 | 0 |
| Client cost | 0 (static `index.css`) | +74 KB gz script, compile on every page load, FOUC, needs DOM | 0 |
| CPU | compile 10-23 ms, build 1-5 ms (measured, workerd). 5000 lines (828 KB): scan 12 ms + build 32 ms (Node) | on the user device | similar to today |
| Cold start | no wasm; module parse only | n/a | same as today |
| Typography / config | works via static `loadModule` | not possible | works |
| Output CSS served as immutable file per sha | yes | **no**, CSS exists only in the live DOM; breaks git `dist/` and `/p/:id/r/:sha/index.css` | yes |
| Risk | scanner misses classes; visual drift from renamed utilities | breaks the product model | v3 gets no new utilities; LLMs now write v4 class names |
| Verdict | **choose** | reject | fallback only |

lightningcss on top of (a), measured:

| | Without | With lightningcss-wasm |
|---|---|---|
| Sample output | 20.3 KB | 16.4 KB minified |
| Worker upload | 0.65 MB raw | +15.8 MB raw, **+3.8 MB gz** (total 3.83 MB gz in spike) |
| Time | 0 | first call 125 ms (wasm init + transform), then 5 ms |
| Gives | native CSS nesting kept (Chrome 112+, Safari 16.5+) | flat selectors, minify, prefixes |

Skip lightningcss: v4 already targets Chrome 111 / Safari 16.4 / Firefox 128, current output is not minified either, and the 3 MB free-plan Worker limit would be passed. Revisit if CSS size matters. Baseline Worker today is 1.5 MB gz (dry-run, includes the in-flight rollup migration).

## 5. Config migration (CSS-first)

`tailwind.config.js` and `postcss.config.js` in the repo root are only for the Vite demo (`content` points at `./demo`). The real config is `shadcnTheme` + options in `src/generate-tailwind.ts`.

| v3 | v4 |
|---|---|
| `darkMode: 'class'` | `@custom-variant dark (&:where(.dark, .dark *));` (output `.dark\:bg-slate-900:where(.dark, .dark *)`, measured) |
| `future.hoverOnlyWhenSupported` | default in v4 (`@media (hover: hover)`), delete |
| `corePlugins.preflight: false` + hand-pasted `TAILWIND_PREFLIGHT` | `@import "tailwindcss/preflight.css";` (delete 390 lines) |
| `plugins: [typography]` | `@plugin "@tailwindcss/typography";` + `loadModule` returns the imported plugin |
| `theme.extend.colors/borderRadius/animation/keyframes` | `@theme inline { ... }` (below) |
| `important` | **not used** in this repo. If wanted: `@import "tailwindcss/utilities.css" important;` (measured, adds `!important`) |
| `prefix` | **do not use.** `prefix(lp)` changes class names to `lp:p-4` and var names (measured). Generated code uses plain classes |
| `content` | scanner (section 1) |

Base CSS (`BASE_CSS` string in `generate-tailwind.ts`). Imports have **no `layer()`** on purpose, see section 6:

```css
@import "tailwindcss/preflight.css";
@import "tailwindcss/theme.css";
@import "tailwindcss/utilities.css";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-border: hsl(var(--border, 214.3 31.8% 91.4%));
  --color-input: hsl(var(--input, 214.3 31.8% 91.4%));
  --color-ring: hsl(var(--ring, 222.2 84% 4.9%));
  --color-background: hsl(var(--background, 0 0% 100%));
  --color-foreground: hsl(var(--foreground, 222.2 84% 4.9%));
  --color-primary: hsl(var(--primary, 222.2 47.4% 11.2%));
  --color-primary-foreground: hsl(var(--primary-foreground, 210 40% 98%));
  /* ...secondary, destructive, muted, accent, popover, card (+ -foreground) */
  --radius-lg: var(--radius, 0.5rem);
  --radius-md: calc(var(--radius, 0.5rem) - 2px);
  --radius-sm: calc(var(--radius, 0.5rem) - 4px);
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  @keyframes accordion-down { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
  @keyframes accordion-up { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
}
```

- **shadcn variables keep working.** `bg-primary` compiles to `background-color: hsl(var(--primary, 222.2 47.4% 11.2%))` (measured). Keep `inline` so utilities reference the `hsl(var(--x))` value directly and the host can set `--primary` at any depth. Without `inline` the value is frozen at `:root`.
- **Bonus:** `bg-primary/50` now works (`color-mix(in oklab, hsl(var(--primary...)) 50%, transparent)`, measured). In v3 it did not with `hsl(var())` colors.
- `theme.css` still emits a `:root, :host` block, but only for variables actually used (v4 tree-shakes unused theme vars, measured).
- Move `shadcnTheme` out as the `@theme` block above. Delete the JS export (only `generate-tailwind.ts` uses it, `rg shadcnTheme` shows no other user).

### Loading the CSS assets in workerd

`tailwindcss/{theme,utilities,preflight}.css` must be strings in the Worker. Spike (measured) used wrangler `rules`:

```jsonc
// wrangler.jsonc
"rules": [{ "type": "Text", "globs": ["**/*.css"], "fallthrough": false }]
```

```ts
import themeCss from 'tailwindcss/theme.css'
import utilitiesCss from 'tailwindcss/utilities.css'
import preflightCss from 'tailwindcss/preflight.css'
const sheets: Record<string, string> = {
  'tailwindcss/theme.css': themeCss,
  'tailwindcss/utilities.css': utilitiesCss,
  'tailwindcss/preflight.css': preflightCss,
}
loadStylesheet: async (id, base) => ({ path: id, base, content: sheets[id] ?? fail(id) })
loadModule: async (id, base) => ({ path: id, base, module: typography })  // only typography allowed
```

Add `declare module '*.css'` to `src/global.d.ts`. **(not verified)** `pnpm test:local` / vitest: needs a Vite plugin that returns CSS as text, like the existing `wasmPlugin` in `vite.config.ts`. Prefer `loadStylesheet` ids mapped explicitly; do not accept arbitrary imports from user CSS (no fetch, no fs).

## 6. What changes in the generated CSS and next to the host page

Generated components render in the host React tree and the CSS is a plain `<link>`. v3 output was fully unlayered; the hand-pasted preflight was global and unlayered.

| Topic | v3 today | v4 | Action |
|---|---|---|---|
| Cascade layers | none | `@import "tailwindcss"` wraps in `@layer theme, base, components, utilities`. **Layered rules lose to any unlayered host CSS** (even `p { margin: 0 }` beats `.mt-4`) | Import the three files **without `layer()`** so utilities stay unlayered (measured: output has no `@layer` for utilities/theme). Only `@layer properties` remains, harmless |
| Preflight | global, unlayered, `*`, `html`, `body`, `h1..` resets | same scope, now from the official file | Unchanged risk. Resets still hit the host page. Scoping needs a wrapper class: **not planned**, same as v3 |
| Theme variables | none global (v3 inlines values) | `:root, :host { --spacing, --color-*, --text-* }` for used vars only | Host that also defines `--spacing` etc. gets overridden. Same values if host is also Tailwind v4 with default theme. **Risk** |
| `@property` | none | `@property --tw-*` registered globally, plus `@layer properties` fallback in `@supports` | Duplicate registrations from a v4 host are identical, fine |
| Browsers | v3: wide | **Safari 16.4+, Chrome 111+, Firefox 128+** (`@property`, `color-mix`, `oklch`). `Polyfills.All` (default in `compile`) already emits the `@property`/color-mix fallbacks | Accept |
| Nesting | flat | `.prose :where(...)`, `&:hover`, `@supports` stay nested (no lightningcss) | OK on target browsers |
| Colors | hex/rgb | `oklch()` for the default palette | Visual drift is small |
| Autoprefixer | `-webkit-` prefixes | none | Dropped, targets are modern |

### Utility drift (affects LLM-written classes already in projects)

| v3 class | v4 behaviour | Effect |
|---|---|---|
| `shadow-sm`, `shadow`, `rounded-sm`, `rounded`, `blur-sm`, `blur` | scale shifted: `shadow-sm` is the old `shadow` | Slightly smaller shadow/radius for `-sm` classes. Bare names still work |
| `ring` | 1px instead of 3px, color `currentColor` | Different focus rings. shadcn uses `ring-2`, `ring-1`, `ring-offset-2`: fine |
| `outline-none` | really `outline-style: none` now (old = `outline-hidden`) | shadcn `focus-visible:outline-none` loses the forced-colors fallback |
| `border` default color | `currentColor` (hand-pasted preflight already used it) | none |
| `bg-opacity-*`, `text-opacity-*`, ... `flex-grow-*`, `overflow-ellipsis` | removed | Class does nothing. Models trained on v3 may emit them |
| `space-y-*`, `divide-*` | new selector `:not(:last-child)` | Differs with inline children |
| `button` cursor | `default` (was `pointer` in hand-pasted preflight) | Add `@layer base { button:not(:disabled), [role=button]:not(:disabled) { cursor: pointer } }` to base CSS. Not done through `@layer` (loses to host); write it unlayered |
| Placeholder color | current color at 50% | none |
| `dialog` margin | reset to 0 | Add `dialog { margin: auto }` if centered dialogs matter |
| `hidden` attribute | no longer overridden by `block`/`flex` | none |
| Variable shorthand `bg-[--x]` | now `bg-(--x)` | Old form silently produces nothing |
| Stacked variants order | left to right | `first:*:pt-0` becomes `*:first:pt-0` |

Add a short "Tailwind v4 classes" note to whatever prompt or docs tell agents how to write components (`docs/projects.md` is the right place), so agents emit v4 names.

## 7. User CSS files (`.css` in the project)

Today `processCSSFileWithTailwind` runs each user CSS file through v3 with empty content, so `@apply` works. `src/css-import.test.ts` uses `@tailwind base; @tailwind components; @tailwind utilities;` plus `@apply mx-auto px-4 ...`.

Measured in v4:

- `@tailwind base;` and `@tailwind components;` are **silently ignored**. `@tailwind utilities;` works.
- `@apply` needs the theme loaded or it throws `Cannot apply unknown utility class`.
- `@import "tailwindcss/theme.css" reference; @import "tailwindcss/utilities.css" reference;` in front of the user CSS makes `@apply` work and emits only the user rules (utilities and theme are not duplicated; vars have fallbacks, e.g. `var(--spacing, 0.25rem)`).

**Plan:** one compile per build, not per CSS file. Input is `BASE_CSS + '\n' + allUserCss`. Candidates come from all code files. The user `@tailwind ...` lines are harmless duplicates (extra `@tailwind utilities` is dropped). This removes the per-file call in `src/rollup-plugins.ts` (`load` hook for `.css`): it should only record the file content and return an empty module; `build.ts` then calls `generateTailwindCSS({ code, userCss })`. User CSS that uses `@import "tailwindcss"` itself would hit the `layer` problem and throw on unknown id: **decision needed**, proposal is to map `tailwindcss` to the unlayered three imports in `loadStylesheet`.

## 8. Files to change

| File | Change |
|---|---|
| `package.json` | deps per section 3. Another session is editing `package.json` for the rollup swap: rebase on it |
| `pnpm-lock.yaml` | via `pnpm install` |
| `src/generate-tailwind.ts` | rewrite to ~80 lines: `BASE_CSS`, `sheets`, `scanCandidates`, `generateTailwindCSS({ code, userCss })`. Delete `shadcnTheme`, `TAILWIND_PREFLIGHT`, `processCSSWithPostCSS`, `createTailwindProcessor`. Cache the `compile()` result per isolate when `userCss` is empty (**not verified** whether `build()` is safe to call many times on one compiler: spike calls it once per compile; the browser runtime calls it repeatedly, so likely safe) |
| `src/build.ts` | call new `generateTailwindCSS`; pass user CSS contents |
| `src/rollup-plugins.ts` (in flight, other session) | stop calling `processCSSFileWithTailwind`; collect CSS text |
| `src/global.d.ts` | `declare module '*.css'` |
| `wrangler.jsonc` | `rules` Text for `**/*.css` |
| `vite.config.ts` | plugin to load `tailwindcss/*.css` as text for vitest local mode (not verified) |
| `tailwind.config.js`, `postcss.config.js`, `demo/tailwind.css` | demo only. Delete config files, switch demo to `@import "tailwindcss"` + `@tailwindcss/vite` (**not verified**), or drop the demo's Tailwind |
| `docs/projects.md` | one line: "Rollup + tailwind v4 run here", add agent class-name note |
| `AGENTS.md` | "Tailwind CSS v3" becomes v4 |

## 9. Tests and snapshots

`pnpm test` runs against the deployed worker, so deploy first.

- `src/css-import.test.ts`: the full CSS inline snapshot (390 preflight lines + utilities) is rewritten. Run `pnpm test` (`-u`) and **review the diff**: expect `@layer properties`, `@property`, `oklch`, `.container { margin-inline: auto ... }`.
- `src/project.test.ts` checks `css.includes('bg-blue-500')` and `bg-red-500`: still true (`.bg-blue-500 {}` selector exists).
- `src/worker.test.ts`: snapshots contain bundle metadata, not CSS (`rawOutputs` sizes). JS snapshots unchanged. No change expected; Server-Timing numbers change.
- **Add one regression test** (single, fast, local, no network) for `scanCandidates` + `generateTailwindCSS` with the 14 candidates in section 1 and the `shadcn`/`dark`/`hover` cases, as an inline snapshot of selectors only. This is the only complex new logic. Needs the vitest CSS-text plugin.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scanner misses a class form | Missing style, silent | Over-generating tokenizer, regression test, `@source inline()` for known dynamic patterns |
| Scanner over-generates | CPU only (5000 lines: 44 ms) | None needed |
| Layered output loses to host CSS | Utilities ignored on host pages | Import without `layer()` (measured) |
| `:root` theme vars clash with host | Wrong spacing/colors in host | Accept; same class of risk as the global preflight |
| Browser support floor | Old browsers unstyled | Accept (spec: Safari 16.4+, Chrome 111+, Firefox 128+) |
| Utility renames | Slight visual drift | Agent prompt note; optional pre-pass **not** planned |
| `build()` reuse on a cached compiler | Cross-request state | Verify before caching; default is compile per build (13 ms) |
| User CSS with v4 `@import "tailwindcss"` | Throws unknown stylesheet | Map to unlayered imports |
| Worker startup CPU in workerd | Not measured under deploy | Measure after `pnpm deployment` with `wrangler deploy` startup time (**not verified**) |
| Conflicts with in-flight rollup migration | Merge pain | Do this after it lands |

## 11. Steps

1. Wait for the rollup migration branch to land (`rollup-plugins.ts`, `package.json`).
2. `pnpm remove postcss autoprefixer tailwindcss && pnpm add tailwindcss@4.3.3`; keep `@tailwindcss/typography` at `0.5.20`.
3. Add `rules` to `wrangler.jsonc`, `declare module '*.css'`, vitest CSS-text plugin.
4. Rewrite `src/generate-tailwind.ts` (section 5, 1). Delete preflight string and `shadcnTheme`.
5. Change `src/build.ts` and the CSS hook in `src/rollup-plugins.ts` (section 7).
6. Add the scanner regression test.
7. `pnpm tsc`, `pnpm deployment`, `pnpm test`; review the snapshot diff in `css-import.test.ts`.
8. Open a project in the browser next to a host page with its own CSS; check utilities win, check shadcn variables, dark mode, `prose`.
9. Update demo, `AGENTS.md`, `docs/projects.md`.
10. Optional later: `lightningcss-wasm` (section 4) if CSS size or nesting matters.
