import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { applySettings, loadSettings } from './settings';
import './styles.css';

// Applied before the first render so the theme doesn't flash on load.
applySettings(loadSettings());

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
