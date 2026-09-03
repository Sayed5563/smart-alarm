import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { updateService } from './services';

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    updateService.setRegistration(registration);
  },
});

if (import.meta.env.DEV) {
  void import('./store/useStore').then((m) => {
    (window as unknown as { __saStore: unknown }).__saStore = m.useStore;
  });
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
