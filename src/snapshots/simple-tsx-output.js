// virtual-entry:virtual:entry
import React from "react";

// local:/app.tsx
import { jsx } from "react/jsx-runtime";
var App = () => /* @__PURE__ */ jsx("div", { className: "p-4 bg-blue-500 text-white", children: "Hello" });
var app_default = App;

// virtual-entry:virtual:entry
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var OriginalDefault = app_default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.css" }),
    OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null
  ] });
};
var virtual_entry_default = WrappedComponent;
export {
  virtual_entry_default as default
};
