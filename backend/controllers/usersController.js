import bcrypt from 'bcryptjs';
import pool from '../db.js';
import logAuditEvent from '../utils/logger.js';
import crypto from 'crypto';
import { z } from 'zod'; // Import zod

// --- Validation Schemas ---
// Define a schema for creating a new user.
const createUserSchema = z.object({
    username: z.string().min(3, { message: "Username must be at least 3 characters long." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
    role: z.enum(['user', 'admin']).optional(), // Role is optional, defaults to 'user'
});


/**
 * @description Creates a new user after validating the input.
 * @route POST /api/users
 * @access Private/Admin
 */
export const createUser = async (req, res) => {
    // Validate the request body against the schema
    const validationResult = createUserSchema.safeParse(req.body);

    if (!validationResult.success) {
        // If validation fails, return a 400 error with the details
        return res.status(400).json({ message: "Invalid input.", errors: validationResult.error.issues });
    }

    const { username, password, role } = validationResult.data;

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

        await logAuditEvent('INFO', `New user created: '${username}'`, { createdUser: newUsers[0] }, req.user);
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

    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: 'Admin cannot delete their own account.' });
    }

    try {
        const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        await logAuditEvent('INFO', `User deleted: '${rows[0].username}'`, { deletedUsername: rows[0].username }, req.user);
        res.json({ message: `User ${rows[0].username} deleted successfully.` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error while deleting user.' });
    }
};

/**
 * @description Resets a user's password to a new random password.
 * @route PUT /api/users/:id/reset-password
 * @access Private/Admin
 */
export const resetPassword = async (req, res) => {
    const { id } = req.params;

    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: 'Admin cannot reset their own password here.' });
    }

    try {
        const tempPassword = crypto.randomBytes(8).toString('hex');
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        const { rows } = await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username',
            [passwordHash, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const targetUsername = rows[0].username;
        await logAuditEvent('INFO', `Password reset for user: '${targetUsername}'`, { targetUser: targetUsername }, req.user);

        res.json({ message: `Password for ${targetUsername} has been reset.`, temporaryPassword: tempPassword });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error while resetting password.' });
    }
};