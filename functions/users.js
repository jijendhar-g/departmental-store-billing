/**
 * Users Management Handler - Netlify Serverless Function
 * Handles user listing, creation, updates, deletion, and activity logs
 * Available at /.netlify/functions/users
 */

const bcrypt = require('bcryptjs');
const { query } = require('./database');
const { verifyToken, requireRole } = require('./middleware/auth');
const {
  withErrorHandling,
  successResponse,
  errorResponse,
  parseBody,
  getQueryParams,
} = require('./middleware/errorHandler');

const handler = async (event) => {
  const { httpMethod, path } = event;
  const pathSegments = path.replace(/^\/(\.netlify\/functions\/)?(?:api\/)?users/, '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  const user = verifyToken(event);
  requireRole(user, ['admin', 'manager']);

  switch (httpMethod) {
    case 'GET':
      if (resourceId && subAction === 'activity') {
        return getUserActivity(resourceId, event);
      }
      if (resourceId) {
        return getUserById(resourceId);
      }
      return getUsers(event);

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

const getUsers = async (event) => {
  const { page = 1, limit = 20, role, search, departmentId } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE u.is_active = true';
  const params = [];

  if (role) {
    params.push(role);
    whereClause += ` AND u.role = $${params.length}`;
  }

  if (departmentId) {
    params.push(departmentId);
    whereClause += ` AND u.department_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.department_id,
            d.name AS department_name, u.is_active, u.last_login, u.created_at
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

const getUserById = async (userId) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.department_id,
            d.name AS department_name, u.is_active, u.last_login,
            u.created_at, u.updated_at
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

const updateUser = async (userId, event) => {
  const { name, email, role, departmentId, isActive } = parseBody(event);

  const result = await query(
    `UPDATE users SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       role = COALESCE($3, role),
       department_id = COALESCE($4, department_id),
       is_active = COALESCE($5, is_active),
       updated_at = NOW()
     WHERE id = $6
     RETURNING id, name, email, role, department_id, is_active, updated_at`,
    [name, email ? email.toLowerCase() : null, role, departmentId, isActive, userId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  return successResponse(result.rows[0], 200, 'User updated successfully');
};

const deleteUser = async (userId, requestingUser) => {
  if (userId === requestingUser.userId) {
    return errorResponse(400, 'You cannot delete your own account');
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

const getUserActivity = async (userId, event) => {
  const { page = 1, limit = 20 } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    return errorResponse(404, 'User not found');
  }

  const billsResult = await query(
    `SELECT 'bill' AS activity_type, b.id, b.bill_number AS reference,
            b.net_amount AS amount, b.status, b.created_at
     FROM bills b
     WHERE b.cashier_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, parseInt(limit), offset]
  );

  const statsResult = await query(
    `SELECT COUNT(*) AS total_bills,
            COALESCE(SUM(net_amount), 0) AS total_revenue,
            COALESCE(AVG(net_amount), 0) AS avg_bill_value
     FROM bills
     WHERE cashier_id = $1 AND status = 'completed'`,
    [userId]
  );

  return successResponse({
    activities: billsResult.rows,
    stats: statsResult.rows[0],
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

exports.handler = withErrorHandling(handler);
