import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// When a new service worker takes over (after a fresh deploy), reload the page
// so users immediately get the new JS/CSS bundles instead of the cached ones.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
