import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'

export async function generateTailwindCSS(content: string): Promise<string> {
  try {
    // Build Tailwind CSS using PostCSS
    // Let Tailwind's built-in scanner extract the classes
    const result = await postcss([
      tailwindcss({
        content: [{ raw: content, extension: 'tsx' }], // Use tsx extension for better extraction
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