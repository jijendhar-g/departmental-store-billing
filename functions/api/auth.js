/**
 * Authentication API - Netlify Function
 * Handles user login, logout, token refresh, and password management
 */

const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { generateToken, verifyToken } = require('../middleware/auth');
const {
  withErrorHandling,
  successResponse,
  errorResponse,
  parseBody,
} = require('../middleware/errorHandler');

const handler = async (event) => {
  const { httpMethod, path } = event;
const pathSegments = path
  .replace(/^\/(\.netlify\/functions\/)?api\/auth/, '')
  .split('/')
  .filter(Boolean);
  const action = pathSegments[0];

  switch (httpMethod) {
    case 'POST': {
      if (action === 'login') {
        return handleLogin(event);
      }
      if (action === 'logout') {
        return handleLogout(event);
      }
      if (action === 'refresh') {
        return handleRefreshToken(event);
      }
      if (action === 'change-password') {
        return handleChangePassword(event);
      }
      if (action === 'register') {
        return handleRegister(event);
      }
      break;
    }
    case 'GET': {
      if (action === 'me') {
        return handleGetProfile(event);
      }
      break;
    }
    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const handleLogin = async (event) => {
  const { email, password } = parseBody(event);

  if (!email || !password) {
    return errorResponse(400, 'Email and password are required');
  }

  const result = await query(
    `SELECT id, name, email, password_hash, role, is_active, department_id
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return errorResponse(401, 'Invalid email or password');
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return errorResponse(401, 'Account is disabled. Contact administrator.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return errorResponse(401, 'Invalid email or password');
  }

  // Update last login timestamp
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    departmentId: user.department_id,
  };

  const token = generateToken(tokenPayload, '24h');
  const refreshToken = generateToken({ userId: user.id, type: 'refresh' }, '7d');

  return successResponse(
    {
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id,
      },
    },
    200,
    'Login successful'
  );
};

const handleLogout = async (event) => {
  // In a stateless JWT setup, logout is handled client-side
  // Optionally, add token to a blacklist in the database
  return successResponse(null, 200, 'Logged out successfully');
};

const handleRefreshToken = async (event) => {
  const { refreshToken } = parseBody(event);

  if (!refreshToken) {
    return errorResponse(400, 'Refresh token is required');
  }

  try {
    const decoded = verifyToken({ headers: { authorization: `Bearer ${refreshToken}` } });

    if (decoded.type !== 'refresh') {
      return errorResponse(401, 'Invalid refresh token');
    }

    const result = await query(
      'SELECT id, name, email, role, is_active, department_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return errorResponse(401, 'User not found or account disabled');
    }

    const user = result.rows[0];
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      departmentId: user.department_id,
    }, '24h');

    return successResponse({ token: newToken }, 200, 'Token refreshed');
  } catch {
    return errorResponse(401, 'Invalid or expired refresh token');
  }
};

const handleGetProfile = async (event) => {
  const decoded = verifyToken(event);

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.department_id, u.created_at, u.last_login,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = $1`,
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  return successResponse(result.rows[0]);
};

const handleChangePassword = async (event) => {
  const decoded = verifyToken(event);
  const { currentPassword, newPassword } = parseBody(event);

  if (!currentPassword || !newPassword) {
    return errorResponse(400, 'Current password and new password are required');
  }

  if (newPassword.length < 8) {
    return errorResponse(400, 'New password must be at least 8 characters');
  }

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [decoded.userId]);

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  const passwordMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!passwordMatch) {
    return errorResponse(401, 'Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    newHash,
    decoded.userId,
  ]);

  return successResponse(null, 200, 'Password changed successfully');
};

const handleRegister = async (event) => {
  // Only admins can register new users (checked via token)
  const decoded = verifyToken(event);

  if (decoded.role !== 'admin') {
    return errorResponse(403, 'Only administrators can register new users');
  }

  const { name, email, password, role, departmentId } = parseBody(event);

  if (!name || !email || !password || !role) {
    return errorResponse(400, 'Name, email, password, and role are required');
  }

  const validRoles = ['admin', 'manager', 'cashier'];
  if (!validRoles.includes(role)) {
    return errorResponse(400, `Role must be one of: ${validRoles.join(', ')}`);
  }

  if (password.length < 8) {
    return errorResponse(400, 'Password must be at least 8 characters');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return errorResponse(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, department_id, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, true, NOW())
     RETURNING id, name, email, role, department_id, created_at`,
    [name, email.toLowerCase(), passwordHash, role, departmentId || null]
  );

  return successResponse(result.rows[0], 201, 'User registered successfully');
};

exports.handler = withErrorHandling(handler);
