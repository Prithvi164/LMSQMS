
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Router } from 'wouter';
import App from './App';

// Static location hook for SSR
const staticLocationHook = (path: string) => [path, () => {}];

export function render(url: string) {
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <Router hook={() => staticLocationHook(url)} base="">
        <App />
      </Router>
    </React.StrictMode>
  );
}
