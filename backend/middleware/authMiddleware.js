import jwt from 'jsonwebtoken';
import pool from '../db.js';

/**
 * @description Middleware to protect routes by verifying a JSON Web Token (JWT).
 * It checks for a token in the 'Authorization' header, verifies it, and attaches
 * the decoded user payload to the request object.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 */
export const protect = async (req, res, next) => {
    let token;

    // Check for a token in the Authorization header (e.g., 'Bearer <token>')
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract the token from the header
            token = req.headers.authorization.split(' ')[1];

            // Verify the token using a secret key. We'll need to add this to our settings.
            // For now, we can use a placeholder or an environment variable.
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_default_jwt_secret');

            // Find the user by the ID from the token payload and attach it to the request.
            // This makes the user's info available to all subsequent protected routes.
            const { rows } = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
            
            if (rows.length === 0) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = rows[0];
            next(); // Proceed to the next middleware or route handler

        } catch (error) {
            console.error('Token verification failed:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

/**
 * @description Middleware to check if the authenticated user has the 'admin' role.
 * This should be used *after* the `protect` middleware.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 */
export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next(); // User is an admin, proceed
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' }); // 403 Forbidden
    }
};
