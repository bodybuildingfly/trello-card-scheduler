import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../db.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

// Dynamically import modules after mocks are set up
const pool = (await import('../db.js')).default;
const jwt = (await import('jsonwebtoken')).default;
const { protect, isAdmin } = await import('./authMiddleware.js');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('protect', () => {
    it('should call next() and attach user to req if token is valid', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'user' };
      const mockToken = 'validtoken';
      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue({ id: 1 });
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_SECRET || 'your_default_jwt_secret');
      expect(pool.query).toHaveBeenCalledWith('SELECT id, username, role FROM users WHERE id = $1', [1]);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if no token is provided', async () => {
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token does not start with "Bearer"', async () => {
      req.headers.authorization = 'invalidtoken';
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', async () => {
      req.headers.authorization = 'Bearer invalidtoken';
      jwt.verify.mockImplementation(() => {
        throw new Error('Verification failed');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not found in the database', async () => {
      req.headers.authorization = 'Bearer validtoken';
      jwt.verify.mockReturnValue({ id: 1 });
      pool.query.mockResolvedValue({ rows: [] }); // No user found

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user not found' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('isAdmin', () => {
    it('should call next() if user has "admin" role', () => {
      req.user = { role: 'admin' };
      isAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user does not have "admin" role', () => {
      req.user = { role: 'user' };
      isAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized as an admin' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user is not present', () => {
      isAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized as an admin' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
