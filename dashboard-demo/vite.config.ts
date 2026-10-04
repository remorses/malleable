import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import spiceflow from 'spiceflow/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } }),
    spiceflow({
      entry: './src/app.tsx',
      // Generated views import these bare. Spiceflow adds them to the <script type="importmap"> it
      // already injects for react, react-dom and react/jsx-runtime. Each file becomes a chunk of the
      // host bundle, so views share the host copy and builds skip the CDN for them.
      // Keep in sync with EXTERNAL_PACKAGES in src/agent.ts.
      importMap: {
        recharts: './src/import-map/recharts.ts',
        'lucide-react': './src/import-map/lucide-react.ts',
      },
    }),
  ],
})
