import React from 'react'

// Re-export all React exports to support both named and default imports
export const {
    isValidElement,
    createElement,
    Fragment,
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    useContext,
    Children,
    cloneElement,
    createContext,
    forwardRef,
    lazy,
    memo,
    Profiler,
    PureComponent,
    Suspense,
    Component,
    startTransition,
    useDebugValue,
    useDeferredValue,
    useId,
    useImperativeHandle,
    useInsertionEffect,
    useLayoutEffect,
    useReducer,
    useSyncExternalStore,
    useTransition,
    createRef,
    StrictMode,
    use,
} = React

export default React

// Export the URL for the import map
export const url = import.meta.url