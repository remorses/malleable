// virtual-entry:virtual:entry
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// local:/app.tsx
import { jsx } from "react/jsx-runtime";
var App = () => /* @__PURE__ */ jsx("div", { className: "p-4 bg-blue-500 text-white", children: "Hello" });
var app_default = App;

// virtual-entry:virtual:entry
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
var OriginalDefault = app_default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ jsx2(ScopedIsland, { href: "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.css", className: props.className, children: OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null });
};
var virtual_entry_default = WrappedComponent;
var WithoutShadowRoot = (props) => {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.css" }),
    OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null
  ] });
};
export {
  WithoutShadowRoot,
  virtual_entry_default as default
};
