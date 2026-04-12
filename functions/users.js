/**
 * Users API - Netlify Function (Mock)
 * Handles user management (admin only)
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@store.com',
    role: 'admin',
    department_id: null,
    department_name: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Manager User',
    email: 'manager@store.com',
    role: 'manager',
    department_id: '1',
    department_name: 'Electronics',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    name: 'Cashier User',
    email: 'cashier@store.com',
    role: 'cashier',
    department_id: '2',
    department_name: 'Clothing',
    is_active: true,
    created_at: '2024-01-05T00:00:00.000Z',
    last_login: new Date(Date.now() - 7200000).toISOString(),
  },
];

const successResponse = (data, statusCode = 200, message = null) => {
  const body = { success: true, timestamp: new Date().toISOString() };
  if (message) body.message = message;
  if (data !== undefined && data !== null) body.data = data;
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
};

const errorResponse = (statusCode, message) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: false, error: message, timestamp: new Date().toISOString() }),
});

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const { httpMethod, path } = event;
  const pathSegments = path
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?users/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId) {
        const user = mockUsers.find((u) => u.id === resourceId);
        if (!user) return errorResponse(404, 'User not found');
        return successResponse(user);
      }
      return successResponse(mockUsers);
    }

    case 'POST': {
      const { name, email, role, department_id } = parseBody(event);
      if (!name || !email || !role) {
        return errorResponse(400, 'Name, email, and role are required');
      }
      const validRoles = ['admin', 'manager', 'cashier'];
      if (!validRoles.includes(role)) {
        return errorResponse(400, `Role must be one of: ${validRoles.join(', ')}`);
      }
      if (mockUsers.find((u) => u.email === email.toLowerCase())) {
        return errorResponse(409, 'Email already registered');
      }
      const newUser = {
        id: String(Date.now()),
        name,
        email: email.toLowerCase(),
        role,
        department_id: department_id || null,
        department_name: null,
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: null,
      };
      return successResponse(newUser, 201, 'User created successfully');
    }

    case 'PUT': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const user = mockUsers.find((u) => u.id === resourceId);
      if (!user) return errorResponse(404, 'User not found');
      const updates = parseBody(event);
      const updated = { ...user, ...updates, id: user.id };
      return successResponse(updated, 200, 'User updated successfully');
    }

    case 'DELETE': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const user = mockUsers.find((u) => u.id === resourceId);
      if (!user) return errorResponse(404, 'User not found');
      return successResponse(null, 200, 'User deleted successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
