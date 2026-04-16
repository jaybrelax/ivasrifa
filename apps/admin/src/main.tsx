import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpar flag de reload para que o script de resgate no index.html 
// possa agir novamente em um futuro deploy se necessário.
if (typeof window !== 'undefined') {
  sessionStorage.removeItem('sw_reload_sync');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
