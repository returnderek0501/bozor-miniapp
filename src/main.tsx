import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './index.css';
import App from './App';

(function initTheme() {
  const saved = localStorage.getItem('uztronix-theme');
  const tgScheme = window.Telegram?.WebApp?.colorScheme;
  const theme = saved === 'dark' || saved === 'light'
    ? saved
    : tgScheme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
