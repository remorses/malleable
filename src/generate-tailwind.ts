import { compile, Polyfills } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import themeCss from 'tailwindcss/theme.css'
import utilitiesCss from 'tailwindcss/utilities.css'
import preflightCss from 'tailwindcss/preflight.css'
import shadcnThemeCss from './shadcn-theme.css'

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

/**
 * Extracts class candidates from source text. Over-generates on purpose:
 * `build()` ignores everything that is not a utility.
 * TODO: replace with the oxide scanner if it ever runs in workerd. https://github.com/tailwindlabs/tailwindcss/tree/main/crates/oxide
 */
export function scanCandidates(source: string): string[] {
  const out = new Set<string>()
  for (const token of source.split(/[\s"'`{}]+/)) {
    if (!token) continue
    out.add(token)
    // glued tokens like cn(`a`,`b`); keep [...] arbitrary values intact
    for (const part of token.split(/[,;()=]+(?![^\[]*\])/)) if (part) out.add(part)
  }
  return [...out]
}

/** Compile Tailwind v4 CSS for the classes found in `code`, followed by `userCss` (may use @apply). */
export async function generateTailwindCSS(
  code: string,
  userCss = '',
): Promise<string> {
  try {
    const compiler = await compile(`${BASE_CSS}\n${userCss}`, {
      base: '/',
      polyfills: Polyfills.All,
      loadStylesheet: async (id, base) => {
        const content = STYLESHEETS[id]
        if (content === undefined) throw new Error(`Cannot import "${id}"`)
        return { path: id, base, content }
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
