import bcrypt from 'bcryptjs';
import pool from '../db.js';

/**
 * @description Creates a new user. Now includes audit logging.
 * @route POST /api/users
 * @access Private/Admin
 */
export const createUser = async (req, res) => {
    // Destructure the logAuditEvent function from the request object,
    // which is placed there by our middleware.
    const { logAuditEvent } = req;
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    try {
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

        // --- ADDED: Log the successful creation of a user ---
        // The middleware ensures req.user contains the admin who is performing the action.
        await logAuditEvent('INFO', `New user created: '${username}'`, { createdUser: newUsers[0] });
        res.status(201).json(newUsers[0]);

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error while creating user.' });
    }
};

/**
 * @description Gets all users. This is a read-only action, so no audit log is needed.
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
 * @description Deletes a user by ID. Now includes audit logging.
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
export const deleteUser = async (req, res) => {
    const { logAuditEvent } = req;
    const { id } = req.params;

    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: 'Admin cannot delete their own account.' });
    }

    try {
        const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // --- ADDED: Log the successful deletion of a user ---
        await logAuditEvent('INFO', `User deleted: '${rows[0].username}'`, { deletedUsername: rows[0].username });
        res.json({ message: `User ${rows[0].username} deleted successfully.` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error while deleting user.' });
    }
};