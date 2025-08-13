var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// http-url:https://esm.sh/react@19.1.1/es2022/react.mjs
var react_exports = {};
__export(react_exports, {
  Children: () => ce,
  Component: () => pe,
  Fragment: () => ae,
  Profiler: () => _e,
  PureComponent: () => le,
  StrictMode: () => Ee,
  Suspense: () => ye,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: () => ve,
  __COMPILER_RUNTIME: () => Re,
  cache: () => me,
  cloneElement: () => Te,
  createContext: () => de,
  createElement: () => Ce,
  createRef: () => Se,
  default: () => Qe,
  forwardRef: () => Ae,
  isValidElement: () => we,
  lazy: () => he,
  memo: () => Oe,
  startTransition: () => ge,
  unstable_useCacheRefresh: () => Ne,
  use: () => je,
  useActionState: () => Pe,
  useCallback: () => He,
  useContext: () => Ie,
  useDebugValue: () => $e,
  useDeferredValue: () => Me,
  useEffect: () => Le,
  useId: () => Ue,
  useImperativeHandle: () => Ye,
  useInsertionEffect: () => xe,
  useLayoutEffect: () => De,
  useMemo: () => be,
  useOptimistic: () => ke,
  useReducer: () => qe,
  useRef: () => ze,
  useState: () => Ge,
  useSyncExternalStore: () => Ke,
  useTransition: () => We,
  version: () => Be
});
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
  var v3 = Symbol.for("react.transitional.element"), K2 = Symbol.for("react.portal"), W = Symbol.for("react.fragment"), B2 = Symbol.for("react.strict_mode"), Q = Symbol.for("react.profiler"), V2 = Symbol.for("react.consumer"), X = Symbol.for("react.context"), Z = Symbol.for("react.forward_ref"), J = Symbol.for("react.suspense"), F2 = Symbol.for("react.memo"), N2 = Symbol.for("react.lazy"), A2 = Symbol.iterator;
  function ee(e) {
    return e === null || typeof e != "object" ? null : (e = A2 && e[A2] || e["@@iterator"], typeof e == "function" ? e : null);
  }
  var j3 = { isMounted: function() {
    return false;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, P = Object.assign, H2 = {};
  function _2(e, t, n2) {
    this.props = e, this.context = t, this.refs = H2, this.updater = n2 || j3;
  }
  _2.prototype.isReactComponent = {};
  _2.prototype.setState = function(e, t) {
    if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, e, t, "setState");
  };
  _2.prototype.forceUpdate = function(e) {
    this.updater.enqueueForceUpdate(this, e, "forceUpdate");
  };
  function I2() {
  }
  I2.prototype = _2.prototype;
  function R3(e, t, n2) {
    this.props = e, this.context = t, this.refs = H2, this.updater = n2 || j3;
  }
  var m2 = R3.prototype = new I2();
  m2.constructor = R3;
  P(m2, _2.prototype);
  m2.isPureReactComponent = true;
  var w2 = Array.isArray, i2 = { H: null, A: null, T: null, S: null, V: null }, $ = Object.prototype.hasOwnProperty;
  function T3(e, t, n2, r, u2, f2) {
    return n2 = f2.ref, { $$typeof: v3, type: e, key: t, ref: n2 !== void 0 ? n2 : null, props: f2 };
  }
  function te(e, t) {
    return T3(e.type, t, void 0, void 0, void 0, e.props);
  }
  function d2(e) {
    return typeof e == "object" && e !== null && e.$$typeof === v3;
  }
  function ne(e) {
    var t = { "=": "=0", ":": "=2" };
    return "$" + e.replace(/[=:]/g, function(n2) {
      return t[n2];
    });
  }
  var h = /\/+/g;
  function y2(e, t) {
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
          case v3:
          case K2:
            s = true;
            break;
          case N2:
            return s = e._init, a2(s(e._payload), t, n2, r, u2);
        }
    }
    if (s) return u2 = u2(e), s = r === "" ? "." + y2(e, 0) : r, w2(u2) ? (n2 = "", s != null && (n2 = s.replace(h, "$&/") + "/"), a2(u2, t, n2, "", function(Y2) {
      return Y2;
    })) : u2 != null && (d2(u2) && (u2 = te(u2, n2 + (u2.key == null || e && e.key === u2.key ? "" : ("" + u2.key).replace(h, "$&/") + "/") + s)), t.push(u2)), 1;
    s = 0;
    var p3 = r === "" ? "." : r + ":";
    if (w2(e)) for (var c = 0; c < e.length; c++) r = e[c], f2 = p3 + y2(r, c), s += a2(r, t, n2, f2, u2);
    else if (c = ee(e), typeof c == "function") for (e = c.call(e), c = 0; !(r = e.next()).done; ) r = r.value, f2 = p3 + y2(r, c++), s += a2(r, t, n2, f2, u2);
    else if (f2 === "object") {
      if (typeof e.then == "function") return a2(re(e), t, n2, r, u2);
      throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
    }
    return s;
  }
  function l2(e, t, n2) {
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
  o.Children = { map: l2, forEach: function(e, t, n2) {
    l2(e, function() {
      t.apply(this, arguments);
    }, n2);
  }, count: function(e) {
    var t = 0;
    return l2(e, function() {
      t++;
    }), t;
  }, toArray: function(e) {
    return l2(e, function(t) {
      return t;
    }) || [];
  }, only: function(e) {
    if (!d2(e)) throw Error("React.Children.only expected to receive a single React element child.");
    return e;
  } };
  o.Component = _2;
  o.Fragment = W;
  o.Profiler = Q;
  o.PureComponent = R3;
  o.StrictMode = B2;
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
      for (var p3 = Array(s), c = 0; c < s; c++) p3[c] = arguments[c + 2];
      r.children = p3;
    }
    return T3(e.type, u2, void 0, void 0, f2, r);
  };
  o.createContext = function(e) {
    return e = { $$typeof: X, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null }, e.Provider = e, e.Consumer = { $$typeof: V2, _context: e }, e;
  };
  o.createElement = function(e, t, n2) {
    var r, u2 = {}, f2 = null;
    if (t != null) for (r in t.key !== void 0 && (f2 = "" + t.key), t) $.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (u2[r] = t[r]);
    var s = arguments.length - 2;
    if (s === 1) u2.children = n2;
    else if (1 < s) {
      for (var p3 = Array(s), c = 0; c < s; c++) p3[c] = arguments[c + 2];
      u2.children = p3;
    }
    if (e && e.defaultProps) for (r in s = e.defaultProps, s) u2[r] === void 0 && (u2[r] = s[r]);
    return T3(e, f2, void 0, void 0, null, u2);
  };
  o.createRef = function() {
    return { current: null };
  };
  o.forwardRef = function(e) {
    return { $$typeof: Z, render: e };
  };
  o.isValidElement = d2;
  o.lazy = function(e) {
    return { $$typeof: N2, _payload: { _status: -1, _result: e }, _init: oe };
  };
  o.memo = function(e, t) {
    return { $$typeof: F2, type: e, compare: t === void 0 ? null : t };
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

// http-url:https://esm.sh/react-dom@19.1.1/es2022/react-dom.mjs
var require2 = (n2) => {
  const e = (m2) => typeof m2.default < "u" ? m2.default : m2, c = (m2) => Object.assign({ __esModule: true }, m2);
  switch (n2) {
    case "react":
      return e(react_exports);
    default:
      console.error('module "' + n2 + '" not found');
      return null;
  }
};
var S2 = Object.create;
var l = Object.defineProperty;
var E2 = Object.getOwnPropertyDescriptor;
var T = Object.getOwnPropertyNames;
var R = Object.getPrototypeOf;
var N = Object.prototype.hasOwnProperty;
var p = ((r) => typeof require2 < "u" ? require2 : typeof Proxy < "u" ? new Proxy(r, { get: (e, t) => (typeof require2 < "u" ? require2 : e)[t] }) : r)(function(r) {
  if (typeof require2 < "u") return require2.apply(this, arguments);
  throw Error('Dynamic require of "' + r + '" is not supported');
});
var y = (r, e) => () => (e || r((e = { exports: {} }).exports, e), e.exports);
var A = (r, e, t, c) => {
  if (e && typeof e == "object" || typeof e == "function") for (let a2 of T(e)) !N.call(r, a2) && a2 !== t && l(r, a2, { get: () => e[a2], enumerable: !(c = E2(e, a2)) || c.enumerable });
  return r;
};
var D2 = (r, e, t) => (t = r != null ? S2(R(r)) : {}, A(e || !r || !r.__esModule ? l(t, "default", { value: r, enumerable: true }) : t, r));
var _ = y((i2) => {
  "use strict";
  var h = p("react");
  function o(r) {
    var e = "https://react.dev/errors/" + r;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var t = 2; t < arguments.length; t++) e += "&args[]=" + encodeURIComponent(arguments[t]);
    }
    return "Minified React error #" + r + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function f2() {
  }
  var n2 = { d: { f: f2, r: function() {
    throw Error(o(522));
  }, D: f2, C: f2, L: f2, m: f2, X: f2, S: f2, M: f2 }, p: 0, findDOMNode: null }, P = Symbol.for("react.portal");
  function C3(r, e, t) {
    var c = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return { $$typeof: P, key: c == null ? null : "" + c, children: r, containerInfo: e, implementation: t };
  }
  var u2 = h.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function s(r, e) {
    if (r === "font") return "";
    if (typeof e == "string") return e === "use-credentials" ? e : "";
  }
  i2.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = n2;
  i2.createPortal = function(r, e) {
    var t = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11) throw Error(o(299));
    return C3(r, e, null, t);
  };
  i2.flushSync = function(r) {
    var e = u2.T, t = n2.p;
    try {
      if (u2.T = null, n2.p = 2, r) return r();
    } finally {
      u2.T = e, n2.p = t, n2.d.f();
    }
  };
  i2.preconnect = function(r, e) {
    typeof r == "string" && (e ? (e = e.crossOrigin, e = typeof e == "string" ? e === "use-credentials" ? e : "" : void 0) : e = null, n2.d.C(r, e));
  };
  i2.prefetchDNS = function(r) {
    typeof r == "string" && n2.d.D(r);
  };
  i2.preinit = function(r, e) {
    if (typeof r == "string" && e && typeof e.as == "string") {
      var t = e.as, c = s(t, e.crossOrigin), a2 = typeof e.integrity == "string" ? e.integrity : void 0, g = typeof e.fetchPriority == "string" ? e.fetchPriority : void 0;
      t === "style" ? n2.d.S(r, typeof e.precedence == "string" ? e.precedence : void 0, { crossOrigin: c, integrity: a2, fetchPriority: g }) : t === "script" && n2.d.X(r, { crossOrigin: c, integrity: a2, fetchPriority: g, nonce: typeof e.nonce == "string" ? e.nonce : void 0 });
    }
  };
  i2.preinitModule = function(r, e) {
    if (typeof r == "string") if (typeof e == "object" && e !== null) {
      if (e.as == null || e.as === "script") {
        var t = s(e.as, e.crossOrigin);
        n2.d.M(r, { crossOrigin: t, integrity: typeof e.integrity == "string" ? e.integrity : void 0, nonce: typeof e.nonce == "string" ? e.nonce : void 0 });
      }
    } else e == null && n2.d.M(r);
  };
  i2.preload = function(r, e) {
    if (typeof r == "string" && typeof e == "object" && e !== null && typeof e.as == "string") {
      var t = e.as, c = s(t, e.crossOrigin);
      n2.d.L(r, t, { crossOrigin: c, integrity: typeof e.integrity == "string" ? e.integrity : void 0, nonce: typeof e.nonce == "string" ? e.nonce : void 0, type: typeof e.type == "string" ? e.type : void 0, fetchPriority: typeof e.fetchPriority == "string" ? e.fetchPriority : void 0, referrerPolicy: typeof e.referrerPolicy == "string" ? e.referrerPolicy : void 0, imageSrcSet: typeof e.imageSrcSet == "string" ? e.imageSrcSet : void 0, imageSizes: typeof e.imageSizes == "string" ? e.imageSizes : void 0, media: typeof e.media == "string" ? e.media : void 0 });
    }
  };
  i2.preloadModule = function(r, e) {
    if (typeof r == "string") if (e) {
      var t = s(e.as, e.crossOrigin);
      n2.d.m(r, { as: typeof e.as == "string" && e.as !== "script" ? e.as : void 0, crossOrigin: t, integrity: typeof e.integrity == "string" ? e.integrity : void 0 });
    } else n2.d.m(r);
  };
  i2.requestFormReset = function(r) {
    n2.d.r(r);
  };
  i2.unstable_batchedUpdates = function(r, e) {
    return r(e);
  };
  i2.useFormState = function(r, e, t) {
    return u2.H.useFormState(r, e, t);
  };
  i2.useFormStatus = function() {
    return u2.H.useHostTransitionStatus();
  };
  i2.version = "19.1.1";
});
var v = y((M3, O) => {
  "use strict";
  function m2() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(m2);
    } catch (r) {
      console.error(r);
    }
  }
  m2(), O.exports = _();
});
var d = D2(v());
var { __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: H, createPortal: I, flushSync: b2, preconnect: F, prefetchDNS: j, preinit: k2, preinitModule: G2, preload: q2, preloadModule: w, requestFormReset: V, unstable_batchedUpdates: x2, useFormState: Y, useFormStatus: z2, version: B } = d;
var K = d.default ?? d;

// http-url:https://esm.sh/react@19.1.1/es2022/jsx-runtime.mjs
var p2 = Object.create;
var j2 = Object.defineProperty;
var v2 = Object.getOwnPropertyDescriptor;
var a = Object.getOwnPropertyNames;
var k3 = Object.getPrototypeOf;
var T2 = Object.prototype.hasOwnProperty;
var n = (e, r) => () => (r || e((r = { exports: {} }).exports, r), r.exports);
var f = (e, r, t, o) => {
  if (r && typeof r == "object" || typeof r == "function") for (let s of a(r)) !T2.call(e, s) && s !== t && j2(e, s, { get: () => r[s], enumerable: !(o = v2(r, s)) || o.enumerable });
  return e;
};
var m = (e, r, t) => (t = e != null ? p2(k3(e)) : {}, f(r || !e || !e.__esModule ? j2(t, "default", { value: e, enumerable: true }) : t, e));
var E3 = n((l2) => {
  "use strict";
  var _2 = Symbol.for("react.transitional.element"), c = Symbol.for("react.fragment");
  function x3(e, r, t) {
    var o = null;
    if (t !== void 0 && (o = "" + t), r.key !== void 0 && (o = "" + r.key), "key" in r) {
      t = {};
      for (var s in r) s !== "key" && (t[s] = r[s]);
    } else t = r;
    return r = t.ref, { $$typeof: _2, type: e, key: o, ref: r !== void 0 ? r : null, props: t };
  }
  l2.Fragment = c;
  l2.jsx = x3;
  l2.jsxs = x3;
});
var i = n((P, d2) => {
  "use strict";
  d2.exports = E3();
});
var u = m(i());
var { Fragment: R2, jsx: q3, jsxs: C2 } = u;
var M2 = u.default ?? u;

// local:/components/Button.tsx
var Button = ({ children, onClick, variant = "primary" }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-colors";
  const variantClasses = variant === "primary" ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300";
  return /* @__PURE__ */ q3(
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
  return /* @__PURE__ */ q3("div", { className: "p-8 bg-gray-100 min-h-screen", children: /* @__PURE__ */ C2("div", { className: "max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6", children: [
    /* @__PURE__ */ q3("h1", { className: "text-3xl font-bold mb-4", children: "Product Card" }),
    /* @__PURE__ */ q3("p", { className: "text-gray-600 mb-2", children: truncateText(description, 30) }),
    /* @__PURE__ */ q3("p", { className: "text-2xl font-semibold text-green-600 mb-4", children: formatPrice(price) }),
    /* @__PURE__ */ C2("div", { className: "flex gap-4", children: [
      /* @__PURE__ */ q3(Button, { variant: "primary", children: "Buy Now" }),
      /* @__PURE__ */ q3(Button, { variant: "secondary", children: "Add to Cart" })
    ] })
  ] }) });
};
var app_default = App;

// virtual-entry:virtual:entry
function ScopedIsland({ href, children, className }) {
  const hostRef = ze(null);
  const [shadow, setShadow] = Ge(null);
  const [ready, setReady] = Ge(false);
  De(() => {
    if (!hostRef.current || shadow) return;
    setShadow(hostRef.current.attachShadow({ mode: "open" }));
  }, [shadow]);
  return /* @__PURE__ */ q3("div", { ref: hostRef, className, style: { visibility: ready ? "visible" : "hidden" }, children: shadow && I(
    /* @__PURE__ */ C2(R2, { children: [
      /* @__PURE__ */ q3(
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
  return /* @__PURE__ */ q3(ScopedIsland, { href: "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.css", className: props.className, children: OriginalDefault ? /* @__PURE__ */ q3(OriginalDefault, { ...props }) : null });
};
var virtual_entry_default = WrappedComponent;
var WithoutShadowRoot = (props) => {
  return /* @__PURE__ */ C2(R2, { children: [
    /* @__PURE__ */ q3("link", { rel: "stylesheet", href: "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.css" }),
    OriginalDefault ? /* @__PURE__ */ q3(OriginalDefault, { ...props }) : null
  ] });
};
export {
  WithoutShadowRoot,
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

react-dom/cjs/react-dom.production.js:
  (**
   * @license React
   * react-dom.production.js
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
