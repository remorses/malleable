/* esm.sh - react@19.3.0 */
var k$1=Object.create;var S=Object.defineProperty;var q$1=Object.getOwnPropertyDescriptor;var b=Object.getOwnPropertyNames;var z=Object.getPrototypeOf,G=Object.prototype.hasOwnProperty;var A=(t,e)=>()=>{try{return e||t((e={exports:{}}).exports,e),e.exports}catch(n){throw e=0,n}};var V=(t,e,n,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of b(e))!G.call(t,o)&&o!==n&&S(t,o,{get:()=>e[o],enumerable:!(r=q$1(e,o))||r.enumerable});return t};var W=(t,e,n)=>(n=t!=null?k$1(z(t)):{},V(!t||!t.__esModule?S(n,"default",{value:t,enumerable:true}):n,t));var x=A(u=>{"use strict";var v=Symbol.for("react.transitional.element"),K=Symbol.for("react.portal"),B=Symbol.for("react.fragment"),Q=Symbol.for("react.strict_mode"),X=Symbol.for("react.profiler"),Z=Symbol.for("react.consumer"),J=Symbol.for("react.context"),F=Symbol.for("react.forward_ref"),tt=Symbol.for("react.suspense"),et=Symbol.for("react.memo"),P=Symbol.for("react.lazy"),nt=Symbol.for("react.activity"),rt=Symbol.for("react.view_transition"),w=Symbol.iterator;function ut(t){return t===null||typeof t!="object"?null:(t=w&&t[w]||t["@@iterator"],typeof t=="function"?t:null)}var j={isMounted:function(){return !1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},H=Object.assign,h={};function l(t,e,n){this.props=t,this.context=e,this.refs=h,this.updater=n||j;}l.prototype.isReactComponent={};l.prototype.setState=function(t,e){if(typeof t!="object"&&typeof t!="function"&&t!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,t,e,"setState");};l.prototype.forceUpdate=function(t){this.updater.enqueueForceUpdate(this,t,"forceUpdate");};function I(){}I.prototype=l.prototype;function R(t,e,n){this.props=t,this.context=e,this.refs=h,this.updater=n||j;}var m=R.prototype=new I;m.constructor=R;H(m,l.prototype);m.isPureReactComponent=!0;var O=Array.isArray;function T(){}var i={H:null,A:null,T:null,S:null},M=Object.prototype.hasOwnProperty;function C(t,e,n){var r=n.ref;return {$$typeof:v,type:t,key:e,ref:r!==void 0?r:null,props:n}}function ot(t,e){return C(t.type,e,t.props)}function d(t){return typeof t=="object"&&t!==null&&t.$$typeof===v}function st(t){var e={"=":"=0",":":"=2"};return "$"+t.replace(/[=:]/g,function(n){return e[n]})}var g=/\/+/g;function y(t,e){return typeof t=="object"&&t!==null&&t.key!=null?st(""+t.key):e.toString(36)}function it(t){switch(t.status){case "fulfilled":return t.value;case "rejected":throw t.reason;default:switch(typeof t.status=="string"?t.then(T,T):(t.status="pending",t.then(function(e){t.status==="pending"&&(t.status="fulfilled",t.value=e);},function(e){t.status==="pending"&&(t.status="rejected",t.reason=e);})),t.status){case "fulfilled":return t.value;case "rejected":throw t.reason}}throw t}function a(t,e,n,r,o){var s=typeof t;(s==="undefined"||s==="boolean")&&(t=null);var f=!1;if(t===null)f=!0;else switch(s){case "bigint":case "string":case "number":f=!0;break;case "object":switch(t.$$typeof){case v:case K:f=!0;break;case P:return f=t._init,a(f(t._payload),e,n,r,o)}}if(f)return o=o(t),f=r===""?"."+y(t,0):r,O(o)?(n="",f!=null&&(n=f.replace(g,"$&/")+"/"),a(o,e,n,"",function(D){return D})):o!=null&&(d(o)&&(o=ot(o,n+(o.key==null||t&&t.key===o.key?"":(""+o.key).replace(g,"$&/")+"/")+f)),e.push(o)),1;f=0;var p=r===""?".":r+":";if(O(t))for(var c=0;c<t.length;c++)r=t[c],s=p+y(r,c),f+=a(r,e,n,s,o);else if(c=ut(t),typeof c=="function")for(t=c.call(t),c=0;!(r=t.next()).done;)r=r.value,s=p+y(r,c++),f+=a(r,e,n,s,o);else if(s==="object"){if(typeof t.then=="function")return a(it(t),e,n,r,o);throw e=String(t),Error("Objects are not valid as a React child (found: "+(e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)+"). If you meant to render a collection of children, use an array instead.")}return f}function _(t,e,n){if(t==null)return t;var r=[],o=0;return a(t,r,"","",function(s){return e.call(n,s,o++)}),r}function ft(t){if(t._status===-1){var e=t._result,n=e();n.then(function(r){(t._status===0||t._status===-1)&&(t._status=1,t._result=r,n.status===void 0&&(n.status="fulfilled",n.value=r));},function(r){(t._status===0||t._status===-1)&&(t._status=2,t._result=r,n.status===void 0&&(n.status="rejected",n.reason=r));}),t._status===-1&&(t._status=0,t._result=n);}if(t._status===1)return t._result.default;throw t._result}var N=typeof reportError=="function"?reportError:function(t){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var e=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof t=="object"&&t!==null&&typeof t.message=="string"?String(t.message):String(t),error:t});if(!window.dispatchEvent(e))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",t);return}console.error(t);};function Y(t){var e=i.T,n={};n.types=e!==null?e.types:null,i.T=n;try{var r=t(),o=i.S;o!==null&&o(n,r),typeof r=="object"&&r!==null&&typeof r.then=="function"&&r.then(T,N);}catch(s){N(s);}finally{e!==null&&n.types!==null&&(e.types=n.types),i.T=e;}}function $(t){var e=i.T;if(e!==null){var n=e.types;n===null?e.types=[t]:n.indexOf(t)===-1&&n.push(t);}else Y($.bind(null,t));}var ct={map:_,forEach:function(t,e,n){_(t,function(){e.apply(this,arguments);},n);},count:function(t){var e=0;return _(t,function(){e++;}),e},toArray:function(t){return _(t,function(e){return e})||[]},only:function(t){if(!d(t))throw Error("React.Children.only expected to receive a single React element child.");return t}};u.Activity=nt;u.Children=ct;u.Component=l;u.Fragment=B;u.Profiler=X;u.PureComponent=R;u.StrictMode=Q;u.Suspense=tt;u.ViewTransition=rt;u.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=i;u.__COMPILER_RUNTIME={__proto__:null,c:function(t){return i.H.useMemoCache(t)}};u.addTransitionType=$;u.cache=function(t){return function(){return t.apply(null,arguments)}};u.cacheSignal=function(){return null};u.cloneElement=function(t,e,n){if(t==null)throw Error("The argument must be a React element, but you passed "+t+".");var r=H({},t.props),o=t.key;if(e!=null)for(s in e.key!==void 0&&(o=""+e.key),e)!M.call(e,s)||s==="key"||s==="__self"||s==="__source"||s==="ref"&&e.ref===void 0||(r[s]=e[s]);var s=arguments.length-2;if(s===1)r.children=n;else if(1<s){for(var f=Array(s),p=0;p<s;p++)f[p]=arguments[p+2];r.children=f;}return C(t.type,o,r)};u.createContext=function(t){return t={$$typeof:J,_currentValue:t,_currentValue2:t,_threadCount:0,Provider:null,Consumer:null},t.Provider=t,t.Consumer={$$typeof:Z,_context:t},t};u.createElement=function(t,e,n){var r,o={},s=null;if(e!=null)for(r in e.key!==void 0&&(s=""+e.key),e)M.call(e,r)&&r!=="key"&&r!=="__self"&&r!=="__source"&&(o[r]=e[r]);var f=arguments.length-2;if(f===1)o.children=n;else if(1<f){for(var p=Array(f),c=0;c<f;c++)p[c]=arguments[c+2];o.children=p;}if(t&&t.defaultProps)for(r in f=t.defaultProps,f)o[r]===void 0&&(o[r]=f[r]);return C(t,s,o)};u.createRef=function(){return {current:null}};u.forwardRef=function(t){return {$$typeof:F,render:t}};u.isValidElement=d;u.lazy=function(t){return {$$typeof:P,_payload:{_status:-1,_result:t},_init:ft}};u.memo=function(t,e){return {$$typeof:et,type:t,compare:e===void 0?null:e}};u.startTransition=Y;u.unstable_useCacheRefresh=function(){return i.H.useCacheRefresh()};u.use=function(t){return i.H.use(t)};u.useActionState=function(t,e,n){return i.H.useActionState(t,e,n)};u.useCallback=function(t,e){return i.H.useCallback(t,e)};u.useContext=function(t){return i.H.useContext(t)};u.useDebugValue=function(){};u.useDeferredValue=function(t,e){return i.H.useDeferredValue(t,e)};u.useEffect=function(t,e){return i.H.useEffect(t,e)};u.useEffectEvent=function(t){return i.H.useEffectEvent(t)};u.useId=function(){return i.H.useId()};u.useImperativeHandle=function(t,e,n){return i.H.useImperativeHandle(t,e,n)};u.useInsertionEffect=function(t,e){return i.H.useInsertionEffect(t,e)};u.useLayoutEffect=function(t,e){return i.H.useLayoutEffect(t,e)};u.useMemo=function(t,e){return i.H.useMemo(t,e)};u.useOptimistic=function(t,e){return i.H.useOptimistic(t,e)};u.useReducer=function(t,e,n){return i.H.useReducer(t,e,n)};u.useRef=function(t){return i.H.useRef(t)};u.useState=function(t){return i.H.useState(t)};u.useSyncExternalStore=function(t,e,n){return i.H.useSyncExternalStore(t,e,n)};u.useTransition=function(){return i.H.useTransition()};u.version="19.3.0";});var U=A((lt,L)=>{"use strict";L.exports=x();});var E$1=W(U()),{Activity:_t,Children:Et,Component:yt,Fragment:Tt,Profiler:vt,PureComponent:Rt,StrictMode:mt,Suspense:Ct,ViewTransition:dt,__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:St,__COMPILER_RUNTIME:At,addTransitionType:wt,cache:Ot,cacheSignal:gt,cloneElement:Nt,createContext:Pt,createElement:jt,createRef:Ht,forwardRef:ht,isValidElement:It,lazy:Mt,memo:Yt,startTransition:$t,unstable_useCacheRefresh:xt,use:Lt,useActionState:Ut,useCallback:Dt,useContext:kt,useDebugValue:qt,useDeferredValue:bt,useEffect:zt,useEffectEvent:Gt,useId:Vt,useImperativeHandle:Wt,useInsertionEffect:Kt,useLayoutEffect:Bt,useMemo:Qt,useOptimistic:Xt,useReducer:Zt,useRef:Jt,useState:Ft,useSyncExternalStore:te,useTransition:ee,version:ne}=E$1,re=E$1.default??E$1;/*! Bundled license information:

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

/* esm.sh - react@19.3.0/jsx-runtime */
var p=Object.create;var j=Object.defineProperty;var v=Object.getOwnPropertyDescriptor;var a=Object.getOwnPropertyNames;var k=Object.getPrototypeOf,T=Object.prototype.hasOwnProperty;var n=(t,r)=>()=>{try{return r||t((r={exports:{}}).exports,r),r.exports}catch(e){throw r=0,e}};var f=(t,r,e,o)=>{if(r&&typeof r=="object"||typeof r=="function")for(let s of a(r))!T.call(t,s)&&s!==e&&j(t,s,{get:()=>r[s],enumerable:!(o=v(r,s))||o.enumerable});return t};var m=(t,r,e)=>(e=t!=null?p(k(t)):{},f(!t||!t.__esModule?j(e,"default",{value:t,enumerable:true}):e,t));var E=n(l=>{"use strict";var _=Symbol.for("react.transitional.element"),c=Symbol.for("react.fragment");function x(t,r,e){var o=null;if(e!==void 0&&(o=""+e),r.key!==void 0&&(o=""+r.key),"key"in r){e={};for(var s in r)s!=="key"&&(e[s]=r[s]);}else e=r;return r=e.ref,{$$typeof:_,type:t,key:o,ref:r!==void 0?r:null,props:e}}l.Fragment=c;l.jsx=x;l.jsxs=x;});var i=n((P,d)=>{"use strict";d.exports=E();});var u=m(i()),{Fragment:R,jsx:q,jsxs:C}=u;u.default??u;/*! Bundled license information:

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

const Button = ({ children, onClick, variant = 'primary' }) => {
                const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-colors";
                const variantClasses = variant === 'primary'
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300";

                return (
                  q('button', {
                    className: `${baseClasses} ${variantClasses}`,
                    onClick: onClick,
 children: 
                    children
                  })
                );
              };

const formatPrice = (price) => {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(price);
              };

              const truncateText = (text, maxLength) => {
                if (text.length <= maxLength) return text;
                return text.slice(0, maxLength) + '...';
              };

const App = () => {
                const price = 99.99;
                const description = "This is a very long product description that needs to be truncated";

                return (
                  q('div', { className: "p-8 bg-gray-100 min-h-screen"  , children: 
                    C('div', { className: "max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6"     , children: [
                      q('h1', { className: "text-3xl font-bold mb-4"  , children: "Product Card" })
                      , q('p', { className: "text-gray-600 mb-2" , children: truncateText(description, 30)})
                      , q('p', { className: "text-2xl font-semibold text-green-600 mb-4"   , children: formatPrice(price)})
                      , C('div', { className: "flex gap-4" , children: [
                        q(Button, { variant: "primary", children: "Buy Now" })
                        , q(Button, { variant: "secondary", children: "Add to Cart"  })
                      ]})
                    ]})
                  })
                );
              };

const OriginalDefault = App;
function WrappedComponent(props) {
  return re.createElement(
    re.Fragment,
    null,
    re.createElement('link', { rel: 'stylesheet', href: "https://remote-bundler.fumabase.com/bundle/test-6qm28/index.css" }),
    OriginalDefault ? re.createElement(OriginalDefault, props) : null,
  );
}

export { WrappedComponent as default };
