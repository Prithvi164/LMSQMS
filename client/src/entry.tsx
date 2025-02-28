import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from './App';

export function render(url: string) {
  console.log('SSR Entry file loaded successfully');
  console.log('Rendering URL:', url);

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