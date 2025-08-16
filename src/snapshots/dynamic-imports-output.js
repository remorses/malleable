// virtual-entry:virtual:entry
import React2 from "react";

// local:/app.tsx
import { Suspense, lazy, useState, useEffect } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var LazyComponent = lazy(() => import("./chunks/LazyComponent-QWYJ2LE2.js"));
var App = () => {
  const [dynamicModule, setDynamicModule] = useState(null);
  const [showLazy, setShowLazy] = useState(false);
  useEffect(() => {
    import("./chunks/DynamicModule-5NLYDKFO.js").then((module) => {
      setDynamicModule(module);
      console.log("Dynamic module loaded:", module);
    });
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "p-8 bg-gray-100 min-h-screen", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-3xl font-bold mb-6", children: "Code Splitting Demo" }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowLazy(!showLazy),
          className: "px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600",
          children: [
            showLazy ? "Hide" : "Show",
            " Lazy Component"
          ]
        }
      ),
      showLazy && /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("div", { className: "p-4 bg-gray-200", children: "Loading..." }), children: /* @__PURE__ */ jsx(LazyComponent, {}) }),
      dynamicModule && /* @__PURE__ */ jsx("div", { className: "p-4 bg-green-100 rounded", children: /* @__PURE__ */ jsx("p", { children: "Dynamic module loaded successfully!" }) })
    ] })
  ] });
};
async function loadDynamicData() {
  const module = await import("./chunks/DynamicModule-5NLYDKFO.js");
  return module.dynamicData;
}
var app_default = App;

// virtual-entry:virtual:entry
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var OriginalDefault = app_default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/index.css" }),
    OriginalDefault ? /* @__PURE__ */ jsx2(OriginalDefault, { ...props }) : null
  ] });
};
var virtual_entry_default = WrappedComponent;
export {
  App,
  virtual_entry_default as default,
  loadDynamicData
};
