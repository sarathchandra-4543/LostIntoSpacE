import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import { applyTheme, useThemeStore, watchSystemTheme } from '@/stores/themeStore';
import './styles/globals.css';

/*
 * The theme goes on the document before React mounts.
 *
 * Mounting first and setting the theme in an effect means at least one frame of
 * the default palette, which on a product whose light theme is warm paper is a
 * visible white flash on every single load. Doing it here costs nothing and
 * removes it entirely — and it also means the very first paint of a 3D canvas
 * already has the right background behind it.
 */
applyTheme(useThemeStore.getState().preference);
watchSystemTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
