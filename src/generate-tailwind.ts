import pathBrowserify from 'path-browserify'
import { compile, Polyfills } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import themeCss from 'tailwindcss/theme.css'
import utilitiesCss from 'tailwindcss/utilities.css'
import preflightCss from 'tailwindcss/preflight.css'
import shadcnThemeCss from './shadcn-theme.css'

const pathPosix = pathBrowserify.posix

// No `layer()` on purpose: layered rules lose to any unlayered CSS on the host page.
const BASE_CSS = `
@import "tailwindcss/preflight.css";
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

const GLUE = /[,;()=]+(?![^\[]*\])/

/**
 * Extracts class candidates from source text. Over-generates on purpose:
 * `build()` ignores everything that is not a utility. Quotes and spaces inside
 * `[...]` stay part of the token, so `before:content-['hi']` survives.
 * TODO: replace with the oxide scanner if it ever runs in workerd. https://github.com/tailwindlabs/tailwindcss/tree/main/crates/oxide
 */
export function scanCandidates(source: string): string[] {
  const out = new Set<string>()
  let token = ''
  let depth = 0
  let quote = ''
  const flush = () => {
    if (token) {
      out.add(token)
      // glued tokens like cn(`a`,`b`)
      for (const part of token.split(GLUE)) if (part) out.add(part)
    }
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
    } else if (/[\s"'`{}]/.test(ch)) {
      flush()
    } else {
      if (ch === '[') depth = 1
      token += ch
    }
  }
  flush()
  return [...out]
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
    return compiler.build(scanCandidates(code))
  } catch (error: any) {
    console.error('Failed to generate Tailwind CSS:', error)
    throw new Error(`Failed to generate Tailwind CSS: ${error.message}`)
  }
}
