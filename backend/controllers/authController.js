import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

/**
 * @description Generates a JSON Web Token for a given user ID.
 * @param {number} id - The user's ID from the database.
 * @returns {string} The signed JWT.
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your_default_jwt_secret', {
        expiresIn: '1d', // Token will expire in 1 day
    });
};

/**
 * @description Authenticates a user and returns a JWT.
 * @route POST /api/auth/login
 * @access Public
 */
export const loginUser = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];

        // Check if user exists and if the password matches the hashed password in the DB
        if (user && (await bcrypt.compare(password, user.password_hash))) {
            res.json({
                _id: user.id,
                username: user.username,
                role: user.role,
                token: generateToken(user.id),
            });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};