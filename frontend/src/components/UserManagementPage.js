import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import { useAuth } from '../context/AuthContext';

// --- Helper Icon Imports ---
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 hover:text-red-700"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;

/**
 * @description A page for administrators to manage application users.
 * It allows for creating, viewing, and deleting users.
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
    
    const { user: adminUser } = useAuth(); // Get the currently logged-in admin's info

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
            // Reset form and refresh the user list
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create user.');
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
                fetchUsers(); // Refresh the list
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to delete user.');
            }
        }
    };

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* --- Add User Form --- */}
            <div className="bg-white p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Add New User</h2>
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
                {error && <p className="text-red-600 mt-4 text-center">{error}</p>}
                {success && <p className="text-green-600 mt-4 text-center">{success}</p>}
            </div>

            {/* --- User List --- */}
            <div className="bg-white p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Existing Users</h2>
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                            <div>
                                <p className="font-bold text-slate-800">{user.username}</p>
                                <p className="text-sm text-slate-500">Role: <span className="font-medium capitalize">{user.role}</span></p>
                            </div>
                            <div>
                                {/* Prevent an admin from deleting themselves */}
                                {adminUser.username !== user.username && (
                                    <button onClick={() => handleDeleteUser(user.id, user.username)} className="p-2 rounded-full hover:bg-red-100">
                                        <DeleteIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserManagementPage;