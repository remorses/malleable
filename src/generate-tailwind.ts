import pathBrowserify from 'path-browserify'
import { compile, Polyfills } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import themeCss from 'tailwindcss/theme.css'
import utilitiesCss from 'tailwindcss/utilities.css'
import preflightCss from 'tailwindcss/preflight.css'
import shadcnThemeCss from './shadcn-theme.css'

const pathPosix = pathBrowserify.posix

// Theme and utilities have no `layer()` on purpose: layered rules lose to any unlayered CSS on the host page.
// Preflight is layered: an unlayered reset (`* { padding: 0 }`) would beat the host's own layered utilities.
const BASE_CSS = `
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/theme.css";
@import "tailwindcss/utilities.css";
${shadcnThemeCss}
`

// Workers have no fs, so stylesheets are bundled as text. Only these ids are importable from user CSS. `tailwindcss` is already in BASE_CSS, so it maps to nothing.
const STYLESHEETS: Record<string, string> = {
  tailwindcss: '',
  'tailwindcss/preflight.css': preflightCss,
  'tailwindcss/theme.css': themeCss,
  'tailwindcss/utilities.css': utilitiesCss,
}

const DELIMITERS = /[\s"'`{}]+/
// glued tokens like cn(`a`,`b`); no lookahead, so it stays linear
const GLUE = /[,;()=]+/

/**
 * Extracts class candidates from source text. Over-generates on purpose:
 * `build()` ignores everything that is not a utility.
 * Pass 1 splits on plain delimiters, so classes survive any surrounding code (arrays, regexes, comments).
 * Pass 2 keeps quotes and spaces inside `[...]` in one token, so `before:content-['hi']` survives.
 * TODO: replace with the oxide scanner if it ever runs in workerd. https://github.com/tailwindlabs/tailwindcss/tree/main/crates/oxide
 */
export function scanCandidates(source: string): string[] {
  const out = new Set<string>()
  const add = (token: string) => {
    if (!token) return
    out.add(token)
    for (const part of token.split(GLUE)) if (part) out.add(part)
  }

  for (const token of source.split(DELIMITERS)) add(token)

  let token = ''
  let depth = 0
  let quote = ''
  const flush = () => {
    if (token.includes('[')) add(token)
    token = ''
    depth = 0
    quote = ''
  }
  for (const ch of source) {
    if (ch === '\n') {
      flush()
    } else if (quote) {
      if (ch === quote) quote = ''
      token += ch
    } else if (depth > 0) {
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '[') depth++
      else if (ch === ']') depth--
      else if (/\s/.test(ch)) {
        flush()
        continue
      }
      token += ch
    } else if (DELIMITERS.test(ch)) {
      flush()
    } else {
      if (ch === '[') depth = 1
      token += ch
    }
  }
  flush()
  return [...out]
}

/** Attribute on the element the entry wrapper renders around the component (`entryWrapperSource`) */
export const SCOPE_ATTRIBUTE = 'data-malleable-root'

// Global at-rules: they cannot be scoped and do not select elements
const GLOBAL_AT_RULE = /^@(property|keyframes|font-face|import|charset|layer properties)\b/

/** Top-level statements of a stylesheet: rules, blocks, `;` statements and comments. */
function topLevelStatements(css: string): string[] {
  const out: string[] = []
  let start = 0
  let depth = 0
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      if (depth === 0) {
        out.push(css.slice(start, i + 1))
        start = i + 1
      }
    } else if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch; i++) if (css[i] === '\\') i++
    } else if (ch === '{') {
      depth++
    } else if (ch === '}' || (ch === ';' && depth === 0)) {
      if (ch === '}') depth--
      if (depth === 0) {
        out.push(css.slice(start, i + 1))
        start = i + 1
      }
    }
  }
  out.push(css.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * Wraps the generated CSS in `@scope ([data-malleable-root])`. Generated utilities are unlayered, so
 * without a scope a `.hidden` in a generated sheet beats the host page's own `md:flex` on host elements.
 * Theme variables move from `:root` to the scope root, so they do not override the host theme either.
 */
export function scopeCss(css: string): string {
  const global: string[] = []
  const scoped: string[] = []
  for (const statement of topLevelStatements(css)) {
    if (statement.startsWith('/*') || GLOBAL_AT_RULE.test(statement)) global.push(statement)
    else scoped.push(statement.replace(/(^|[\s,])(?::root|:host)(?=[\s,{])/g, '$1:scope'))
  }
  if (!scoped.length) return global.join('\n')
  return `${global.join('\n')}\n@scope ([${SCOPE_ATTRIBUTE}]) {\n${scoped.join('\n')}\n}\n`
}

export interface TailwindOptions {
  /** Project CSS that may use @apply or @import of other project files */
  userCss?: string
  /** Project stylesheets by absolute path, for `@import` resolution */
  cssFiles?: Map<string, string>
}

/** Compile Tailwind v4 CSS for the classes found in `code`, followed by the project CSS. */
export async function generateTailwindCSS(
  code: string,
  { userCss = '', cssFiles = new Map() }: TailwindOptions = {},
): Promise<string> {
  try {
    const compiler = await compile(`${BASE_CSS}\n${userCss}`, {
      base: '/',
      polyfills: Polyfills.All,
      loadStylesheet: async (id, base) => {
        const builtin = STYLESHEETS[id]
        if (builtin !== undefined) return { path: id, base, content: builtin }
        const path = pathPosix.resolve(base, id)
        const content = cssFiles.get(path)
        if (content === undefined) throw new Error(`Cannot import "${id}" from ${base}`)
        return { path, base: pathPosix.dirname(path), content }
      },
      loadModule: async (id, base) => {
        if (id !== '@tailwindcss/typography') {
          throw new Error(`Plugin or config "${id}" is not supported`)
        }
        return { path: id, base, module: typography }
      },
    })
    return scopeCss(compiler.build(scanCandidates(code)))
  } catch (error: any) {
    console.error('Failed to generate Tailwind CSS:', error)
    throw new Error(`Failed to generate Tailwind CSS: ${error.message}`)
  }
}
