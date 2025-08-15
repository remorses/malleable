import { test, expect } from 'vitest'

test('CSS import and processing', async () => {
  const files = [
    {
      path: 'index.tsx',
      content: `
        import React from 'react';
        import './styles.css';
        
        export default function App() {
          return (
            <div className="container">
              <h1 className="text-4xl font-bold text-blue-600">Hello World</h1>
              <p className="mt-4 text-gray-700">This is a test component with CSS import</p>
            </div>
          );
        }
      `,
    },
    {
      path: 'styles.css',
      content: `
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        
        .container {
          @apply mx-auto px-4 py-8 max-w-4xl;
        }
        
        .custom-button {
          @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
        }
      `,
    },
  ]

  const response = await fetch(
    'https://remote-bundler.fumabase.com/api/bundle',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files,
        entryPoint: 'index.tsx',
        externalPackages: ['react'],
      }),
    },
  )

  const result = (await response.json()) as any

  // Verify the full API response with inline snapshot
  expect(result).toMatchInlineSnapshot(`
    {
      "files": {
        "1d406200ac53b27b.css": "https://remote-bundler.fumabase.com/bundle/1d406200ac53b27b.css",
        "1d406200ac53b27b.js": "https://remote-bundler.fumabase.com/bundle/1d406200ac53b27b.js",
      },
      "htmlUrl": "https://remote-bundler.fumabase.com/bundle/1d406200ac53b27b.html",
      "jsUrl": "https://remote-bundler.fumabase.com/bundle/1d406200ac53b27b.js",
      "rawOutputs": [
        {
          "path": "/1d406200ac53b27b.js",
          "size": 994,
          "type": "entry",
        },
        {
          "path": "/1d406200ac53b27b.css",
          "size": 3262,
          "type": "entry",
        },
      ],
      "success": true,
      "warnings": [],
    }
  `)

  // Check that CSS files are generated and fetch the content
  const cssFiles = Object.keys(result.files).filter((f) => f.endsWith('.css'))
  expect(cssFiles.length).toBeGreaterThan(0)

  const cssUrl = result.files[cssFiles[0]]
  const cssResponse = await fetch(cssUrl)
  const cssContent = await cssResponse.text()

  // Verify the CSS content with inline snapshot
  expect(cssContent).toMatchInlineSnapshot(`
    "/* local:/styles.css */
    *,
    ::before,
    ::after {
      --tw-border-spacing-x: 0;
      --tw-border-spacing-y: 0;
      --tw-translate-x: 0;
      --tw-translate-y: 0;
      --tw-rotate: 0;
      --tw-skew-x: 0;
      --tw-skew-y: 0;
      --tw-scale-x: 1;
      --tw-scale-y: 1;
      --tw-pan-x: ;
      --tw-pan-y: ;
      --tw-pinch-zoom: ;
      --tw-scroll-snap-strictness: proximity;
      --tw-gradient-from-position: ;
      --tw-gradient-via-position: ;
      --tw-gradient-to-position: ;
      --tw-ordinal: ;
      --tw-slashed-zero: ;
      --tw-numeric-figure: ;
      --tw-numeric-spacing: ;
      --tw-numeric-fraction: ;
      --tw-ring-inset: ;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-color: rgb(59 130 246 / 0.5);
      --tw-ring-offset-shadow: 0 0 #0000;
      --tw-ring-shadow: 0 0 #0000;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-colored: 0 0 #0000;
      --tw-blur: ;
      --tw-brightness: ;
      --tw-contrast: ;
      --tw-grayscale: ;
      --tw-hue-rotate: ;
      --tw-invert: ;
      --tw-saturate: ;
      --tw-sepia: ;
      --tw-drop-shadow: ;
      --tw-backdrop-blur: ;
      --tw-backdrop-brightness: ;
      --tw-backdrop-contrast: ;
      --tw-backdrop-grayscale: ;
      --tw-backdrop-hue-rotate: ;
      --tw-backdrop-invert: ;
      --tw-backdrop-opacity: ;
      --tw-backdrop-saturate: ;
      --tw-backdrop-sepia: ;
      --tw-contain-size: ;
      --tw-contain-layout: ;
      --tw-contain-paint: ;
      --tw-contain-style: ;
    }
    ::backdrop {
      --tw-border-spacing-x: 0;
      --tw-border-spacing-y: 0;
      --tw-translate-x: 0;
      --tw-translate-y: 0;
      --tw-rotate: 0;
      --tw-skew-x: 0;
      --tw-skew-y: 0;
      --tw-scale-x: 1;
      --tw-scale-y: 1;
      --tw-pan-x: ;
      --tw-pan-y: ;
      --tw-pinch-zoom: ;
      --tw-scroll-snap-strictness: proximity;
      --tw-gradient-from-position: ;
      --tw-gradient-via-position: ;
      --tw-gradient-to-position: ;
      --tw-ordinal: ;
      --tw-slashed-zero: ;
      --tw-numeric-figure: ;
      --tw-numeric-spacing: ;
      --tw-numeric-fraction: ;
      --tw-ring-inset: ;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-color: rgb(59 130 246 / 0.5);
      --tw-ring-offset-shadow: 0 0 #0000;
      --tw-ring-shadow: 0 0 #0000;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-colored: 0 0 #0000;
      --tw-blur: ;
      --tw-brightness: ;
      --tw-contrast: ;
      --tw-grayscale: ;
      --tw-hue-rotate: ;
      --tw-invert: ;
      --tw-saturate: ;
      --tw-sepia: ;
      --tw-drop-shadow: ;
      --tw-backdrop-blur: ;
      --tw-backdrop-brightness: ;
      --tw-backdrop-contrast: ;
      --tw-backdrop-grayscale: ;
      --tw-backdrop-hue-rotate: ;
      --tw-backdrop-invert: ;
      --tw-backdrop-opacity: ;
      --tw-backdrop-saturate: ;
      --tw-backdrop-sepia: ;
      --tw-contain-size: ;
      --tw-contain-layout: ;
      --tw-contain-paint: ;
      --tw-contain-style: ;
    }
    .container {
      margin-left: auto;
      margin-right: auto;
      max-width: 56rem;
      padding-left: 1rem;
      padding-right: 1rem;
      padding-top: 2rem;
      padding-bottom: 2rem;
    }
    .custom-button {
      border-radius: 0.25rem;
      --tw-bg-opacity: 1;
      background-color: rgb(59 130 246 / var(--tw-bg-opacity, 1));
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      padding-left: 1rem;
      padding-right: 1rem;
      font-weight: 700;
      --tw-text-opacity: 1;
      color: rgb(255 255 255 / var(--tw-text-opacity, 1));
    }
    @media (hover: hover) and (pointer: fine) {
      .custom-button:hover {
        --tw-bg-opacity: 1;
        background-color: rgb(29 78 216 / var(--tw-bg-opacity, 1));
      }
    }
    "
  `)
})
