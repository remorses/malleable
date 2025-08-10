import { describe, it, expect } from "vitest";

const WORKER_URL = "https://remote-bundler.fumabase.com";

describe("Remote Bundler Worker", () => {
  it("should transform TSX code with React and generate Tailwind CSS", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: 'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>;'
        }],
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "var __create = Object.create;
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames = Object.getOwnPropertyNames;
      var __getProtoOf = Object.getPrototypeOf;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
        get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
      }) : x)(function(x) {
        if (typeof require !== "undefined") return require.apply(this, arguments);
        throw Error('Dynamic require of "' + x + '" is not supported');
      });
      var __commonJS = (cb, mod) => function __require2() {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
        mod
      ));

      // esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js
      var require_react_jsx_runtime_development = __commonJS({
        "esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js"(exports) {
          "use strict";
          (function() {
            function getComponentNameFromType(type) {
              if (null == type) return null;
              if ("function" === typeof type)
                return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
              if ("string" === typeof type) return type;
              switch (type) {
                case REACT_FRAGMENT_TYPE:
                  return "Fragment";
                case REACT_PROFILER_TYPE:
                  return "Profiler";
                case REACT_STRICT_MODE_TYPE:
                  return "StrictMode";
                case REACT_SUSPENSE_TYPE:
                  return "Suspense";
                case REACT_SUSPENSE_LIST_TYPE:
                  return "SuspenseList";
                case REACT_ACTIVITY_TYPE:
                  return "Activity";
              }
              if ("object" === typeof type)
                switch ("number" === typeof type.tag && console.error(
                  "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
                ), type.$$typeof) {
                  case REACT_PORTAL_TYPE:
                    return "Portal";
                  case REACT_CONTEXT_TYPE:
                    return (type.displayName || "Context") + ".Provider";
                  case REACT_CONSUMER_TYPE:
                    return (type._context.displayName || "Context") + ".Consumer";
                  case REACT_FORWARD_REF_TYPE:
                    var innerType = type.render;
                    type = type.displayName;
                    type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                    return type;
                  case REACT_MEMO_TYPE:
                    return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
                  case REACT_LAZY_TYPE:
                    innerType = type._payload;
                    type = type._init;
                    try {
                      return getComponentNameFromType(type(innerType));
                    } catch (x) {
                    }
                }
              return null;
            }
            function testStringCoercion(value) {
              return "" + value;
            }
            function checkKeyStringCoercion(value) {
              try {
                testStringCoercion(value);
                var JSCompiler_inline_result = false;
              } catch (e) {
                JSCompiler_inline_result = true;
              }
              if (JSCompiler_inline_result) {
                JSCompiler_inline_result = console;
                var JSCompiler_temp_const = JSCompiler_inline_result.error;
                var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
                JSCompiler_temp_const.call(
                  JSCompiler_inline_result,
                  "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
                  JSCompiler_inline_result$jscomp$0
                );
                return testStringCoercion(value);
              }
            }
            function getTaskName(type) {
              if (type === REACT_FRAGMENT_TYPE) return "<>";
              if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
                return "<...>";
              try {
                var name = getComponentNameFromType(type);
                return name ? "<" + name + ">" : "<...>";
              } catch (x) {
                return "<...>";
              }
            }
            function getOwner() {
              var dispatcher = ReactSharedInternals.A;
              return null === dispatcher ? null : dispatcher.getOwner();
            }
            function UnknownOwner() {
              return Error("react-stack-top-frame");
            }
            function hasValidKey(config) {
              if (hasOwnProperty.call(config, "key")) {
                var getter = Object.getOwnPropertyDescriptor(config, "key").get;
                if (getter && getter.isReactWarning) return false;
              }
              return void 0 !== config.key;
            }
            function defineKeyPropWarningGetter(props, displayName) {
              function warnAboutAccessingKey() {
                specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
                  "%s: \`key\` is not a prop. Trying to access it will result in \`undefined\` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
                  displayName
                ));
              }
              warnAboutAccessingKey.isReactWarning = true;
              Object.defineProperty(props, "key", {
                get: warnAboutAccessingKey,
                configurable: true
              });
            }
            function elementRefGetterWithDeprecationWarning() {
              var componentName = getComponentNameFromType(this.type);
              didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
                "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
              ));
              componentName = this.props.ref;
              return void 0 !== componentName ? componentName : null;
            }
            function ReactElement(type, key, self, source, owner, props, debugStack, debugTask) {
              self = props.ref;
              type = {
                $$typeof: REACT_ELEMENT_TYPE,
                type,
                key,
                props,
                _owner: owner
              };
              null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
                enumerable: false,
                get: elementRefGetterWithDeprecationWarning
              }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
              type._store = {};
              Object.defineProperty(type._store, "validated", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: 0
              });
              Object.defineProperty(type, "_debugInfo", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: null
              });
              Object.defineProperty(type, "_debugStack", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugStack
              });
              Object.defineProperty(type, "_debugTask", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugTask
              });
              Object.freeze && (Object.freeze(type.props), Object.freeze(type));
              return type;
            }
            function jsxDEVImpl(type, config, maybeKey, isStaticChildren, source, self, debugStack, debugTask) {
              var children = config.children;
              if (void 0 !== children)
                if (isStaticChildren)
                  if (isArrayImpl(children)) {
                    for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                      validateChildKeys(children[isStaticChildren]);
                    Object.freeze && Object.freeze(children);
                  } else
                    console.error(
                      "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
                    );
                else validateChildKeys(children);
              if (hasOwnProperty.call(config, "key")) {
                children = getComponentNameFromType(type);
                var keys = Object.keys(config).filter(function(k) {
                  return "key" !== k;
                });
                isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
                didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
                  'A props object containing a "key" prop is being spread into JSX:\\n  let props = %s;\\n  <%s {...props} />\\nReact keys must be passed directly to JSX without using spread:\\n  let props = %s;\\n  <%s key={someKey} {...props} />',
                  isStaticChildren,
                  children,
                  keys,
                  children
                ), didWarnAboutKeySpread[children + isStaticChildren] = true);
              }
              children = null;
              void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
              hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
              if ("key" in config) {
                maybeKey = {};
                for (var propName in config)
                  "key" !== propName && (maybeKey[propName] = config[propName]);
              } else maybeKey = config;
              children && defineKeyPropWarningGetter(
                maybeKey,
                "function" === typeof type ? type.displayName || type.name || "Unknown" : type
              );
              return ReactElement(
                type,
                children,
                self,
                source,
                getOwner(),
                maybeKey,
                debugStack,
                debugTask
              );
            }
            function validateChildKeys(node) {
              "object" === typeof node && null !== node && node.$$typeof === REACT_ELEMENT_TYPE && node._store && (node._store.validated = 1);
            }
            var React = __require("react"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
            Symbol.for("react.provider");
            var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
              return null;
            };
            React = {
              react_stack_bottom_frame: function(callStackForError) {
                return callStackForError();
              }
            };
            var specialPropKeyWarningShown;
            var didWarnAboutElementRef = {};
            var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
              React,
              UnknownOwner
            )();
            var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
            var didWarnAboutKeySpread = {};
            exports.Fragment = REACT_FRAGMENT_TYPE;
            exports.jsx = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                false,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
            exports.jsxs = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                true,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
          })();
        }
      });

      // esm-sh:https://unpkg.com/react/jsx-runtime
      var require_jsx_runtime = __commonJS({
        "esm-sh:https://unpkg.com/react/jsx-runtime"(exports, module) {
          "use strict";
          if (false) {
            module.exports = null;
          } else {
            module.exports = require_react_jsx_runtime_development();
          }
        }
      });

      // local-file:app.tsx
      var import_jsx_runtime = __toESM(require_jsx_runtime());
      /**
       * @license React
       * react-jsx-runtime.development.js
       *
       * Copyright (c) Meta Platforms, Inc. and affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */
      ",
        "css": ".bg-blue-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(59 130 246 / var(--tw-bg-opacity, 1))
      }
      .p-4 {
          padding: 1rem
      }
      .text-white {
          --tw-text-opacity: 1;
          color: rgb(255 255 255 / var(--tw-text-opacity, 1))
      }",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should extract Tailwind classes with hover and responsive modifiers", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "button.tsx",
          content: 'const Button = () => <button className="p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>;'
        }],
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "var __create = Object.create;
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames = Object.getOwnPropertyNames;
      var __getProtoOf = Object.getPrototypeOf;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
        get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
      }) : x)(function(x) {
        if (typeof require !== "undefined") return require.apply(this, arguments);
        throw Error('Dynamic require of "' + x + '" is not supported');
      });
      var __commonJS = (cb, mod) => function __require2() {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
        mod
      ));

      // esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js
      var require_react_jsx_runtime_development = __commonJS({
        "esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js"(exports) {
          "use strict";
          (function() {
            function getComponentNameFromType(type) {
              if (null == type) return null;
              if ("function" === typeof type)
                return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
              if ("string" === typeof type) return type;
              switch (type) {
                case REACT_FRAGMENT_TYPE:
                  return "Fragment";
                case REACT_PROFILER_TYPE:
                  return "Profiler";
                case REACT_STRICT_MODE_TYPE:
                  return "StrictMode";
                case REACT_SUSPENSE_TYPE:
                  return "Suspense";
                case REACT_SUSPENSE_LIST_TYPE:
                  return "SuspenseList";
                case REACT_ACTIVITY_TYPE:
                  return "Activity";
              }
              if ("object" === typeof type)
                switch ("number" === typeof type.tag && console.error(
                  "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
                ), type.$$typeof) {
                  case REACT_PORTAL_TYPE:
                    return "Portal";
                  case REACT_CONTEXT_TYPE:
                    return (type.displayName || "Context") + ".Provider";
                  case REACT_CONSUMER_TYPE:
                    return (type._context.displayName || "Context") + ".Consumer";
                  case REACT_FORWARD_REF_TYPE:
                    var innerType = type.render;
                    type = type.displayName;
                    type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                    return type;
                  case REACT_MEMO_TYPE:
                    return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
                  case REACT_LAZY_TYPE:
                    innerType = type._payload;
                    type = type._init;
                    try {
                      return getComponentNameFromType(type(innerType));
                    } catch (x) {
                    }
                }
              return null;
            }
            function testStringCoercion(value) {
              return "" + value;
            }
            function checkKeyStringCoercion(value) {
              try {
                testStringCoercion(value);
                var JSCompiler_inline_result = false;
              } catch (e) {
                JSCompiler_inline_result = true;
              }
              if (JSCompiler_inline_result) {
                JSCompiler_inline_result = console;
                var JSCompiler_temp_const = JSCompiler_inline_result.error;
                var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
                JSCompiler_temp_const.call(
                  JSCompiler_inline_result,
                  "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
                  JSCompiler_inline_result$jscomp$0
                );
                return testStringCoercion(value);
              }
            }
            function getTaskName(type) {
              if (type === REACT_FRAGMENT_TYPE) return "<>";
              if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
                return "<...>";
              try {
                var name = getComponentNameFromType(type);
                return name ? "<" + name + ">" : "<...>";
              } catch (x) {
                return "<...>";
              }
            }
            function getOwner() {
              var dispatcher = ReactSharedInternals.A;
              return null === dispatcher ? null : dispatcher.getOwner();
            }
            function UnknownOwner() {
              return Error("react-stack-top-frame");
            }
            function hasValidKey(config) {
              if (hasOwnProperty.call(config, "key")) {
                var getter = Object.getOwnPropertyDescriptor(config, "key").get;
                if (getter && getter.isReactWarning) return false;
              }
              return void 0 !== config.key;
            }
            function defineKeyPropWarningGetter(props, displayName) {
              function warnAboutAccessingKey() {
                specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
                  "%s: \`key\` is not a prop. Trying to access it will result in \`undefined\` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
                  displayName
                ));
              }
              warnAboutAccessingKey.isReactWarning = true;
              Object.defineProperty(props, "key", {
                get: warnAboutAccessingKey,
                configurable: true
              });
            }
            function elementRefGetterWithDeprecationWarning() {
              var componentName = getComponentNameFromType(this.type);
              didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
                "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
              ));
              componentName = this.props.ref;
              return void 0 !== componentName ? componentName : null;
            }
            function ReactElement(type, key, self, source, owner, props, debugStack, debugTask) {
              self = props.ref;
              type = {
                $$typeof: REACT_ELEMENT_TYPE,
                type,
                key,
                props,
                _owner: owner
              };
              null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
                enumerable: false,
                get: elementRefGetterWithDeprecationWarning
              }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
              type._store = {};
              Object.defineProperty(type._store, "validated", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: 0
              });
              Object.defineProperty(type, "_debugInfo", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: null
              });
              Object.defineProperty(type, "_debugStack", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugStack
              });
              Object.defineProperty(type, "_debugTask", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugTask
              });
              Object.freeze && (Object.freeze(type.props), Object.freeze(type));
              return type;
            }
            function jsxDEVImpl(type, config, maybeKey, isStaticChildren, source, self, debugStack, debugTask) {
              var children = config.children;
              if (void 0 !== children)
                if (isStaticChildren)
                  if (isArrayImpl(children)) {
                    for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                      validateChildKeys(children[isStaticChildren]);
                    Object.freeze && Object.freeze(children);
                  } else
                    console.error(
                      "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
                    );
                else validateChildKeys(children);
              if (hasOwnProperty.call(config, "key")) {
                children = getComponentNameFromType(type);
                var keys = Object.keys(config).filter(function(k) {
                  return "key" !== k;
                });
                isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
                didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
                  'A props object containing a "key" prop is being spread into JSX:\\n  let props = %s;\\n  <%s {...props} />\\nReact keys must be passed directly to JSX without using spread:\\n  let props = %s;\\n  <%s key={someKey} {...props} />',
                  isStaticChildren,
                  children,
                  keys,
                  children
                ), didWarnAboutKeySpread[children + isStaticChildren] = true);
              }
              children = null;
              void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
              hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
              if ("key" in config) {
                maybeKey = {};
                for (var propName in config)
                  "key" !== propName && (maybeKey[propName] = config[propName]);
              } else maybeKey = config;
              children && defineKeyPropWarningGetter(
                maybeKey,
                "function" === typeof type ? type.displayName || type.name || "Unknown" : type
              );
              return ReactElement(
                type,
                children,
                self,
                source,
                getOwner(),
                maybeKey,
                debugStack,
                debugTask
              );
            }
            function validateChildKeys(node) {
              "object" === typeof node && null !== node && node.$$typeof === REACT_ELEMENT_TYPE && node._store && (node._store.validated = 1);
            }
            var React = __require("react"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
            Symbol.for("react.provider");
            var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
              return null;
            };
            React = {
              react_stack_bottom_frame: function(callStackForError) {
                return callStackForError();
              }
            };
            var specialPropKeyWarningShown;
            var didWarnAboutElementRef = {};
            var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
              React,
              UnknownOwner
            )();
            var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
            var didWarnAboutKeySpread = {};
            exports.Fragment = REACT_FRAGMENT_TYPE;
            exports.jsx = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                false,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
            exports.jsxs = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                true,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
          })();
        }
      });

      // esm-sh:https://unpkg.com/react/jsx-runtime
      var require_jsx_runtime = __commonJS({
        "esm-sh:https://unpkg.com/react/jsx-runtime"(exports, module) {
          "use strict";
          if (false) {
            module.exports = null;
          } else {
            module.exports = require_react_jsx_runtime_development();
          }
        }
      });

      // local-file:button.tsx
      var import_jsx_runtime = __toESM(require_jsx_runtime());
      /**
       * @license React
       * react-jsx-runtime.development.js
       *
       * Copyright (c) Meta Platforms, Inc. and affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */
      ",
        "css": ".bg-blue-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(59 130 246 / var(--tw-bg-opacity, 1))
      }
      .p-4 {
          padding: 1rem
      }
      .text-white {
          --tw-text-opacity: 1;
          color: rgb(255 255 255 / var(--tw-text-opacity, 1))
      }
      .hover\\:bg-blue-600:hover {
          --tw-bg-opacity: 1;
          background-color: rgb(37 99 235 / var(--tw-bg-opacity, 1))
      }
      @media (min-width: 768px) {
          .md\\:p-6 {
              padding: 1.5rem
          }
      }",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle template literals with conditional classes", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "card.tsx",
          content: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }`
        }],
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "var __create = Object.create;
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames = Object.getOwnPropertyNames;
      var __getProtoOf = Object.getPrototypeOf;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
        get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
      }) : x)(function(x) {
        if (typeof require !== "undefined") return require.apply(this, arguments);
        throw Error('Dynamic require of "' + x + '" is not supported');
      });
      var __commonJS = (cb, mod) => function __require2() {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
        mod
      ));

      // esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js
      var require_react_jsx_runtime_development = __commonJS({
        "esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js"(exports) {
          "use strict";
          (function() {
            function getComponentNameFromType(type) {
              if (null == type) return null;
              if ("function" === typeof type)
                return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
              if ("string" === typeof type) return type;
              switch (type) {
                case REACT_FRAGMENT_TYPE:
                  return "Fragment";
                case REACT_PROFILER_TYPE:
                  return "Profiler";
                case REACT_STRICT_MODE_TYPE:
                  return "StrictMode";
                case REACT_SUSPENSE_TYPE:
                  return "Suspense";
                case REACT_SUSPENSE_LIST_TYPE:
                  return "SuspenseList";
                case REACT_ACTIVITY_TYPE:
                  return "Activity";
              }
              if ("object" === typeof type)
                switch ("number" === typeof type.tag && console.error(
                  "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
                ), type.$$typeof) {
                  case REACT_PORTAL_TYPE:
                    return "Portal";
                  case REACT_CONTEXT_TYPE:
                    return (type.displayName || "Context") + ".Provider";
                  case REACT_CONSUMER_TYPE:
                    return (type._context.displayName || "Context") + ".Consumer";
                  case REACT_FORWARD_REF_TYPE:
                    var innerType = type.render;
                    type = type.displayName;
                    type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                    return type;
                  case REACT_MEMO_TYPE:
                    return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
                  case REACT_LAZY_TYPE:
                    innerType = type._payload;
                    type = type._init;
                    try {
                      return getComponentNameFromType(type(innerType));
                    } catch (x) {
                    }
                }
              return null;
            }
            function testStringCoercion(value) {
              return "" + value;
            }
            function checkKeyStringCoercion(value) {
              try {
                testStringCoercion(value);
                var JSCompiler_inline_result = false;
              } catch (e) {
                JSCompiler_inline_result = true;
              }
              if (JSCompiler_inline_result) {
                JSCompiler_inline_result = console;
                var JSCompiler_temp_const = JSCompiler_inline_result.error;
                var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
                JSCompiler_temp_const.call(
                  JSCompiler_inline_result,
                  "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
                  JSCompiler_inline_result$jscomp$0
                );
                return testStringCoercion(value);
              }
            }
            function getTaskName(type) {
              if (type === REACT_FRAGMENT_TYPE) return "<>";
              if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
                return "<...>";
              try {
                var name = getComponentNameFromType(type);
                return name ? "<" + name + ">" : "<...>";
              } catch (x) {
                return "<...>";
              }
            }
            function getOwner() {
              var dispatcher = ReactSharedInternals.A;
              return null === dispatcher ? null : dispatcher.getOwner();
            }
            function UnknownOwner() {
              return Error("react-stack-top-frame");
            }
            function hasValidKey(config) {
              if (hasOwnProperty.call(config, "key")) {
                var getter = Object.getOwnPropertyDescriptor(config, "key").get;
                if (getter && getter.isReactWarning) return false;
              }
              return void 0 !== config.key;
            }
            function defineKeyPropWarningGetter(props, displayName) {
              function warnAboutAccessingKey() {
                specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
                  "%s: \`key\` is not a prop. Trying to access it will result in \`undefined\` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
                  displayName
                ));
              }
              warnAboutAccessingKey.isReactWarning = true;
              Object.defineProperty(props, "key", {
                get: warnAboutAccessingKey,
                configurable: true
              });
            }
            function elementRefGetterWithDeprecationWarning() {
              var componentName = getComponentNameFromType(this.type);
              didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
                "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
              ));
              componentName = this.props.ref;
              return void 0 !== componentName ? componentName : null;
            }
            function ReactElement(type, key, self, source, owner, props, debugStack, debugTask) {
              self = props.ref;
              type = {
                $$typeof: REACT_ELEMENT_TYPE,
                type,
                key,
                props,
                _owner: owner
              };
              null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
                enumerable: false,
                get: elementRefGetterWithDeprecationWarning
              }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
              type._store = {};
              Object.defineProperty(type._store, "validated", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: 0
              });
              Object.defineProperty(type, "_debugInfo", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: null
              });
              Object.defineProperty(type, "_debugStack", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugStack
              });
              Object.defineProperty(type, "_debugTask", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugTask
              });
              Object.freeze && (Object.freeze(type.props), Object.freeze(type));
              return type;
            }
            function jsxDEVImpl(type, config, maybeKey, isStaticChildren, source, self, debugStack, debugTask) {
              var children = config.children;
              if (void 0 !== children)
                if (isStaticChildren)
                  if (isArrayImpl(children)) {
                    for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                      validateChildKeys(children[isStaticChildren]);
                    Object.freeze && Object.freeze(children);
                  } else
                    console.error(
                      "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
                    );
                else validateChildKeys(children);
              if (hasOwnProperty.call(config, "key")) {
                children = getComponentNameFromType(type);
                var keys = Object.keys(config).filter(function(k) {
                  return "key" !== k;
                });
                isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
                didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
                  'A props object containing a "key" prop is being spread into JSX:\\n  let props = %s;\\n  <%s {...props} />\\nReact keys must be passed directly to JSX without using spread:\\n  let props = %s;\\n  <%s key={someKey} {...props} />',
                  isStaticChildren,
                  children,
                  keys,
                  children
                ), didWarnAboutKeySpread[children + isStaticChildren] = true);
              }
              children = null;
              void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
              hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
              if ("key" in config) {
                maybeKey = {};
                for (var propName in config)
                  "key" !== propName && (maybeKey[propName] = config[propName]);
              } else maybeKey = config;
              children && defineKeyPropWarningGetter(
                maybeKey,
                "function" === typeof type ? type.displayName || type.name || "Unknown" : type
              );
              return ReactElement(
                type,
                children,
                self,
                source,
                getOwner(),
                maybeKey,
                debugStack,
                debugTask
              );
            }
            function validateChildKeys(node) {
              "object" === typeof node && null !== node && node.$$typeof === REACT_ELEMENT_TYPE && node._store && (node._store.validated = 1);
            }
            var React = __require("react"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
            Symbol.for("react.provider");
            var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
              return null;
            };
            React = {
              react_stack_bottom_frame: function(callStackForError) {
                return callStackForError();
              }
            };
            var specialPropKeyWarningShown;
            var didWarnAboutElementRef = {};
            var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
              React,
              UnknownOwner
            )();
            var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
            var didWarnAboutKeySpread = {};
            exports.Fragment = REACT_FRAGMENT_TYPE;
            exports.jsx = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                false,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
            exports.jsxs = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                true,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
          })();
        }
      });

      // esm-sh:https://unpkg.com/react/jsx-runtime
      var require_jsx_runtime = __commonJS({
        "esm-sh:https://unpkg.com/react/jsx-runtime"(exports, module) {
          "use strict";
          if (false) {
            module.exports = null;
          } else {
            module.exports = require_react_jsx_runtime_development();
          }
        }
      });

      // local-file:card.tsx
      var import_jsx_runtime = __toESM(require_jsx_runtime());
      /**
       * @license React
       * react-jsx-runtime.development.js
       *
       * Copyright (c) Meta Platforms, Inc. and affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */
      ",
        "css": ".rounded-xl {
          border-radius: 0.75rem
      }
      .bg-gray-200 {
          --tw-bg-opacity: 1;
          background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1))
      }
      .bg-green-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(34 197 94 / var(--tw-bg-opacity, 1))
      }
      .p-6 {
          padding: 1.5rem
      }
      .shadow-lg {
          --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);
          box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)
      }",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it(
    "should resolve npm imports when resolveImports is true",
    async () => {
      const response = await fetch(`${WORKER_URL}/api/bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            path: "app.tsx",
            content: `import { format } from 'date-fns';
        const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;`
          }],
        }),
      });

      const result = (await response.json()) as any;
      expect(result.success).toMatchInlineSnapshot(`true`);
      expect(result.css).toMatchInlineSnapshot(`
      ".text-lg {
          font-size: 1.125rem;
          line-height: 1.75rem
      }
      .font-bold {
          font-weight: 700
      }"
    `);
    },
    { timeout: 30000 },
  );

  it("should handle missing code parameter", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
      }),
    });

    const result = await response.json();
    expect(response.status).toMatchInlineSnapshot(`400`);
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "success": false,
      }
    `);
  });

  it("should handle complex Tailwind utilities including gradients and animations", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "hero.tsx",
          content: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        );`
        }],
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "var __create = Object.create;
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames = Object.getOwnPropertyNames;
      var __getProtoOf = Object.getPrototypeOf;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
        get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
      }) : x)(function(x) {
        if (typeof require !== "undefined") return require.apply(this, arguments);
        throw Error('Dynamic require of "' + x + '" is not supported');
      });
      var __commonJS = (cb, mod) => function __require2() {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
        mod
      ));

      // esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js
      var require_react_jsx_runtime_development = __commonJS({
        "esm-sh:https://unpkg.com/react/cjs/react-jsx-runtime.development.js"(exports) {
          "use strict";
          (function() {
            function getComponentNameFromType(type) {
              if (null == type) return null;
              if ("function" === typeof type)
                return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
              if ("string" === typeof type) return type;
              switch (type) {
                case REACT_FRAGMENT_TYPE:
                  return "Fragment";
                case REACT_PROFILER_TYPE:
                  return "Profiler";
                case REACT_STRICT_MODE_TYPE:
                  return "StrictMode";
                case REACT_SUSPENSE_TYPE:
                  return "Suspense";
                case REACT_SUSPENSE_LIST_TYPE:
                  return "SuspenseList";
                case REACT_ACTIVITY_TYPE:
                  return "Activity";
              }
              if ("object" === typeof type)
                switch ("number" === typeof type.tag && console.error(
                  "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
                ), type.$$typeof) {
                  case REACT_PORTAL_TYPE:
                    return "Portal";
                  case REACT_CONTEXT_TYPE:
                    return (type.displayName || "Context") + ".Provider";
                  case REACT_CONSUMER_TYPE:
                    return (type._context.displayName || "Context") + ".Consumer";
                  case REACT_FORWARD_REF_TYPE:
                    var innerType = type.render;
                    type = type.displayName;
                    type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                    return type;
                  case REACT_MEMO_TYPE:
                    return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
                  case REACT_LAZY_TYPE:
                    innerType = type._payload;
                    type = type._init;
                    try {
                      return getComponentNameFromType(type(innerType));
                    } catch (x) {
                    }
                }
              return null;
            }
            function testStringCoercion(value) {
              return "" + value;
            }
            function checkKeyStringCoercion(value) {
              try {
                testStringCoercion(value);
                var JSCompiler_inline_result = false;
              } catch (e) {
                JSCompiler_inline_result = true;
              }
              if (JSCompiler_inline_result) {
                JSCompiler_inline_result = console;
                var JSCompiler_temp_const = JSCompiler_inline_result.error;
                var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
                JSCompiler_temp_const.call(
                  JSCompiler_inline_result,
                  "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
                  JSCompiler_inline_result$jscomp$0
                );
                return testStringCoercion(value);
              }
            }
            function getTaskName(type) {
              if (type === REACT_FRAGMENT_TYPE) return "<>";
              if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
                return "<...>";
              try {
                var name = getComponentNameFromType(type);
                return name ? "<" + name + ">" : "<...>";
              } catch (x) {
                return "<...>";
              }
            }
            function getOwner() {
              var dispatcher = ReactSharedInternals.A;
              return null === dispatcher ? null : dispatcher.getOwner();
            }
            function UnknownOwner() {
              return Error("react-stack-top-frame");
            }
            function hasValidKey(config) {
              if (hasOwnProperty.call(config, "key")) {
                var getter = Object.getOwnPropertyDescriptor(config, "key").get;
                if (getter && getter.isReactWarning) return false;
              }
              return void 0 !== config.key;
            }
            function defineKeyPropWarningGetter(props, displayName) {
              function warnAboutAccessingKey() {
                specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
                  "%s: \`key\` is not a prop. Trying to access it will result in \`undefined\` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
                  displayName
                ));
              }
              warnAboutAccessingKey.isReactWarning = true;
              Object.defineProperty(props, "key", {
                get: warnAboutAccessingKey,
                configurable: true
              });
            }
            function elementRefGetterWithDeprecationWarning() {
              var componentName = getComponentNameFromType(this.type);
              didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
                "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
              ));
              componentName = this.props.ref;
              return void 0 !== componentName ? componentName : null;
            }
            function ReactElement(type, key, self, source, owner, props, debugStack, debugTask) {
              self = props.ref;
              type = {
                $$typeof: REACT_ELEMENT_TYPE,
                type,
                key,
                props,
                _owner: owner
              };
              null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
                enumerable: false,
                get: elementRefGetterWithDeprecationWarning
              }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
              type._store = {};
              Object.defineProperty(type._store, "validated", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: 0
              });
              Object.defineProperty(type, "_debugInfo", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: null
              });
              Object.defineProperty(type, "_debugStack", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugStack
              });
              Object.defineProperty(type, "_debugTask", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: debugTask
              });
              Object.freeze && (Object.freeze(type.props), Object.freeze(type));
              return type;
            }
            function jsxDEVImpl(type, config, maybeKey, isStaticChildren, source, self, debugStack, debugTask) {
              var children = config.children;
              if (void 0 !== children)
                if (isStaticChildren)
                  if (isArrayImpl(children)) {
                    for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                      validateChildKeys(children[isStaticChildren]);
                    Object.freeze && Object.freeze(children);
                  } else
                    console.error(
                      "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
                    );
                else validateChildKeys(children);
              if (hasOwnProperty.call(config, "key")) {
                children = getComponentNameFromType(type);
                var keys = Object.keys(config).filter(function(k) {
                  return "key" !== k;
                });
                isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
                didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
                  'A props object containing a "key" prop is being spread into JSX:\\n  let props = %s;\\n  <%s {...props} />\\nReact keys must be passed directly to JSX without using spread:\\n  let props = %s;\\n  <%s key={someKey} {...props} />',
                  isStaticChildren,
                  children,
                  keys,
                  children
                ), didWarnAboutKeySpread[children + isStaticChildren] = true);
              }
              children = null;
              void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
              hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
              if ("key" in config) {
                maybeKey = {};
                for (var propName in config)
                  "key" !== propName && (maybeKey[propName] = config[propName]);
              } else maybeKey = config;
              children && defineKeyPropWarningGetter(
                maybeKey,
                "function" === typeof type ? type.displayName || type.name || "Unknown" : type
              );
              return ReactElement(
                type,
                children,
                self,
                source,
                getOwner(),
                maybeKey,
                debugStack,
                debugTask
              );
            }
            function validateChildKeys(node) {
              "object" === typeof node && null !== node && node.$$typeof === REACT_ELEMENT_TYPE && node._store && (node._store.validated = 1);
            }
            var React = __require("react"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
            Symbol.for("react.provider");
            var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
              return null;
            };
            React = {
              react_stack_bottom_frame: function(callStackForError) {
                return callStackForError();
              }
            };
            var specialPropKeyWarningShown;
            var didWarnAboutElementRef = {};
            var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
              React,
              UnknownOwner
            )();
            var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
            var didWarnAboutKeySpread = {};
            exports.Fragment = REACT_FRAGMENT_TYPE;
            exports.jsx = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                false,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
            exports.jsxs = function(type, config, maybeKey, source, self) {
              var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
              return jsxDEVImpl(
                type,
                config,
                maybeKey,
                true,
                source,
                self,
                trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
                trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
              );
            };
          })();
        }
      });

      // esm-sh:https://unpkg.com/react/jsx-runtime
      var require_jsx_runtime = __commonJS({
        "esm-sh:https://unpkg.com/react/jsx-runtime"(exports, module) {
          "use strict";
          if (false) {
            module.exports = null;
          } else {
            module.exports = require_react_jsx_runtime_development();
          }
        }
      });

      // local-file:hero.tsx
      var import_jsx_runtime = __toESM(require_jsx_runtime());
      /**
       * @license React
       * react-jsx-runtime.development.js
       *
       * Copyright (c) Meta Platforms, Inc. and affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */
      ",
        "css": "@keyframes pulse {
          50% {
              opacity: .5
          }
      }
      .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite
      }
      .bg-gradient-to-r {
          background-image: linear-gradient(to right, var(--tw-gradient-stops))
      }
      .from-purple-400 {
          --tw-gradient-from: #c084fc var(--tw-gradient-from-position);
          --tw-gradient-to: rgb(192 132 252 / 0) var(--tw-gradient-to-position);
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)
      }
      .via-pink-500 {
          --tw-gradient-to: rgb(236 72 153 / 0)  var(--tw-gradient-to-position);
          --tw-gradient-stops: var(--tw-gradient-from), #ec4899 var(--tw-gradient-via-position), var(--tw-gradient-to)
      }
      .to-red-500 {
          --tw-gradient-to: #ef4444 var(--tw-gradient-to-position)
      }
      .bg-clip-text {
          -webkit-background-clip: text;
                  background-clip: text
      }
      .text-4xl {
          font-size: 2.25rem;
          line-height: 2.5rem
      }
      .font-bold {
          font-weight: 700
      }
      .text-transparent {
          color: transparent
      }
      .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms
      }
      .duration-300 {
          transition-duration: 300ms
      }",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle OPTIONS request for CORS preflight", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      },
    });

    expect(response.status).toBe(`200`);
    expect(response.headers.get("Access-Control-Allow-Origin")).toMatchInlineSnapshot(`null`);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatchInlineSnapshot(`null`);
    expect(response.headers.get("Access-Control-Allow-Headers")).toMatchInlineSnapshot(`null`);
  });
});
