import React from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';

/**
 * @description A component that protects its children routes.
 * If the user is authenticated, it renders the children.
 * Otherwise, it renders the LoginPage.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to protect.
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();

    // If the user is authenticated, render the main application content (the children).
    // Otherwise, render the LoginPage.
    return isAuthenticated ? children : <LoginPage />;
};

export default ProtectedRoute;