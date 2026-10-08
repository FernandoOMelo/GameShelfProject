import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './pages/app';
import './styles.css';

// Service worker só em produção e em contexto seguro (o navegador omite `serviceWorker` em HTTP na rede local).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
