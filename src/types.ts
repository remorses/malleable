export interface BundleSuccessResult {
  success: true
  jsUrl: string
  files: Record<string, string>
  rawOutputs: Array<{
    path: string
    size: number
    type: 'sourcemap' | 'chunk' | 'entry'
  }>
  warnings: Array<{
    text: string
    location: any
    notes: any[]
  }>
}

export interface BundleErrorResult {
  success: false
  error: string
}

export type BundleResult = BundleSuccessResult | BundleErrorResult