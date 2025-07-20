import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient, { setupInterceptors } from '../api'; // Import the new setup function

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
    const [isLoading, setIsLoading] = useState(true);

    /**
     * @description Logs out the current user.
     */
    const logout = () => {
        localStorage.removeItem('userInfo');
        delete apiClient.defaults.headers.common['Authorization'];
        setUser(null);
    };

    // This useEffect runs once on app startup to set up the interceptor.
    useEffect(() => {
        // We pass the logout function to the interceptor setup.
        // Now, the apiClient knows how to log a user out if it gets a 401 error.
        setupInterceptors(logout);
    }, []);

    // On initial app load, check if user info is stored in localStorage
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('userInfo');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
                setUser(userData);
            }
        } catch (error) {
            console.error("Failed to parse user info from localStorage", error);
            logout(); // Call logout to clear any corrupted data
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
                localStorage.setItem('userInfo', JSON.stringify(data));
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                setUser(data);
            }
        } catch (error) {
            throw error;
        }
    };

    const value = {
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};