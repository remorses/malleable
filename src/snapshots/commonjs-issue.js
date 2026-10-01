import React from 'react';
import { jsx } from 'react/jsx-runtime';

const Button = () => jsx('button', { className: "xxx p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6"     , children: "Click"});

const OriginalDefault = Button;
function WrappedComponent(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', { rel: 'stylesheet', href: "https://remote-bundler.fumabase.com/bundle/test-eufnop/index.css" }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null,
  );
}

export { WrappedComponent as default };
