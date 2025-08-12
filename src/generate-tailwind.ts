import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import typography from '@tailwindcss/typography'

// Export the theme configuration for use in other files
export const shadcnTheme = {
      extend: {
        colors: {
          border: "hsl(var(--border, 214.3 31.8% 91.4%))",
          input: "hsl(var(--input, 214.3 31.8% 91.4%))",
          ring: "hsl(var(--ring, 222.2 84% 4.9%))",
          background: "hsl(var(--background, 0 0% 100%))",
          foreground: "hsl(var(--foreground, 222.2 84% 4.9%))",
          primary: {
            DEFAULT: "hsl(var(--primary, 222.2 47.4% 11.2%))",
            foreground: "hsl(var(--primary-foreground, 210 40% 98%))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary, 210 40% 96.1%))",
            foreground: "hsl(var(--secondary-foreground, 222.2 47.4% 11.2%))",
          },
          destructive: {
            DEFAULT: "hsl(var(--destructive, 0 84.2% 60.2%))",
            foreground: "hsl(var(--destructive-foreground, 210 40% 98%))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted, 210 40% 96.1%))",
            foreground: "hsl(var(--muted-foreground, 215.4 16.3% 46.9%))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent, 210 40% 96.1%))",
            foreground: "hsl(var(--accent-foreground, 222.2 47.4% 11.2%))",
          },
          popover: {
            DEFAULT: "hsl(var(--popover, 0 0% 100%))",
            foreground: "hsl(var(--popover-foreground, 222.2 84% 4.9%))",
          },
          card: {
            DEFAULT: "hsl(var(--card, 0 0% 100%))",
            foreground: "hsl(var(--card-foreground, 222.2 84% 4.9%))",
          },
        },
        borderRadius: {
          lg: "var(--radius, 0.5rem)",
          md: "calc(var(--radius, 0.5rem) - 2px)",
          sm: "calc(var(--radius, 0.5rem) - 4px)",
        },
        keyframes: {
          "accordion-down": {
            from: { height: "0" },
            to: { height: "var(--radix-accordion-content-height)" },
          },
          "accordion-up": {
            from: { height: "var(--radix-accordion-content-height)" },
            to: { height: "0" },
          },
        },
        animation: {
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
        },
      },
}

// Create a PostCSS processor with Tailwind CSS
function createTailwindProcessor(content: string | Array<{ raw: string; extension: string }> = []) {
  const contentConfig = typeof content === 'string'
    ? [{ raw: content, extension: 'tsx' }]
    : content

  return postcss([
    tailwindcss({
      content: contentConfig,
      corePlugins: {
        preflight: false, // Disable preflight to avoid file system access
      },
      theme: shadcnTheme,
      plugins: [typography],
    }),
    autoprefixer({ remove: false }),
  ])
}

// Process CSS with PostCSS and optional plugins
export async function processCSSWithPostCSS(
  css: string,
  plugins: any[] = []
): Promise<string> {
  try {
    const result = await postcss([
      ...plugins,
      autoprefixer({ remove: false })
    ]).process(css, { from: undefined })

    return result.css
  } catch (error: any) {
    console.error('Failed to process CSS with PostCSS:', error)
    throw new Error(`Failed to process CSS: ${error.message}`)
  }
}

export async function generateTailwindCSS(content: string): Promise<string> {
  try {
    // Build Tailwind CSS using PostCSS
    const processor = createTailwindProcessor(content)
    const result = await processor.process(
      '@tailwind base; @tailwind components; @tailwind utilities;',
      { from: undefined }
    )

    return result.css
  } catch (error: any) {
    console.error('Failed to generate Tailwind CSS:', error)
    throw new Error(`Failed to generate Tailwind CSS: ${error.message}`)
  }
}

// Process CSS file content with Tailwind CSS
export async function processCSSFileWithTailwind(cssContent: string, jsContent: string = ''): Promise<string> {
  try {
    // Process the CSS file with Tailwind, using JS content for class extraction
    const processor = createTailwindProcessor(jsContent || '')
    const result = await processor.process(cssContent, { from: undefined })

    return result.css
  } catch (error: any) {
    console.error('Failed to process CSS file with Tailwind:', error)
    throw new Error(`Failed to process CSS file: ${error.message}`)
  }
}
