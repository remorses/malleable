// http-url:https://esm.sh/react@19.1.1/es2022/react.mjs
var x = Object.create;
var C = Object.defineProperty;
var D = Object.getOwnPropertyDescriptor;
var b = Object.getOwnPropertyNames;
var k = Object.getPrototypeOf;
var q = Object.prototype.hasOwnProperty;
var S = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var z = (e, t, n2, r) => {
  if (t && typeof t == "object" || typeof t == "function") for (let u2 of b(t)) !q.call(e, u2) && u2 !== n2 && C(e, u2, { get: () => t[u2], enumerable: !(r = D(t, u2)) || r.enumerable });
  return e;
};
var G = (e, t, n2) => (n2 = e != null ? x(k(e)) : {}, z(t || !e || !e.__esModule ? C(n2, "default", { value: e, enumerable: true }) : n2, e));
var M = S((o) => {
  "use strict";
  var v2 = Symbol.for("react.transitional.element"), K = Symbol.for("react.portal"), W = Symbol.for("react.fragment"), B = Symbol.for("react.strict_mode"), Q = Symbol.for("react.profiler"), V = Symbol.for("react.consumer"), X = Symbol.for("react.context"), Z = Symbol.for("react.forward_ref"), J = Symbol.for("react.suspense"), F = Symbol.for("react.memo"), N = Symbol.for("react.lazy"), A = Symbol.iterator;
  function ee(e) {
    return e === null || typeof e != "object" ? null : (e = A && e[A] || e["@@iterator"], typeof e == "function" ? e : null);
  }
  var j2 = { isMounted: function() {
    return false;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, P = Object.assign, H = {};
  function _(e, t, n2) {
    this.props = e, this.context = t, this.refs = H, this.updater = n2 || j2;
  }
  _.prototype.isReactComponent = {};
  _.prototype.setState = function(e, t) {
    if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, e, t, "setState");
  };
  _.prototype.forceUpdate = function(e) {
    this.updater.enqueueForceUpdate(this, e, "forceUpdate");
  };
  function I() {
  }
  I.prototype = _.prototype;
  function R2(e, t, n2) {
    this.props = e, this.context = t, this.refs = H, this.updater = n2 || j2;
  }
  var m2 = R2.prototype = new I();
  m2.constructor = R2;
  P(m2, _.prototype);
  m2.isPureReactComponent = true;
  var w = Array.isArray, i2 = { H: null, A: null, T: null, S: null, V: null }, $ = Object.prototype.hasOwnProperty;
  function T2(e, t, n2, r, u2, f2) {
    return n2 = f2.ref, { $$typeof: v2, type: e, key: t, ref: n2 !== void 0 ? n2 : null, props: f2 };
  }
  function te(e, t) {
    return T2(e.type, t, void 0, void 0, void 0, e.props);
  }
  function d(e) {
    return typeof e == "object" && e !== null && e.$$typeof === v2;
  }
  function ne(e) {
    var t = { "=": "=0", ":": "=2" };
    return "$" + e.replace(/[=:]/g, function(n2) {
      return t[n2];
    });
  }
  var h = /\/+/g;
  function y(e, t) {
    return typeof e == "object" && e !== null && e.key != null ? ne("" + e.key) : t.toString(36);
  }
  function O() {
  }
  function re(e) {
    switch (e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw e.reason;
      default:
        switch (typeof e.status == "string" ? e.then(O, O) : (e.status = "pending", e.then(function(t) {
          e.status === "pending" && (e.status = "fulfilled", e.value = t);
        }, function(t) {
          e.status === "pending" && (e.status = "rejected", e.reason = t);
        })), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw e.reason;
        }
    }
    throw e;
  }
  function a2(e, t, n2, r, u2) {
    var f2 = typeof e;
    (f2 === "undefined" || f2 === "boolean") && (e = null);
    var s = false;
    if (e === null) s = true;
    else switch (f2) {
      case "bigint":
      case "string":
      case "number":
        s = true;
        break;
      case "object":
        switch (e.$$typeof) {
          case v2:
          case K:
            s = true;
            break;
          case N:
            return s = e._init, a2(s(e._payload), t, n2, r, u2);
        }
    }
    if (s) return u2 = u2(e), s = r === "" ? "." + y(e, 0) : r, w(u2) ? (n2 = "", s != null && (n2 = s.replace(h, "$&/") + "/"), a2(u2, t, n2, "", function(Y) {
      return Y;
    })) : u2 != null && (d(u2) && (u2 = te(u2, n2 + (u2.key == null || e && e.key === u2.key ? "" : ("" + u2.key).replace(h, "$&/") + "/") + s)), t.push(u2)), 1;
    s = 0;
    var p2 = r === "" ? "." : r + ":";
    if (w(e)) for (var c = 0; c < e.length; c++) r = e[c], f2 = p2 + y(r, c), s += a2(r, t, n2, f2, u2);
    else if (c = ee(e), typeof c == "function") for (e = c.call(e), c = 0; !(r = e.next()).done; ) r = r.value, f2 = p2 + y(r, c++), s += a2(r, t, n2, f2, u2);
    else if (f2 === "object") {
      if (typeof e.then == "function") return a2(re(e), t, n2, r, u2);
      throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
    }
    return s;
  }
  function l(e, t, n2) {
    if (e == null) return e;
    var r = [], u2 = 0;
    return a2(e, r, "", "", function(f2) {
      return t.call(n2, f2, u2++);
    }), r;
  }
  function oe(e) {
    if (e._status === -1) {
      var t = e._result;
      t = t(), t.then(function(n2) {
        (e._status === 0 || e._status === -1) && (e._status = 1, e._result = n2);
      }, function(n2) {
        (e._status === 0 || e._status === -1) && (e._status = 2, e._result = n2);
      }), e._status === -1 && (e._status = 0, e._result = t);
    }
    if (e._status === 1) return e._result.default;
    throw e._result;
  }
  var g = typeof reportError == "function" ? reportError : function(e) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var t = new window.ErrorEvent("error", { bubbles: true, cancelable: true, message: typeof e == "object" && e !== null && typeof e.message == "string" ? String(e.message) : String(e), error: e });
      if (!window.dispatchEvent(t)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", e);
      return;
    }
    console.error(e);
  };
  function ue() {
  }
  o.Children = { map: l, forEach: function(e, t, n2) {
    l(e, function() {
      t.apply(this, arguments);
    }, n2);
  }, count: function(e) {
    var t = 0;
    return l(e, function() {
      t++;
    }), t;
  }, toArray: function(e) {
    return l(e, function(t) {
      return t;
    }) || [];
  }, only: function(e) {
    if (!d(e)) throw Error("React.Children.only expected to receive a single React element child.");
    return e;
  } };
  o.Component = _;
  o.Fragment = W;
  o.Profiler = Q;
  o.PureComponent = R2;
  o.StrictMode = B;
  o.Suspense = J;
  o.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i2;
  o.__COMPILER_RUNTIME = { __proto__: null, c: function(e) {
    return i2.H.useMemoCache(e);
  } };
  o.cache = function(e) {
    return function() {
      return e.apply(null, arguments);
    };
  };
  o.cloneElement = function(e, t, n2) {
    if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
    var r = P({}, e.props), u2 = e.key, f2 = void 0;
    if (t != null) for (s in t.ref !== void 0 && (f2 = void 0), t.key !== void 0 && (u2 = "" + t.key), t) !$.call(t, s) || s === "key" || s === "__self" || s === "__source" || s === "ref" && t.ref === void 0 || (r[s] = t[s]);
    var s = arguments.length - 2;
    if (s === 1) r.children = n2;
    else if (1 < s) {
      for (var p2 = Array(s), c = 0; c < s; c++) p2[c] = arguments[c + 2];
      r.children = p2;
    }
    return T2(e.type, u2, void 0, void 0, f2, r);
  };
  o.createContext = function(e) {
    return e = { $$typeof: X, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null }, e.Provider = e, e.Consumer = { $$typeof: V, _context: e }, e;
  };
  o.createElement = function(e, t, n2) {
    var r, u2 = {}, f2 = null;
    if (t != null) for (r in t.key !== void 0 && (f2 = "" + t.key), t) $.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (u2[r] = t[r]);
    var s = arguments.length - 2;
    if (s === 1) u2.children = n2;
    else if (1 < s) {
      for (var p2 = Array(s), c = 0; c < s; c++) p2[c] = arguments[c + 2];
      u2.children = p2;
    }
    if (e && e.defaultProps) for (r in s = e.defaultProps, s) u2[r] === void 0 && (u2[r] = s[r]);
    return T2(e, f2, void 0, void 0, null, u2);
  };
  o.createRef = function() {
    return { current: null };
  };
  o.forwardRef = function(e) {
    return { $$typeof: Z, render: e };
  };
  o.isValidElement = d;
  o.lazy = function(e) {
    return { $$typeof: N, _payload: { _status: -1, _result: e }, _init: oe };
  };
  o.memo = function(e, t) {
    return { $$typeof: F, type: e, compare: t === void 0 ? null : t };
  };
  o.startTransition = function(e) {
    var t = i2.T, n2 = {};
    i2.T = n2;
    try {
      var r = e(), u2 = i2.S;
      u2 !== null && u2(n2, r), typeof r == "object" && r !== null && typeof r.then == "function" && r.then(ue, g);
    } catch (f2) {
      g(f2);
    } finally {
      i2.T = t;
    }
  };
  o.unstable_useCacheRefresh = function() {
    return i2.H.useCacheRefresh();
  };
  o.use = function(e) {
    return i2.H.use(e);
  };
  o.useActionState = function(e, t, n2) {
    return i2.H.useActionState(e, t, n2);
  };
  o.useCallback = function(e, t) {
    return i2.H.useCallback(e, t);
  };
  o.useContext = function(e) {
    return i2.H.useContext(e);
  };
  o.useDebugValue = function() {
  };
  o.useDeferredValue = function(e, t) {
    return i2.H.useDeferredValue(e, t);
  };
  o.useEffect = function(e, t, n2) {
    var r = i2.H;
    if (typeof n2 == "function") throw Error("useEffect CRUD overload is not enabled in this build of React.");
    return r.useEffect(e, t);
  };
  o.useId = function() {
    return i2.H.useId();
  };
  o.useImperativeHandle = function(e, t, n2) {
    return i2.H.useImperativeHandle(e, t, n2);
  };
  o.useInsertionEffect = function(e, t) {
    return i2.H.useInsertionEffect(e, t);
  };
  o.useLayoutEffect = function(e, t) {
    return i2.H.useLayoutEffect(e, t);
  };
  o.useMemo = function(e, t) {
    return i2.H.useMemo(e, t);
  };
  o.useOptimistic = function(e, t) {
    return i2.H.useOptimistic(e, t);
  };
  o.useReducer = function(e, t, n2) {
    return i2.H.useReducer(e, t, n2);
  };
  o.useRef = function(e) {
    return i2.H.useRef(e);
  };
  o.useState = function(e) {
    return i2.H.useState(e);
  };
  o.useSyncExternalStore = function(e, t, n2) {
    return i2.H.useSyncExternalStore(e, t, n2);
  };
  o.useTransition = function() {
    return i2.H.useTransition();
  };
  o.version = "19.1.1";
});
var U = S((fe, L) => {
  "use strict";
  L.exports = M();
});
var E = G(U());
var { Children: ce, Component: pe, Fragment: ae, Profiler: _e, PureComponent: le, StrictMode: Ee, Suspense: ye, __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ve, __COMPILER_RUNTIME: Re, cache: me, cloneElement: Te, createContext: de, createElement: Ce, createRef: Se, forwardRef: Ae, isValidElement: we, lazy: he, memo: Oe, startTransition: ge, unstable_useCacheRefresh: Ne, use: je, useActionState: Pe, useCallback: He, useContext: Ie, useDebugValue: $e, useDeferredValue: Me, useEffect: Le, useId: Ue, useImperativeHandle: Ye, useInsertionEffect: xe, useLayoutEffect: De, useMemo: be, useOptimistic: ke, useReducer: qe, useRef: ze, useState: Ge, useSyncExternalStore: Ke, useTransition: We, version: Be } = E;
var Qe = E.default ?? E;

// http-url:https://esm.sh/react@19.1.1/es2022/jsx-runtime.mjs
var p = Object.create;
var j = Object.defineProperty;
var v = Object.getOwnPropertyDescriptor;
var a = Object.getOwnPropertyNames;
var k2 = Object.getPrototypeOf;
var T = Object.prototype.hasOwnProperty;
var n = (e, r) => () => (r || e((r = { exports: {} }).exports, r), r.exports);
var f = (e, r, t, o) => {
  if (r && typeof r == "object" || typeof r == "function") for (let s of a(r)) !T.call(e, s) && s !== t && j(e, s, { get: () => r[s], enumerable: !(o = v(r, s)) || o.enumerable });
  return e;
};
var m = (e, r, t) => (t = e != null ? p(k2(e)) : {}, f(r || !e || !e.__esModule ? j(t, "default", { value: e, enumerable: true }) : t, e));
var E2 = n((l) => {
  "use strict";
  var _ = Symbol.for("react.transitional.element"), c = Symbol.for("react.fragment");
  function x2(e, r, t) {
    var o = null;
    if (t !== void 0 && (o = "" + t), r.key !== void 0 && (o = "" + r.key), "key" in r) {
      t = {};
      for (var s in r) s !== "key" && (t[s] = r[s]);
    } else t = r;
    return r = t.ref, { $$typeof: _, type: e, key: o, ref: r !== void 0 ? r : null, props: t };
  }
  l.Fragment = c;
  l.jsx = x2;
  l.jsxs = x2;
});
var i = n((P, d) => {
  "use strict";
  d.exports = E2();
});
var u = m(i());
var { Fragment: R, jsx: q2, jsxs: C2 } = u;
var M2 = u.default ?? u;

// local:/components/Button.tsx
var Button = ({ children, onClick, variant = "primary" }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-colors";
  const variantClasses = variant === "primary" ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300";
  return /* @__PURE__ */ q2(
    "button",
    {
      className: `${baseClasses} ${variantClasses}`,
      onClick,
      children
    }
  );
};

// local:/utils.ts
var formatPrice = (price) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
};
var truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};

// local:/app.tsx
var App = () => {
  const price = 99.99;
  const description = "This is a very long product description that needs to be truncated";
  return /* @__PURE__ */ q2("div", { className: "p-8 bg-gray-100 min-h-screen", children: /* @__PURE__ */ C2("div", { className: "max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6", children: [
    /* @__PURE__ */ q2("h1", { className: "text-3xl font-bold mb-4", children: "Product Card" }),
    /* @__PURE__ */ q2("p", { className: "text-gray-600 mb-2", children: truncateText(description, 30) }),
    /* @__PURE__ */ q2("p", { className: "text-2xl font-semibold text-green-600 mb-4", children: formatPrice(price) }),
    /* @__PURE__ */ C2("div", { className: "flex gap-4", children: [
      /* @__PURE__ */ q2(Button, { variant: "primary", children: "Buy Now" }),
      /* @__PURE__ */ q2(Button, { variant: "secondary", children: "Add to Cart" })
    ] })
  ] }) });
};
var app_default = App;

// virtual-entry:virtual:entry
var OriginalDefault = app_default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ C2(R, { children: [
    /* @__PURE__ */ q2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/test-n0bjfi/index.css" }),
    OriginalDefault ? /* @__PURE__ */ q2(OriginalDefault, { ...props }) : null
  ] });
};
var virtual_entry_default = WrappedComponent;
export {
  virtual_entry_default as default
};
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
/*! Bundled license information:

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
