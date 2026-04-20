/**
 * Users API - Netlify Function
 * Handles user management (admin only)
 */

const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  withErrorHandling,
  successResponse,
  errorResponse,
  parseBody,
  getQueryParams,
} = require('../middleware/errorHandler');

const handler = async (event) => {
  const { httpMethod, path } = event;
  const pathSegments = path.replace('/.netlify/functions/api/users', '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];

  const user = verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId) {
        return getUserById(resourceId, user);
      }
      return getUsers(event, user);

    case 'POST':
      requireRole(user, ['admin']);
      return createUser(event);

    case 'PUT':
      if (resourceId) {
        requireRole(user, ['admin']);
        return updateUser(resourceId, event);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        requireRole(user, ['admin']);
        return deleteUser(resourceId, user);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getUsers = async (event, requestingUser) => {
  requireRole(requestingUser, ['admin', 'manager']);

  const { page = 1, limit = 50, role, search } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (role) {
    params.push(role);
    whereClause += ` AND u.role = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const countResult = await query(
    `SELECT COUNT(*) FROM users u ${whereClause}`,
    countParams
  );

  return successResponse({
    users: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countResult.rows[0].count),
    },
  });
};

const getUserById = async (userId, requestingUser) => {
  // Users can view their own profile; admins/managers can view any user
  if (String(requestingUser.userId) !== String(userId)) {
    requireRole(requestingUser, ['admin', 'manager']);
  }

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.department_id,
            u.created_at, u.last_login, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  return successResponse(result.rows[0]);
};

const createUser = async (event) => {
  const { name, email, password, role, departmentId, isActive = true } = parseBody(event);

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
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, name, email, role, department_id, is_active, created_at`,
    [name, email.toLowerCase(), passwordHash, role, departmentId || null, isActive]
  );

  return successResponse(result.rows[0], 201, 'User created successfully');
};

const updateUser = async (userId, event) => {
  const { name, email, role, departmentId, isActive } = parseBody(event);

  const existing = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (existing.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    params.push(name);
    updates.push(`name = $${params.length}`);
  }
  if (email !== undefined) {
    const emailExists = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [
      email.toLowerCase(),
      userId,
    ]);
    if (emailExists.rows.length > 0) {
      return errorResponse(409, 'Email already in use by another user');
    }
    params.push(email.toLowerCase());
    updates.push(`email = $${params.length}`);
  }
  if (role !== undefined) {
    const validRoles = ['admin', 'manager', 'cashier'];
    if (!validRoles.includes(role)) {
      return errorResponse(400, `Role must be one of: ${validRoles.join(', ')}`);
    }
    params.push(role);
    updates.push(`role = $${params.length}`);
  }
  if (departmentId !== undefined) {
    params.push(departmentId);
    updates.push(`department_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    updates.push(`is_active = $${params.length}`);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'No fields to update');
  }

  params.push(userId);
  updates.push(`updated_at = NOW()`);

  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, email, role, department_id, is_active, updated_at`,
    params
  );

  return successResponse(result.rows[0], 200, 'User updated successfully');
};

const deleteUser = async (userId, requestingUser) => {
  if (requestingUser.userId === userId) {
    return errorResponse(400, 'You cannot delete your own account');
  }

  const existing = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (existing.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  // Soft delete - deactivate the user instead of hard delete
  await query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [userId]);

  return successResponse(null, 200, 'User deactivated successfully');
};

exports.handler = withErrorHandling(handler);
