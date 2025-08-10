import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import * as esbuild from 'esbuild-wasm'
import wasm from '../node_modules/esbuild-wasm/esbuild.wasm'
import { generateTailwindCSS } from './generate-tailwind'
import { createEsmShPlugin } from './plugins'
import { createLocalResolverPlugin } from './local-resolver-plugin'

let init = false

const app = new Spiceflow()

// Schema for bundle API
const fileSchema = z.object({
  path: z.string(),
  content: z.string()
})

const bundleSchema = z.object({
  code: z.string().optional(),
  files: z.array(fileSchema).optional(),
  entryPoint: z.string().optional(),
  loader: z.enum(['tsx', 'ts', 'jsx', 'js']).default('tsx'),
  extractCSS: z.boolean().default(true),
  resolveImports: z.boolean().default(false),
  externalPackages: z.array(z.string()).default([])
})

// Bundle API endpoint
app.route({
  method: 'POST',
  path: '/api/bundle',
  request: bundleSchema,
  async handler({ request }) {
    if (!init) {
      await esbuild.initialize({
        wasmModule: wasm,
        worker: false
      })
      init = true
    }

    try {
      const body = await request.json()
      const { 
        code: singleCode,
        files = [],
        entryPoint = 'index.tsx',
        loader = 'tsx', 
        extractCSS = true,
        resolveImports = false,
        externalPackages = []
      } = body

      // Determine input code and whether we have multiple files
      let inputCode: string
      let hasMultipleFiles = false
      
      if (files && files.length > 0) {
        // Multiple files mode
        hasMultipleFiles = true
        const entryFile = files.find(f => f.path === entryPoint)
        if (!entryFile) {
          return Response.json({
            error: `Entry point "${entryPoint}" not found in provided files`,
            success: false
          }, { status: 400 })
        }
        inputCode = entryFile.content
      } else if (singleCode) {
        // Single code mode (backward compatibility)
        inputCode = singleCode
      } else {
        return Response.json({
          error: 'No code or files provided',
          success: false
        }, { status: 400 })
      }

      // Use transform for simple transpilation or build for import resolution
      let code: string
      let warnings: esbuild.Message[] = []
      
      if (resolveImports || hasMultipleFiles) {
        // Use build API with plugins for import resolution
        const plugins: esbuild.Plugin[] = []
        
        // Add local resolver if we have multiple files
        if (hasMultipleFiles) {
          plugins.push(createLocalResolverPlugin({ files }))
        }
        
        // Add esm.sh plugin for npm imports (always needed for JSX runtime)
        plugins.push(createEsmShPlugin({ externalPackages }))
        
        const result = await esbuild.build({
          stdin: hasMultipleFiles ? undefined : {
            contents: inputCode,
            loader: loader as esbuild.Loader,
            resolveDir: '/',
          },
          entryPoints: hasMultipleFiles ? [entryPoint] : undefined,
          bundle: true,
          format: 'esm',
          target: 'es2020',
          platform: 'browser',
          write: false,
          minify: false,
          jsx: 'automatic',
          jsxImportSource: 'https://esm.sh/react',
          plugins,
          absWorkingDir: '/',
        })
        
        code = result.outputFiles?.[0]?.text || ''
        warnings = result.warnings
      } else {
        // Use transform API for simple transpilation
        const result = await esbuild.transform(inputCode, {
          loader: loader as esbuild.Loader,
          target: 'es2020',
          format: 'esm',
          minify: false,
          jsx: 'automatic'
        })
        code = result.code
        warnings = result.warnings
      }

      // Collect all code for CSS extraction
      let allCode = inputCode
      if (hasMultipleFiles) {
        allCode = files.map(f => f.content).join('\n')
      }

      let css = ''
      if (extractCSS) {
        // Generate Tailwind CSS using PostCSS and Tailwind v3
        css = await generateTailwindCSS(allCode)
      }

      return Response.json({
        code,
        css,
        warnings,
        success: true
      })
    } catch (error: any) {
      return Response.json({
        error: error.message,
        success: false
      }, { status: 500 })
    }
  }
})

// Tagged template for HTML syntax highlighting
const html = (strings: TemplateStringsArray, ...values: any[]) => 
  strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

// Home page with form
app.route({
  method: 'GET',
  path: '/',
  handler() {
    const htmlString = html`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote Bundler</title>
</head>
<body>
    <div class="container">
        <h1>🚀 Remote Bundler</h1>
        
        <form id="bundleForm">
            <div class="form-group">
                <label for="code">Code (TypeScript/JSX)</label>
                <textarea id="code" name="code" placeholder="const App = () => <div className='p-4 bg-blue-500'>Hello</div>;">const App = () => <div className="p-4 bg-blue-500 text-white">Hello World</div>;</textarea>
            </div>

            <div class="form-group">
                <label for="loader">File Type</label>
                <select id="loader" name="loader">
                    <option value="tsx" selected>TSX</option>
                    <option value="jsx">JSX</option>
                    <option value="ts">TypeScript</option>
                    <option value="js">JavaScript</option>
                </select>
            </div>

            <div class="checkbox-group">
                <label>
                    <input type="checkbox" id="extractCSS" name="extractCSS" checked>
                    Extract Tailwind CSS
                </label>
                <label>
                    <input type="checkbox" id="resolveImports" name="resolveImports">
                    Resolve npm imports
                </label>
            </div>

            <div class="form-group">
                <div class="file-upload">
                    <input type="file" id="fileInput" accept=".js,.jsx,.ts,.tsx" multiple>
                    <label for="fileInput">📁 Or upload files (.js, .jsx, .ts, .tsx) - supports multiple files!</label>
                </div>
            </div>
            
            <div class="form-group" id="entryPointGroup" style="display: none;">
                <label for="entryPoint">Entry Point (for multiple files)</label>
                <input type="text" id="entryPoint" name="entryPoint" placeholder="index.tsx">
            </div>

            <div class="button-group">
                <button type="submit">Transform Code</button>
            </div>
        </form>

        <div id="output" class="output"></div>
    </div>

    <script>
        const form = document.getElementById('bundleForm');
        const codeTextarea = document.getElementById('code');
        const fileInput = document.getElementById('fileInput');
        const output = document.getElementById('output');
        const entryPointGroup = document.getElementById('entryPointGroup');
        const entryPointInput = document.getElementById('entryPoint');
        
        let uploadedFiles = [];

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                uploadedFiles = [];
                
                // Read all files
                for (const file of files) {
                    const content = await file.text();
                    uploadedFiles.push({
                        path: file.name,
                        content: content
                    });
                }
                
                if (files.length === 1) {
                    // Single file - put in textarea
                    codeTextarea.value = uploadedFiles[0].content;
                    entryPointGroup.style.display = 'none';
                    
                    // Auto-detect loader from file extension
                    const ext = files[0].name.split('.').pop().toLowerCase();
                    const loaderSelect = document.getElementById('loader');
                    if (ext === 'tsx') loaderSelect.value = 'tsx';
                    else if (ext === 'jsx') loaderSelect.value = 'jsx';
                    else if (ext === 'ts') loaderSelect.value = 'ts';
                    else if (ext === 'js') loaderSelect.value = 'js';
                } else {
                    // Multiple files
                    codeTextarea.value = '// Multiple files uploaded:\\n' + files.map(f => '// - ' + f.name).join('\\n');
                    codeTextarea.disabled = true;
                    entryPointGroup.style.display = 'block';
                    
                    // Try to auto-detect entry point
                    const possibleEntries = ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'main.tsx', 'main.ts', 'app.tsx', 'app.ts'];
                    const entryFile = files.find(f => possibleEntries.includes(f.name));
                    if (entryFile) {
                        entryPointInput.value = entryFile.name;
                    } else {
                        entryPointInput.value = files[0].name;
                    }
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const body = {
                loader: formData.get('loader'),
                extractCSS: formData.get('extractCSS') === 'on',
                resolveImports: formData.get('resolveImports') === 'on',
                externalPackages: []
            };
            
            // Check if we have uploaded files
            if (uploadedFiles.length > 1) {
                body.files = uploadedFiles;
                body.entryPoint = formData.get('entryPoint') || uploadedFiles[0].path;
            } else if (uploadedFiles.length === 1) {
                body.code = uploadedFiles[0].content;
            } else {
                body.code = formData.get('code');
            }

            try {
                const response = await fetch('/api/bundle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const result = await response.json();
                
                output.classList.add('show');
                
                if (result.success) {
                    let html = '<h3>✨ Transformed Code</h3>';
                    html += '<pre>' + escapeHtml(result.code) + '</pre>';
                    
                    if (result.css) {
                        html += '<h3>🎨 Generated CSS</h3>';
                        html += '<pre>' + escapeHtml(result.css) + '</pre>';
                    }
                    
                    output.innerHTML = html;
                } else {
                    output.innerHTML = '<div class="error">❌ Error: ' + escapeHtml(result.error) + '</div>';
                }
            } catch (error) {
                output.classList.add('show');
                output.innerHTML = '<div class="error">❌ Error: ' + escapeHtml(error.message) + '</div>';
            }
        });

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    </script>
</body>
</html>`;
    
    return new Response(htmlString, {
      headers: {
        'content-type': 'text/html;charset=UTF-8'
      }
    })
  }
})

export default {
  async fetch(request: Request) {
    return await app.handle(request)
  }
}