import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from '../../src/App';

export function render() {
  console.log('SSR Entry file loaded successfully');
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}