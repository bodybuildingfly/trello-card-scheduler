import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Import the AuthProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/*
      By wrapping the entire App in the AuthProvider, any component
      inside App can now access the authentication state (like user,
      isAuthenticated, login, logout) by using the useAuth() hook.
    */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
