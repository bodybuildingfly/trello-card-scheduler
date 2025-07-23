/**
 * @file frontend/src/index.js
 * @description The application is now wrapped with the ThemeProvider to enable
 * the light/dark mode toggle functionality.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SchedulesProvider } from './context/SchedulesContext';
import { ThemeProvider } from './context/ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SchedulesProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </SchedulesProvider>
    </AuthProvider>
  </React.StrictMode>
);