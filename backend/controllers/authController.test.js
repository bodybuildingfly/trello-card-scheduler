import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies using the modern API for ES Modules
jest.unstable_mockModule('../db.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    compare: jest.fn(),
  },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(),
  },
}));

jest.unstable_mockModule('crypto', () => ({
  default: {
    randomBytes: jest.fn().mockReturnValue({ toString: () => 'mockrefreshtoken' }),
  },
}));

// Dynamically import modules after mocks are set up
const pool = (await import('../db.js')).default;
const bcrypt = (await import('bcryptjs')).default;
const jwt = (await import('jsonwebtoken')).default;
const crypto = (await import('crypto')).default;
const { loginUser, refreshToken, logoutUser } = await import('./authController.js');


describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
  });

  describe('loginUser', () => {
    it('should login a user successfully and return a token', async () => {
      req = {
        body: { username: 'testuser', password: 'password123' },
      };
      const mockUser = { id: 1, username: 'testuser', password_hash: 'hashedpassword', role: 'user' };
      const mockToken = 'mocktoken';

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce(mockToken);

      await loginUser(req, res);

      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE username = $1', ['testuser']);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'mockrefreshtoken', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        _id: 1,
        username: 'testuser',
        role: 'user',
        token: mockToken,
      });
    });

    it('should return 401 for invalid credentials (user not found)', async () => {
        req = {
            body: { username: 'wronguser', password: 'password123' },
        };

        pool.query.mockResolvedValueOnce({ rows: [] });

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid username or password' });
    });

    it('should return 401 for invalid credentials (wrong password)', async () => {
        req = {
            body: { username: 'testuser', password: 'wrongpassword' },
        };
        const mockUser = { id: 1, username: 'testuser', password_hash: 'hashedpassword' };

        pool.query.mockResolvedValueOnce({ rows: [mockUser] });
        bcrypt.compare.mockResolvedValueOnce(false);

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid username or password' });
    });

    it('should return 400 if username or password is not provided', async () => {
        req = {
            body: { username: 'testuser' }, // Missing password
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Please provide a username and password.' });
    });

    it('should return 500 for server errors', async () => {
        req = {
            body: { username: 'testuser', password: 'password123' },
        };
        pool.query.mockRejectedValueOnce(new Error('DB error'));

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Server error during login.' });
    });
  });

  describe('refreshToken', () => {
    it('should refresh a token successfully', async () => {
        req = {
            cookies: { refreshToken: 'validrefreshtoken' },
        };
        const mockUser = { id: 1, refresh_token_expires_at: new Date(Date.now() + 100000) };
        const mockToken = 'newmocktoken';

        pool.query.mockResolvedValueOnce({ rows: [mockUser] });
        jwt.sign.mockReturnValueOnce(mockToken);

        await refreshToken(req, res);

        expect(pool.query).toHaveBeenCalledWith('SELECT id, refresh_token_expires_at FROM users WHERE refresh_token = $1', ['validrefreshtoken']);
        expect(res.json).toHaveBeenCalledWith({ _id: 1, token: mockToken });
    });

    it('should return 401 if refresh token is not found', async () => {
        req = {
            cookies: {}, // No refresh token
        };

        await refreshToken(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Refresh token not found.' });
    });

    it('should return 403 for an invalid or expired refresh token', async () => {
        req = {
            cookies: { refreshToken: 'expiredrefreshtoken' },
        };

        pool.query.mockResolvedValueOnce({ rows: [] }); // No user found for token

        await refreshToken(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired refresh token.' });
    });

    it('should return 500 for server errors', async () => {
        req = {
            cookies: { refreshToken: 'validrefreshtoken' },
        };
        pool.query.mockRejectedValueOnce(new Error('DB error'));

        await refreshToken(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Server error during token refresh.' });
    });
  });

  describe('logoutUser', () => {
    it('should log out a user successfully', async () => {
        req = {
            cookies: { refreshToken: 'validrefreshtoken' },
        };
        pool.query.mockResolvedValueOnce({ rowCount: 1 }); // Assume one user was updated

        await logoutUser(req, res);

        expect(pool.query).toHaveBeenCalledWith('UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE refresh_token = $1', ['validrefreshtoken']);
        expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully.' });
    });

    it('should handle logout even if no refresh token is provided', async () => {
        req = {
            cookies: {}, // No refresh token
        };

        await logoutUser(req, res);

        expect(pool.query).not.toHaveBeenCalled(); // No DB call should be made
        expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully.' });
    });

    it('should return 500 for server errors', async () => {
        req = {
            cookies: { refreshToken: 'validrefreshtoken' },
        };
        pool.query.mockRejectedValueOnce(new Error('DB error'));

        await logoutUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Server error during logout.' });
    });
  });
});
