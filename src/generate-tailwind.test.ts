import { describe, expect, it } from 'vitest'
import { generateTailwindCSS, scanCandidates } from './generate-tailwind.ts'

describe('scanCandidates', () => {
  it('keeps quoted arbitrary values and variants in one token', () => {
    const found = scanCandidates(
      `<div className="before:content-['hello'] p-4 [&_p:not([hidden])]:mt-2" /> cn("a",'b')`,
    )
    expect(found.filter((c) => /^(before|p-4|\[&|a$|b$)/.test(c))).toMatchInlineSnapshot(`
      [
        "before:content-['hello']",
        "p-4",
        "[&_p:not([hidden])]:mt-2",
        "[&_p:not",
        "a",
        "b",
      ]
    `)
  })
})

describe('generateTailwindCSS', () => {
  it('resolves project @import with layers and @apply from nested files', async () => {
    const css = await generateTailwindCSS('<p className="before:content-[\'hi\']" />', {
      userCss: '@import "/styles/a.css";',
      cssFiles: new Map([
        ['/styles/a.css', '@import "./b.css" layer(components);\n.a { @apply p-4 }'],
        ['/styles/b.css', '.b { color: red }'],
      ]),
    })
    expect(css.slice(css.indexOf('@layer components'))).toMatchInlineSnapshot(`
      "@layer components {
        .b {
          color: red;
        }
      }
      .a {
        padding: calc(var(--spacing) * 4);
      }
      @property --tw-content {
        syntax: "*";
        initial-value: "";
        inherits: false;
      }
      @layer properties {
        @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {
          *, ::before, ::after, ::backdrop {
            --tw-content: "";
          }
        }
      }
      "
    `)
  })
})
