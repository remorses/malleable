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
        siteId: 'test-css-import',
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
        "test-css-import/index.css": "https://remote-bundler.fumabase.com/bundle/test-css-import/index.css",
        "test-css-import/index.js": "https://remote-bundler.fumabase.com/bundle/test-css-import/index.js",
      },
      "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-css-import/index.html",
      "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-css-import/index.js",
      "rawOutputs": [
        {
          "path": "/test-css-import/index.js",
          "size": 818,
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
    "/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
    @layer properties;
    *, ::after, ::before, ::backdrop, ::file-selector-button {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: 0 solid;
    }
    html, :host {
      line-height: 1.5;
      -webkit-text-size-adjust: 100%;
      tab-size: 4;
      font-family: var(--default-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji');
      font-feature-settings: var(--default-font-feature-settings, normal);
      font-variation-settings: var(--default-font-variation-settings, normal);
      -webkit-tap-highlight-color: transparent;
    }
    hr {
      height: 0;
      color: inherit;
      border-top-width: 1px;
    }
    abbr:where([title]) {
      -webkit-text-decoration: underline dotted;
      text-decoration: underline dotted;
    }
    h1, h2, h3, h4, h5, h6 {
      font-size: inherit;
      font-weight: inherit;
    }
    a {
      color: inherit;
      -webkit-text-decoration: inherit;
      text-decoration: inherit;
    }
    b, strong {
      font-weight: bolder;
    }
    code, kbd, samp, pre {
      font-family: var(--default-mono-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
      font-feature-settings: var(--default-mono-font-feature-settings, normal);
      font-variation-settings: var(--default-mono-font-variation-settings, normal);
      font-size: 1em;
    }
    small {
      font-size: 80%;
    }
    sub, sup {
      font-size: 75%;
      line-height: 0;
      position: relative;
      vertical-align: baseline;
    }
    sub {
      bottom: -0.25em;
    }
    sup {
      top: -0.5em;
    }
    table {
      text-indent: 0;
      border-color: inherit;
      border-collapse: collapse;
    }
    :-moz-focusring:where(:not(iframe)) {
      outline: auto;
    }
    progress {
      vertical-align: baseline;
    }
    summary {
      display: list-item;
    }
    ol, ul, menu {
      list-style: none;
    }
    img, svg, video, canvas, audio, iframe, embed, object {
      display: block;
      vertical-align: middle;
    }
    img, video {
      max-width: 100%;
      height: auto;
    }
    button, input, select, optgroup, textarea, ::file-selector-button {
      font: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      letter-spacing: inherit;
      color: inherit;
      border-radius: 0;
      background-color: transparent;
      opacity: 1;
    }
    :where(select:is([multiple], [size])) optgroup {
      font-weight: bolder;
    }
    :where(select:is([multiple], [size])) optgroup option {
      padding-inline-start: 20px;
    }
    ::file-selector-button {
      margin-inline-end: 4px;
    }
    ::placeholder {
      opacity: 1;
    }
    @supports (not (-webkit-appearance: -apple-pay-button))  or (contain-intrinsic-size: 1px) {
      ::placeholder {
        color: currentcolor;
        @supports (color: color-mix(in lab, red, red)) {
          color: color-mix(in oklab, currentcolor 50%, transparent);
        }
      }
    }
    textarea {
      resize: vertical;
    }
    ::-webkit-search-decoration {
      -webkit-appearance: none;
    }
    ::-webkit-date-and-time-value {
      min-height: 1lh;
      text-align: inherit;
    }
    ::-webkit-datetime-edit {
      display: inline-flex;
    }
    ::-webkit-datetime-edit-fields-wrapper {
      padding: 0;
    }
    ::-webkit-datetime-edit, ::-webkit-datetime-edit-year-field, ::-webkit-datetime-edit-month-field, ::-webkit-datetime-edit-day-field, ::-webkit-datetime-edit-hour-field, ::-webkit-datetime-edit-minute-field, ::-webkit-datetime-edit-second-field, ::-webkit-datetime-edit-millisecond-field, ::-webkit-datetime-edit-meridiem-field {
      padding-block: 0;
    }
    ::-webkit-calendar-picker-indicator {
      line-height: 1;
    }
    :-moz-ui-invalid {
      box-shadow: none;
    }
    button, input:where([type='button'], [type='reset'], [type='submit']), ::file-selector-button {
      appearance: button;
    }
    ::-webkit-inner-spin-button, ::-webkit-outer-spin-button {
      height: auto;
    }
    [hidden]:where(:not([hidden='until-found'])) {
      display: none !important;
    }
    :root, :host {
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial,
        sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
        monospace;
      --color-blue-500: oklch(62.3% 0.214 259.815);
      --color-blue-600: oklch(54.6% 0.245 262.881);
      --color-blue-700: oklch(48.8% 0.243 264.376);
      --color-gray-700: oklch(37.3% 0.034 259.733);
      --color-white: #fff;
      --spacing: 0.25rem;
      --container-4xl: 56rem;
      --text-4xl: 2.25rem;
      --text-4xl--line-height: calc(2.5 / 2.25);
      --font-weight-bold: 700;
      --default-font-family: var(--font-sans);
      --default-mono-font-family: var(--font-mono);
    }
    .container {
      width: 100%;
      @media (width >= 40rem) {
        max-width: 40rem;
      }
      @media (width >= 48rem) {
        max-width: 48rem;
      }
      @media (width >= 64rem) {
        max-width: 64rem;
      }
      @media (width >= 80rem) {
        max-width: 80rem;
      }
      @media (width >= 96rem) {
        max-width: 96rem;
      }
    }
    .mx-auto {
      margin-inline: auto;
    }
    .mt-4 {
      margin-top: calc(var(--spacing) * 4);
    }
    .max-w-4xl {
      max-width: var(--container-4xl);
    }
    .rounded {
      border-radius: 0.25rem;
    }
    .bg-blue-500 {
      background-color: var(--color-blue-500);
    }
    .px-4 {
      padding-inline: calc(var(--spacing) * 4);
    }
    .py-2 {
      padding-block: calc(var(--spacing) * 2);
    }
    .py-8 {
      padding-block: calc(var(--spacing) * 8);
    }
    .text-4xl {
      font-size: var(--text-4xl);
      line-height: var(--tw-leading, var(--text-4xl--line-height));
    }
    .font-bold {
      --tw-font-weight: var(--font-weight-bold);
      font-weight: var(--font-weight-bold);
    }
    .text-blue-600 {
      color: var(--color-blue-600);
    }
    .text-gray-700 {
      color: var(--color-gray-700);
    }
    .text-white {
      color: var(--color-white);
    }
    @media (hover: hover) {
      .hover\\:bg-blue-700:hover {
        background-color: var(--color-blue-700);
      }
    }
    button:not(:disabled), [role="button"]:not(:disabled) {
      cursor: pointer;
    }
    dialog {
      margin: auto;
    }
    .container {
      margin-inline: auto;
      max-width: var(--container-4xl);
      padding-inline: calc(var(--spacing) * 4);
      padding-block: calc(var(--spacing) * 8);
    }
    .custom-button {
      border-radius: 0.25rem;
      background-color: var(--color-blue-500);
      padding-inline: calc(var(--spacing) * 4);
      padding-block: calc(var(--spacing) * 2);
      --tw-font-weight: var(--font-weight-bold);
      font-weight: var(--font-weight-bold);
      color: var(--color-white);
      &:hover {
        @media (hover: hover) {
          background-color: var(--color-blue-700);
        }
      }
    }
    @property --tw-font-weight {
      syntax: "*";
      inherits: false;
    }
    @layer properties {
      @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {
        *, ::before, ::after, ::backdrop {
          --tw-font-weight: initial;
        }
      }
    }
    "
  `)
})
