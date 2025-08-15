import { plugin } from 'bun'
import { createEsmShPlugin } from './esm-https-plugin.ts'

plugin(
  createEsmShPlugin({
    externalPackages: true,
    resolveNpmPackages: false,
  }) as any,
)
