export interface BundleSuccessResult {
  success: true
  jsUrl: string
  htmlUrl: string
  files: Record<string, string>
  rawOutputs: Array<{
    path: string
    size: number
    type: 'sourcemap' | 'chunk' | 'entry'
  }>
  warnings: Array<{ code?: string; text: string }>
}

export interface BundleErrorResult {
  success: false
  error: string
  errorText?: string
}

export type BundleResult = BundleSuccessResult | BundleErrorResult
