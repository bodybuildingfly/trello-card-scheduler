import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db.js';

/**
 * @description Generates an Access Token (short-lived).
 * @param {number} id - The user's ID.
 * @returns {string} The signed JWT.
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your_default_jwt_secret', {
        expiresIn: '15m', // Access token expires in 15 minutes
    });
};

/**
 * @description Authenticates a user and returns an access token, while setting a refresh token in an HttpOnly cookie.
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

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            // --- Refresh Token Logic ---
            const refreshToken = crypto.randomBytes(64).toString('hex');
            const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

            // Store the raw refresh token for direct lookup. The token's entropy and HttpOnly cookie provide security.
            await pool.query(
                'UPDATE users SET refresh_token = $1, refresh_token_expires_at = $2 WHERE id = $3',
                [refreshToken, refreshTokenExpiresAt, user.id]
            );

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                expires: refreshTokenExpiresAt,
            });
            // --- End Refresh Token Logic ---

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

/**
 * @description Issues a new access token using a valid refresh token.
 * @route POST /api/auth/refresh
 * @access Public
 */
export const refreshToken = async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found.' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, refresh_token_expires_at FROM users WHERE refresh_token = $1',
            [refreshToken]
        );

        const user = rows[0];

        if (!user || new Date() > new Date(user.refresh_token_expires_at)) {
            return res.status(403).json({ message: 'Invalid or expired refresh token.' });
        }

        res.json({
            _id: user.id,
            token: generateToken(user.id),
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Server error during token refresh.' });
    }
};

/**
 * @description Logs out a user by clearing their refresh token.
 * @route POST /api/auth/logout
 * @access Public
 */
export const logoutUser = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (refreshToken) {
            // If a refresh token exists, find the user and invalidate it.
            await pool.query(
                'UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE refresh_token = $1',
                [refreshToken]
            );
        }

        // Always clear the refresh token cookie, even if one wasn't found in the DB.
        res.cookie('refreshToken', '', {
            httpOnly: true,
            expires: new Date(0),
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout.' });
    }
};