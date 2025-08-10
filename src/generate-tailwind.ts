import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'

export async function generateTailwindCSS(content: string): Promise<string> {
  // Extract class names from the content
  const classNames = extractClassNames(content)
  
  if (classNames.length === 0) {
    return '/* No Tailwind classes found */'
  }
  
  try {
    // Build Tailwind CSS using PostCSS with minimal config
    const result = await postcss([
      tailwindcss({
        content: [{ raw: content, extension: 'html' }],
        safelist: classNames,
        corePlugins: {
          preflight: false, // Disable preflight to avoid file system access
        },
        theme: {}, // Use default theme
      }),
      autoprefixer({ remove: false }),
    ]).process(
      '@tailwind utilities;', // Only process utilities, not base/components
      { from: undefined }
    )
    
    return result.css
  } catch (error: any) {
    console.error('Failed to generate Tailwind CSS:', error)
    throw new Error(`Failed to generate Tailwind CSS: ${error.message}`)
  }
}

function extractClassNames(content: string): string[] {
  const classNameSet = new Set<string>()
  
  // Match className, class attributes in JSX/HTML
  const classRegex = /(?:className|class)\s*=\s*["'`]([^"'`]+)["'`]/g
  let match
  
  while ((match = classRegex.exec(content)) !== null) {
    const classes = match[1].split(/\s+/).filter(Boolean)
    classes.forEach(c => classNameSet.add(c))
  }
  
  // Also match template literals with dynamic classes
  const templateRegex = /(?:className|class)\s*=\s*\{[`"]([^`"]+)[`"]\}/g
  while ((match = templateRegex.exec(content)) !== null) {
    const classes = match[1].split(/\s+/).filter(Boolean)
    classes.forEach(c => classNameSet.add(c))
  }
  
  return Array.from(classNameSet)
}