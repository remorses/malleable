// virtual-entry:virtual:entry
import React from 'react'

// local:/button.tsx
import { jsx } from 'react/jsx-runtime'
var Button = () =>
  /* @__PURE__ */ jsx('button', {
    className: 'xxx p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6',
    children: 'Click',
  })
var button_default = Button

// virtual-entry:virtual:entry
import { Fragment, jsx as jsx2, jsxs } from 'react/jsx-runtime'
var OriginalDefault = button_default
var WrappedComponent = (props) => {
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [
      /* @__PURE__ */ jsx2('link', {
        rel: 'stylesheet',
        href: 'https://remote-bundler.fumabase.com/bundle/0560b17ccb7f158e.css',
      }),
      OriginalDefault
        ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props })
        : null,
    ],
  })
}
var virtual_entry_default = WrappedComponent
export { virtual_entry_default as default }
