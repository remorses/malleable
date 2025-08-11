import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { importMapPlugin } from 'importmap-vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    !process.env.VITEST && importMapPlugin({
      imports: {
        // Map to local modules (these will be bundled)
        'react': './demo/import-map/react',
        'react-dom': './demo/import-map/react-dom',
        'react-dom/client': './demo/import-map/react-dom-client',
        'react/jsx-runtime': './demo/import-map/react-jsx-runtime',
      }
    })
  ],
  server: {
    port: 3000
  }
})
