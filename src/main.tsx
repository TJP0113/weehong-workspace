import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './lib/app';
import { registerSW } from './lib/notify';
import { applyPrefs } from './lib/prefs';
import { UiProvider } from './components/ui';
import './styles.css';

applyPrefs();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyPrefs());
if (import.meta.env.PROD) registerSW().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
