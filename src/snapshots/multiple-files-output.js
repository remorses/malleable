// http-url:https://esm.sh/react@19.3.0/es2022/react.mjs
var k = Object.create;
var S = Object.defineProperty;
var q = Object.getOwnPropertyDescriptor;
var b = Object.getOwnPropertyNames;
var z = Object.getPrototypeOf;
var G = Object.prototype.hasOwnProperty;
var A = (t, e) => () => {
  try {
    return e || t((e = { exports: {} }).exports, e), e.exports;
  } catch (n2) {
    throw e = 0, n2;
  }
};
var V = (t, e, n2, r) => {
  if (e && typeof e == "object" || typeof e == "function") for (let o of b(e)) !G.call(t, o) && o !== n2 && S(t, o, { get: () => e[o], enumerable: !(r = q(e, o)) || r.enumerable });
  return t;
};
var W = (t, e, n2) => (n2 = t != null ? k(z(t)) : {}, V(e || !t || !t.__esModule ? S(n2, "default", { value: t, enumerable: true }) : n2, t));
var x = A((u2) => {
  "use strict";
  var v2 = Symbol.for("react.transitional.element"), K = Symbol.for("react.portal"), B = Symbol.for("react.fragment"), Q = Symbol.for("react.strict_mode"), X = Symbol.for("react.profiler"), Z = Symbol.for("react.consumer"), J = Symbol.for("react.context"), F = Symbol.for("react.forward_ref"), tt = Symbol.for("react.suspense"), et = Symbol.for("react.memo"), P = Symbol.for("react.lazy"), nt = Symbol.for("react.activity"), rt = Symbol.for("react.view_transition"), w = Symbol.iterator;
  function ut(t) {
    return t === null || typeof t != "object" ? null : (t = w && t[w] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var j2 = { isMounted: function() {
    return false;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, H = Object.assign, h = {};
  function l(t, e, n2) {
    this.props = t, this.context = e, this.refs = h, this.updater = n2 || j2;
  }
  l.prototype.isReactComponent = {};
  l.prototype.setState = function(t, e) {
    if (typeof t != "object" && typeof t != "function" && t != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, t, e, "setState");
  };
  l.prototype.forceUpdate = function(t) {
    this.updater.enqueueForceUpdate(this, t, "forceUpdate");
  };
  function I() {
  }
  I.prototype = l.prototype;
  function R2(t, e, n2) {
    this.props = t, this.context = e, this.refs = h, this.updater = n2 || j2;
  }
  var m2 = R2.prototype = new I();
  m2.constructor = R2;
  H(m2, l.prototype);
  m2.isPureReactComponent = true;
  var O = Array.isArray;
  function T2() {
  }
  var i2 = { H: null, A: null, T: null, S: null }, M2 = Object.prototype.hasOwnProperty;
  function C2(t, e, n2) {
    var r = n2.ref;
    return { $$typeof: v2, type: t, key: e, ref: r !== void 0 ? r : null, props: n2 };
  }
  function ot(t, e) {
    return C2(t.type, e, t.props);
  }
  function d(t) {
    return typeof t == "object" && t !== null && t.$$typeof === v2;
  }
  function st(t) {
    var e = { "=": "=0", ":": "=2" };
    return "$" + t.replace(/[=:]/g, function(n2) {
      return e[n2];
    });
  }
  var g = /\/+/g;
  function y(t, e) {
    return typeof t == "object" && t !== null && t.key != null ? st("" + t.key) : e.toString(36);
  }
  function it(t) {
    switch (t.status) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw t.reason;
      default:
        switch (typeof t.status == "string" ? t.then(T2, T2) : (t.status = "pending", t.then(function(e) {
          t.status === "pending" && (t.status = "fulfilled", t.value = e);
        }, function(e) {
          t.status === "pending" && (t.status = "rejected", t.reason = e);
        })), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw t.reason;
        }
    }
    throw t;
  }
  function a2(t, e, n2, r, o) {
    var s = typeof t;
    (s === "undefined" || s === "boolean") && (t = null);
    var f2 = false;
    if (t === null) f2 = true;
    else switch (s) {
      case "bigint":
      case "string":
      case "number":
        f2 = true;
        break;
      case "object":
        switch (t.$$typeof) {
          case v2:
          case K:
            f2 = true;
            break;
          case P:
            return f2 = t._init, a2(f2(t._payload), e, n2, r, o);
        }
    }
    if (f2) return o = o(t), f2 = r === "" ? "." + y(t, 0) : r, O(o) ? (n2 = "", f2 != null && (n2 = f2.replace(g, "$&/") + "/"), a2(o, e, n2, "", function(D) {
      return D;
    })) : o != null && (d(o) && (o = ot(o, n2 + (o.key == null || t && t.key === o.key ? "" : ("" + o.key).replace(g, "$&/") + "/") + f2)), e.push(o)), 1;
    f2 = 0;
    var p2 = r === "" ? "." : r + ":";
    if (O(t)) for (var c = 0; c < t.length; c++) r = t[c], s = p2 + y(r, c), f2 += a2(r, e, n2, s, o);
    else if (c = ut(t), typeof c == "function") for (t = c.call(t), c = 0; !(r = t.next()).done; ) r = r.value, s = p2 + y(r, c++), f2 += a2(r, e, n2, s, o);
    else if (s === "object") {
      if (typeof t.then == "function") return a2(it(t), e, n2, r, o);
      throw e = String(t), Error("Objects are not valid as a React child (found: " + (e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e) + "). If you meant to render a collection of children, use an array instead.");
    }
    return f2;
  }
  function _(t, e, n2) {
    if (t == null) return t;
    var r = [], o = 0;
    return a2(t, r, "", "", function(s) {
      return e.call(n2, s, o++);
    }), r;
  }
  function ft(t) {
    if (t._status === -1) {
      var e = t._result, n2 = e();
      n2.then(function(r) {
        (t._status === 0 || t._status === -1) && (t._status = 1, t._result = r, n2.status === void 0 && (n2.status = "fulfilled", n2.value = r));
      }, function(r) {
        (t._status === 0 || t._status === -1) && (t._status = 2, t._result = r, n2.status === void 0 && (n2.status = "rejected", n2.reason = r));
      }), t._status === -1 && (t._status = 0, t._result = n2);
    }
    if (t._status === 1) return t._result.default;
    throw t._result;
  }
  var N = typeof reportError == "function" ? reportError : function(t) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var e = new window.ErrorEvent("error", { bubbles: true, cancelable: true, message: typeof t == "object" && t !== null && typeof t.message == "string" ? String(t.message) : String(t), error: t });
      if (!window.dispatchEvent(e)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", t);
      return;
    }
    console.error(t);
  };
  function Y(t) {
    var e = i2.T, n2 = {};
    n2.types = e !== null ? e.types : null, i2.T = n2;
    try {
      var r = t(), o = i2.S;
      o !== null && o(n2, r), typeof r == "object" && r !== null && typeof r.then == "function" && r.then(T2, N);
    } catch (s) {
      N(s);
    } finally {
      e !== null && n2.types !== null && (e.types = n2.types), i2.T = e;
    }
  }
  function $(t) {
    var e = i2.T;
    if (e !== null) {
      var n2 = e.types;
      n2 === null ? e.types = [t] : n2.indexOf(t) === -1 && n2.push(t);
    } else Y($.bind(null, t));
  }
  var ct = { map: _, forEach: function(t, e, n2) {
    _(t, function() {
      e.apply(this, arguments);
    }, n2);
  }, count: function(t) {
    var e = 0;
    return _(t, function() {
      e++;
    }), e;
  }, toArray: function(t) {
    return _(t, function(e) {
      return e;
    }) || [];
  }, only: function(t) {
    if (!d(t)) throw Error("React.Children.only expected to receive a single React element child.");
    return t;
  } };
  u2.Activity = nt;
  u2.Children = ct;
  u2.Component = l;
  u2.Fragment = B;
  u2.Profiler = X;
  u2.PureComponent = R2;
  u2.StrictMode = Q;
  u2.Suspense = tt;
  u2.ViewTransition = rt;
  u2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i2;
  u2.__COMPILER_RUNTIME = { __proto__: null, c: function(t) {
    return i2.H.useMemoCache(t);
  } };
  u2.addTransitionType = $;
  u2.cache = function(t) {
    return function() {
      return t.apply(null, arguments);
    };
  };
  u2.cacheSignal = function() {
    return null;
  };
  u2.cloneElement = function(t, e, n2) {
    if (t == null) throw Error("The argument must be a React element, but you passed " + t + ".");
    var r = H({}, t.props), o = t.key;
    if (e != null) for (s in e.key !== void 0 && (o = "" + e.key), e) !M2.call(e, s) || s === "key" || s === "__self" || s === "__source" || s === "ref" && e.ref === void 0 || (r[s] = e[s]);
    var s = arguments.length - 2;
    if (s === 1) r.children = n2;
    else if (1 < s) {
      for (var f2 = Array(s), p2 = 0; p2 < s; p2++) f2[p2] = arguments[p2 + 2];
      r.children = f2;
    }
    return C2(t.type, o, r);
  };
  u2.createContext = function(t) {
    return t = { $$typeof: J, _currentValue: t, _currentValue2: t, _threadCount: 0, Provider: null, Consumer: null }, t.Provider = t, t.Consumer = { $$typeof: Z, _context: t }, t;
  };
  u2.createElement = function(t, e, n2) {
    var r, o = {}, s = null;
    if (e != null) for (r in e.key !== void 0 && (s = "" + e.key), e) M2.call(e, r) && r !== "key" && r !== "__self" && r !== "__source" && (o[r] = e[r]);
    var f2 = arguments.length - 2;
    if (f2 === 1) o.children = n2;
    else if (1 < f2) {
      for (var p2 = Array(f2), c = 0; c < f2; c++) p2[c] = arguments[c + 2];
      o.children = p2;
    }
    if (t && t.defaultProps) for (r in f2 = t.defaultProps, f2) o[r] === void 0 && (o[r] = f2[r]);
    return C2(t, s, o);
  };
  u2.createRef = function() {
    return { current: null };
  };
  u2.forwardRef = function(t) {
    return { $$typeof: F, render: t };
  };
  u2.isValidElement = d;
  u2.lazy = function(t) {
    return { $$typeof: P, _payload: { _status: -1, _result: t }, _init: ft };
  };
  u2.memo = function(t, e) {
    return { $$typeof: et, type: t, compare: e === void 0 ? null : e };
  };
  u2.startTransition = Y;
  u2.unstable_useCacheRefresh = function() {
    return i2.H.useCacheRefresh();
  };
  u2.use = function(t) {
    return i2.H.use(t);
  };
  u2.useActionState = function(t, e, n2) {
    return i2.H.useActionState(t, e, n2);
  };
  u2.useCallback = function(t, e) {
    return i2.H.useCallback(t, e);
  };
  u2.useContext = function(t) {
    return i2.H.useContext(t);
  };
  u2.useDebugValue = function() {
  };
  u2.useDeferredValue = function(t, e) {
    return i2.H.useDeferredValue(t, e);
  };
  u2.useEffect = function(t, e) {
    return i2.H.useEffect(t, e);
  };
  u2.useEffectEvent = function(t) {
    return i2.H.useEffectEvent(t);
  };
  u2.useId = function() {
    return i2.H.useId();
  };
  u2.useImperativeHandle = function(t, e, n2) {
    return i2.H.useImperativeHandle(t, e, n2);
  };
  u2.useInsertionEffect = function(t, e) {
    return i2.H.useInsertionEffect(t, e);
  };
  u2.useLayoutEffect = function(t, e) {
    return i2.H.useLayoutEffect(t, e);
  };
  u2.useMemo = function(t, e) {
    return i2.H.useMemo(t, e);
  };
  u2.useOptimistic = function(t, e) {
    return i2.H.useOptimistic(t, e);
  };
  u2.useReducer = function(t, e, n2) {
    return i2.H.useReducer(t, e, n2);
  };
  u2.useRef = function(t) {
    return i2.H.useRef(t);
  };
  u2.useState = function(t) {
    return i2.H.useState(t);
  };
  u2.useSyncExternalStore = function(t, e, n2) {
    return i2.H.useSyncExternalStore(t, e, n2);
  };
  u2.useTransition = function() {
    return i2.H.useTransition();
  };
  u2.version = "19.3.0";
});
var U = A((lt, L) => {
  "use strict";
  L.exports = x();
});
var E = W(U());
var { Activity: _t, Children: Et, Component: yt, Fragment: Tt, Profiler: vt, PureComponent: Rt, StrictMode: mt, Suspense: Ct, ViewTransition: dt, __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: St, __COMPILER_RUNTIME: At, addTransitionType: wt, cache: Ot, cacheSignal: gt, cloneElement: Nt, createContext: Pt, createElement: jt, createRef: Ht, forwardRef: ht, isValidElement: It, lazy: Mt, memo: Yt, startTransition: $t, unstable_useCacheRefresh: xt, use: Lt, useActionState: Ut, useCallback: Dt, useContext: kt, useDebugValue: qt, useDeferredValue: bt, useEffect: zt, useEffectEvent: Gt, useId: Vt, useImperativeHandle: Wt, useInsertionEffect: Kt, useLayoutEffect: Bt, useMemo: Qt, useOptimistic: Xt, useReducer: Zt, useRef: Jt, useState: Ft, useSyncExternalStore: te, useTransition: ee, version: ne } = E;
var re = E.default ?? E;

// http-url:https://esm.sh/react@19.3.0/es2022/jsx-runtime.mjs
var p = Object.create;
var j = Object.defineProperty;
var v = Object.getOwnPropertyDescriptor;
var a = Object.getOwnPropertyNames;
var k2 = Object.getPrototypeOf;
var T = Object.prototype.hasOwnProperty;
var n = (t, r) => () => {
  try {
    return r || t((r = { exports: {} }).exports, r), r.exports;
  } catch (e) {
    throw r = 0, e;
  }
};
var f = (t, r, e, o) => {
  if (r && typeof r == "object" || typeof r == "function") for (let s of a(r)) !T.call(t, s) && s !== e && j(t, s, { get: () => r[s], enumerable: !(o = v(r, s)) || o.enumerable });
  return t;
};
var m = (t, r, e) => (e = t != null ? p(k2(t)) : {}, f(r || !t || !t.__esModule ? j(e, "default", { value: t, enumerable: true }) : e, t));
var E2 = n((l) => {
  "use strict";
  var _ = Symbol.for("react.transitional.element"), c = Symbol.for("react.fragment");
  function x2(t, r, e) {
    var o = null;
    if (e !== void 0 && (o = "" + e), r.key !== void 0 && (o = "" + r.key), "key" in r) {
      e = {};
      for (var s in r) s !== "key" && (e[s] = r[s]);
    } else e = r;
    return r = e.ref, { $$typeof: _, type: t, key: o, ref: r !== void 0 ? r : null, props: e };
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
var { Fragment: R, jsx: q2, jsxs: C } = u;
var M = u.default ?? u;

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
  return /* @__PURE__ */ q2("div", { className: "p-8 bg-gray-100 min-h-screen", children: /* @__PURE__ */ C("div", { className: "max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6", children: [
    /* @__PURE__ */ q2("h1", { className: "text-3xl font-bold mb-4", children: "Product Card" }),
    /* @__PURE__ */ q2("p", { className: "text-gray-600 mb-2", children: truncateText(description, 30) }),
    /* @__PURE__ */ q2("p", { className: "text-2xl font-semibold text-green-600 mb-4", children: formatPrice(price) }),
    /* @__PURE__ */ C("div", { className: "flex gap-4", children: [
      /* @__PURE__ */ q2(Button, { variant: "primary", children: "Buy Now" }),
      /* @__PURE__ */ q2(Button, { variant: "secondary", children: "Add to Cart" })
    ] })
  ] }) });
};
var app_default = App;

// virtual-entry:virtual:entry
var OriginalDefault = app_default;
var WrappedComponent = (props) => {
  return /* @__PURE__ */ C(R, { children: [
    /* @__PURE__ */ q2("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/test-pr1zzt/index.css" }),
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
