/**
 * Users API - Netlify Function
 * Handles user management, roles, and profile updates
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
  const pathSegments = path
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?users/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

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
      if (resourceId && subAction === 'reset-password') {
        requireRole(user, ['admin']);
        return resetUserPassword(resourceId, event);
      }
      if (resourceId) {
        return updateUser(resourceId, event, user);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        requireRole(user, ['admin']);
        return deactivateUser(resourceId, user);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getUsers = async (event, requestingUser) => {
  requireRole(requestingUser, ['admin', 'manager']);

  const { page = 1, limit = 20, role, department, search, isActive } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (role) {
    params.push(role);
    whereClause += ` AND u.role = $${params.length}`;
  }

  if (department) {
    params.push(department);
    whereClause += ` AND u.department_id = $${params.length}`;
  }

  if (isActive !== undefined) {
    params.push(isActive === 'true');
    whereClause += ` AND u.is_active = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active,
            u.department_id, d.name AS department_name,
            u.last_login, u.created_at, u.updated_at
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     ${whereClause}
     ORDER BY u.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM users u ${whereClause}`,
    params.slice(0, -2)
  );

  return successResponse({
    users: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getUserById = async (userId, requestingUser) => {
  if (requestingUser.role !== 'admin' && requestingUser.role !== 'manager'
      && requestingUser.userId !== userId) {
    return errorResponse(403, 'Insufficient permissions');
  }

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active,
            u.department_id, d.name AS department_name,
            u.last_login, u.created_at, u.updated_at
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
     RETURNING id, name, email, role, department_id, is_active, created_at`,
    [name, email.toLowerCase(), passwordHash, role, departmentId || null]
  );

  return successResponse(result.rows[0], 201, 'User created successfully');
};

const updateUser = async (userId, event, requestingUser) => {
  if (requestingUser.role !== 'admin' && requestingUser.userId !== userId) {
    return errorResponse(403, 'Insufficient permissions');
  }

  const { name, email, departmentId, role, isActive } = parseBody(event);

  // Non-admin users cannot change their own role or active status
  if (requestingUser.role !== 'admin' && (role !== undefined || isActive !== undefined)) {
    return errorResponse(403, 'Only admins can change role or active status');
  }

  if (role) {
    const validRoles = ['admin', 'manager', 'cashier'];
    if (!validRoles.includes(role)) {
      return errorResponse(400, `Role must be one of: ${validRoles.join(', ')}`);
    }
  }

  const result = await query(
    `UPDATE users SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       department_id = COALESCE($3, department_id),
       role = COALESCE($4, role),
       is_active = COALESCE($5, is_active),
       updated_at = NOW()
     WHERE id = $6
     RETURNING id, name, email, role, department_id, is_active, updated_at`,
    [name, email ? email.toLowerCase() : null, departmentId, role, isActive, userId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  return successResponse(result.rows[0], 200, 'User updated successfully');
};

const resetUserPassword = async (userId, event) => {
  const { newPassword } = parseBody(event);

  if (!newPassword) {
    return errorResponse(400, 'New password is required');
  }

  if (newPassword.length < 8) {
    return errorResponse(400, 'Password must be at least 8 characters');
  }

  const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );

  return successResponse(null, 200, 'Password reset successfully');
};

const deactivateUser = async (userId, requestingUser) => {
  if (requestingUser.userId === userId) {
    return errorResponse(400, 'Cannot deactivate your own account');
  }

  const result = await query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [userId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  return successResponse(null, 200, 'User deactivated successfully');
};

exports.handler = withErrorHandling(handler);
