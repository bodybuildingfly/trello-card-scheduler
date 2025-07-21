import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SchedulesProvider } from './context/SchedulesContext'; // Import the new SchedulesProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SchedulesProvider>
        <App />
      </SchedulesProvider>
    </AuthProvider>
  </React.StrictMode>
);