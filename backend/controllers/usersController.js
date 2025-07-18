import bcrypt from 'bcryptjs';
import pool from '../db.js';

/**
 * @description Creates a new user.
 * @route POST /api/users
 * @access Private/Admin
 */
export const createUser = async (req, res) => {
    const { username, password, role } = req.body;
    const { logAuditEvent } = req;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    try {
        // Check if user already exists
        const { rows: existingUsers } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'User with that username already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const { rows: newUsers } = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
            [username, passwordHash, role || 'user']
        );

        await logAuditEvent('INFO', `New user created by admin ${req.user.username}: ${username}`, { createdUser: newUsers[0] });
        res.status(201).json(newUsers[0]);

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error while creating user.' });
    }
};

/**
 * @description Gets all users.
 * @route GET /api/users
 * @access Private/Admin
 */
export const getAllUsers = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
};

/**
 * @description Deletes a user by ID.
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    const { logAuditEvent } = req;

    // Prevent admin from deleting themselves
    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: 'Admin cannot delete their own account.' });
    }

    try {
        const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await logAuditEvent('INFO', `User deleted by admin ${req.user.username}: ${rows[0].username}`);
        res.json({ message: `User ${rows[0].username} deleted successfully.` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error while deleting user.' });
    }
};