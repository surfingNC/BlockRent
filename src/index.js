import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App.js';
import reportWebVitals from './reportWebVitals.js';
import { HashRouter } from 'react-router-dom'; // ✅ use HashRouter for gh-pages
import './styles/index.css';
import './styles/Header.css';
import './styles/LoginHeader.css';
import './styles/theme.css';      // 1. TOKENS (must be first)
import './styles/base.css';       // 2. GLOBAL FOUNDATION
import './styles/components.css'; // 3. REUSABLE UI
import './styles/Dashboard.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

reportWebVitals();
