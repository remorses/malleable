import { plugin } from 'bun'
import { createBunHttpImportsPlugin } from './esm-https-plugin.ts'

plugin(createBunHttpImportsPlugin())
