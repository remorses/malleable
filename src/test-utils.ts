import { execSync } from 'child_process'

export async function evaluateBundleWithDeno(jsUrl: string): Promise<string> {
  try {
    const output = execSync(
      `deno eval "import('${jsUrl}').then(m => console.log(JSON.stringify(Object.keys(m))))"`,
      { encoding: 'utf-8' }
    )
    return output.trim()
  } catch (error: any) {
    console.error("Failed to execute bundled code:", error.message)
    throw error
  }
}

export async function evaluateBundleExportsWithDeno(jsUrl: string): Promise<string[]> {
  const output = await evaluateBundleWithDeno(jsUrl)
  return JSON.parse(output)
}