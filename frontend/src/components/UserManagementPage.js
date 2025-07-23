/**
 * @file frontend/src/components/UserManagementPage.js
 * @description Refactored to use semantic color classes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import { useAuth } from '../context/AuthContext';

// --- Helper Icon Imports ---
const DeleteIcon = () => <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger hover:text-danger-hover"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const PlusIcon = () => <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
const KeyIcon = () => <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning hover:text-warning-hover"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>;

/**
 * @description A modal component to display the new temporary password to the admin.
 * @param {object} props - The component props.
 */
const PasswordResetModal = ({ username, tempPassword, onClose }) => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-surface rounded-xl p-8 shadow-2xl w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">Password Reset Successful</h2>
            <p className="text-text-secondary mb-4">
                The password for user <strong className="font-semibold text-text-primary">{username}</strong> has been reset.
                Please provide them with their new temporary password:
            </p>
            <div className="bg-surface-muted p-4 rounded-lg text-center font-mono text-lg text-text-primary mb-6">
                {tempPassword}
            </div>
            <p className="text-xs text-danger text-center mb-8">
                This is the only time this password will be shown. Please copy it now.
            </p>
            <div className="flex justify-center">
                <button onClick={onClose} className="form-button-primary">Close</button>
            </div>
        </div>
    </div>
);


/**
 * @description A page for administrators to manage application users.
 */
const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // State for the "Add User" form
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('user');

    // State for the password reset modal
    const [resetInfo, setResetInfo] = useState({ show: false, username: '', tempPassword: '' });
    
    const { user: adminUser } = useAuth();

    /**
     * @description Fetches the list of all users from the API.
     */
    const fetchUsers = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/api/users');
            setUsers(data);
        } catch (err) {
            setError('Failed to fetch users.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    /**
     * @description Handles the submission of the "Add User" form.
     * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
     */
    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await apiClient.post('/api/users', { username: newUsername, password: newPassword, role: newRole });
            setSuccess(`User '${newUsername}' created successfully.`);
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            fetchUsers();
        } catch (err) {
            // Check for the detailed validation errors array from the backend
            if (err.response?.data?.errors) {
                const formattedErrors = err.response.data.errors.map(e => e.message).join(' ');
                setError(formattedErrors);
            } else {
                setError(err.response?.data?.message || 'Failed to create user.');
            }
        }
    };

    /**
     * @description Deletes a user after confirming with the admin.
     * @param {number} userId - The ID of the user to delete.
     * @param {string} username - The username of the user to delete.
     */
    const handleDeleteUser = async (userId, username) => {
        if (window.confirm(`Are you sure you want to delete the user "${username}"? This cannot be undone.`)) {
            try {
                await apiClient.delete(`/api/users/${userId}`);
                setSuccess(`User '${username}' deleted successfully.`);
                fetchUsers();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to delete user.');
            }
        }
    };

    /**
     * @description Resets a user's password and displays the new temporary password in a modal.
     * @param {number} userId - The ID of the user whose password will be reset.
     * @param {string} username - The username of the user.
     */
    const handleResetPassword = async (userId, username) => {
        if (window.confirm(`Are you sure you want to reset the password for "${username}"?`)) {
            try {
                const { data } = await apiClient.put(`/api/users/${userId}/reset-password`);
                setResetInfo({ show: true, username: username, tempPassword: data.temporaryPassword });
                setSuccess(data.message);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to reset password.');
            }
        }
    };

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <>
            {resetInfo.show && (
                <PasswordResetModal 
                    username={resetInfo.username} 
                    tempPassword={resetInfo.tempPassword} 
                    onClose={() => setResetInfo({ show: false, username: '', tempPassword: '' })}
                />
            )}
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="bg-surface p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-semibold text-text-primary mb-4">Add New User</h2>
                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="form-label">Username</label>
                            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="form-input" required />
                        </div>
                        <div className="md:col-span-1">
                            <label className="form-label">Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" required />
                        </div>
                        <div className="md:col-span-1">
                            <label className="form-label">Role</label>
                            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="form-input">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <button type="submit" className="form-button-primary w-full flex items-center justify-center">
                                <PlusIcon /> <span className="ml-2">Add User</span>
                            </button>
                        </div>
                    </form>
                    {error && <p className="text-danger mt-4 text-center">{error}</p>}
                    {success && <p className="text-success mt-4 text-center">{success}</p>}
                </div>

                <div className="bg-surface p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-semibold text-text-primary mb-4">Existing Users</h2>
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-surface-hover">
                                <div>
                                    <p className="font-bold text-text-primary">{user.username}</p>
                                    <p className="text-sm text-text-muted">Role: <span className="font-medium capitalize">{user.role}</span></p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {adminUser.username !== user.username && (
                                        <>
                                            <button onClick={() => handleResetPassword(user.id, user.username)} className="p-2 rounded-full hover:bg-yellow-100" title="Reset Password">
                                                <KeyIcon />
                                            </button>
                                            <button onClick={() => handleDeleteUser(user.id, user.username)} className="p-2 rounded-full hover:bg-red-100" title="Delete User">
                                                <DeleteIcon />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserManagementPage;