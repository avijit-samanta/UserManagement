import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@reach/tabs/styles.css';
import '@reach/menu-button/styles.css';
import '@reach/dialog/styles.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
