/**
 * Departments API - Netlify Function
 * Handles department management
 */

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
  const pathSegments = path.replace(/^\/(\.netlify\/functions\/)?(?:api\/)?departments/, '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];

  const user = verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId) {
        return getDepartmentById(resourceId);
      }
      return getDepartments(event);

    case 'POST':
      requireRole(user, ['admin']);
      return createDepartment(event);

    case 'PUT':
      if (resourceId) {
        requireRole(user, ['admin']);
        return updateDepartment(resourceId, event);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        requireRole(user, ['admin']);
        return deleteDepartment(resourceId);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getDepartments = async (event) => {
  const { includeStats } = getQueryParams(event);

  let sql = `
    SELECT d.id, d.name, d.description, d.manager_id,
           u.name AS manager_name, d.is_active, d.created_at
    FROM departments d
    LEFT JOIN users u ON d.manager_id = u.id
    WHERE d.is_active = true
    ORDER BY d.name ASC`;

  if (includeStats === 'true') {
    sql = `
      SELECT d.id, d.name, d.description, d.manager_id,
             u.name AS manager_name, d.is_active,
             COUNT(DISTINCT p.id) AS product_count,
             COALESCE(SUM(p.stock_quantity * p.price), 0) AS inventory_value
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      LEFT JOIN products p ON p.department_id = d.id AND p.is_active = true
      WHERE d.is_active = true
      GROUP BY d.id, d.name, d.description, d.manager_id, u.name, d.is_active
      ORDER BY d.name ASC`;
  }

  const result = await query(sql);
  return successResponse(result.rows);
};

const getDepartmentById = async (departmentId) => {
  const result = await query(
    `SELECT d.*, u.name AS manager_name,
            COUNT(DISTINCT p.id) AS product_count,
            COUNT(DISTINCT emp.id) AS employee_count
     FROM departments d
     LEFT JOIN users u ON d.manager_id = u.id
     LEFT JOIN products p ON p.department_id = d.id AND p.is_active = true
     LEFT JOIN users emp ON emp.department_id = d.id AND emp.is_active = true
     WHERE d.id = $1
     GROUP BY d.id, u.name`,
    [departmentId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Department not found');
  }

  return successResponse(result.rows[0]);
};

const createDepartment = async (event) => {
  const { name, description, managerId } = parseBody(event);

  if (!name) {
    return errorResponse(400, 'Department name is required');
  }

  const existing = await query('SELECT id FROM departments WHERE name = $1', [name]);
  if (existing.rows.length > 0) {
    return errorResponse(409, 'Department with this name already exists');
  }

  const result = await query(
    `INSERT INTO departments (name, description, manager_id, is_active, created_at)
     VALUES ($1, $2, $3, true, NOW())
     RETURNING *`,
    [name, description || null, managerId || null]
  );

  return successResponse(result.rows[0], 201, 'Department created successfully');
};

const updateDepartment = async (departmentId, event) => {
  const { name, description, managerId, isActive } = parseBody(event);

  const result = await query(
    `UPDATE departments SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       manager_id = COALESCE($3, manager_id),
       is_active = COALESCE($4, is_active),
       updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [name, description, managerId, isActive, departmentId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Department not found');
  }

  return successResponse(result.rows[0], 200, 'Department updated successfully');
};

const deleteDepartment = async (departmentId) => {
  const productsResult = await query(
    'SELECT COUNT(*) FROM products WHERE department_id = $1 AND is_active = true',
    [departmentId]
  );

  if (parseInt(productsResult.rows[0].count) > 0) {
    return errorResponse(400, 'Cannot delete department with active products. Reassign products first.');
  }

  const result = await query(
    'UPDATE departments SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [departmentId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Department not found');
  }

  return successResponse(null, 200, 'Department deactivated successfully');
};

exports.handler = withErrorHandling(handler);
