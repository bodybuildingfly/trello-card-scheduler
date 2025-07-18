import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * @description A component that renders a login form.
 * It uses the AuthContext to handle the login logic.
 */
const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    /**
     * @description Handles the form submission, calls the login function from the context,
     * and manages loading and error states.
     * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
            // On successful login, the AuthProvider will handle redirecting
            // or re-rendering the app, so we don't need to do anything here.
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
            setError(errorMessage);
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md mx-4">
                <h1 className="text-4xl font-bold text-slate-900 text-center mb-2">Welcome Back</h1>
                <p className="text-slate-500 text-center mb-8">Please sign in to continue</p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="form-label">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="form-input"
                            placeholder="Enter your username"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-input"
                            placeholder="Enter your password"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    <div>
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300"
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;