import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api'; // Import our centralized API client

// 1. Create the context
const AuthContext = createContext(null);

/**
 * @description A custom hook to easily access the authentication context from any component.
 * @returns {object} The authentication context value (user, login, logout, etc.).
 */
export const useAuth = () => {
    return useContext(AuthContext);
};

/**
 * @description The provider component that wraps the application and manages all authentication state.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered within the provider.
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // To check initial auth status

    // On initial app load, check if user info is stored in localStorage
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('userInfo');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                // Set the authorization header for our apiClient for all subsequent requests
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
                setUser(userData);
            }
        } catch (error) {
            console.error("Failed to parse user info from localStorage", error);
            localStorage.removeItem('userInfo'); // Clear corrupted data
        }
        setIsLoading(false);
    }, []);

    /**
     * @description Logs in a user by calling the API and storing the returned user info.
     * @param {string} username - The user's username.
     * @param {string} password - The user's password.
     * @returns {Promise<void>} A promise that resolves on success or rejects on failure.
     */
    const login = async (username, password) => {
        try {
            const { data } = await apiClient.post('/api/auth/login', { username, password });
            if (data && data.token) {
                // Store user info in localStorage for persistence
                localStorage.setItem('userInfo', JSON.stringify(data));
                // Set the authorization header for future requests
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                setUser(data);
            }
        } catch (error) {
            // Re-throw the error so the login page can display it
            throw error;
        }
    };

    /**
     * @description Logs out the current user.
     */
    const logout = () => {
        // Remove user info from localStorage
        localStorage.removeItem('userInfo');
        // Remove the authorization header from the API client
        delete apiClient.defaults.headers.common['Authorization'];
        setUser(null);
    };

    // The value that will be provided to all consuming components
    const value = {
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        logout,
    };

    // We render a loading state to prevent the app from rendering before we've checked for a logged-in user
    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};