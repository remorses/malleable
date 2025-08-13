var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// local:/button.tsx
import { jsx } from "react/jsx-runtime";
var require_button = __commonJS({
  "local:/button.tsx"() {
  }
});

// virtual-entry:virtual:entry
var virtual_entry_exports = {};
__export(virtual_entry_exports, {
  WithoutShadowRoot: () => WithoutShadowRoot,
  default: () => virtual_entry_default
});
var ActualEntry = __toESM(require_button());
__reExport(virtual_entry_exports, __toESM(require_button()));
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function ScopedIsland({ href, children, className }) {
  const hostRef = useRef(null);
  const [shadow, setShadow] = useState(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (!hostRef.current || shadow) return;
    setShadow(hostRef.current.attachShadow({ mode: "open" }));
  }, [shadow]);
  return /* @__PURE__ */ jsx2("div", { ref: hostRef, className, style: { visibility: ready ? "visible" : "hidden" }, children: shadow && createPortal(
    /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2(
        "link",
        {
          rel: "stylesheet",
          href,
          onLoad: () => setReady(true),
          onError: () => setReady(true)
        }
      ),
      ready ? children : null
    ] }),
    shadow
  ) });
}
var OriginalDefault = ActualEntry.default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ jsx2(ScopedIsland, { href: "https://remote-bundler.fumabase.com/bundle/0e5142c11fa02595.css", className: props.className, children: OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null });
};
var virtual_entry_default = WrappedComponent;
var WithoutShadowRoot = (props) => {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/0e5142c11fa02595.css" }),
    OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null
  ] });
};
export {
  WithoutShadowRoot,
  virtual_entry_default as default
};
