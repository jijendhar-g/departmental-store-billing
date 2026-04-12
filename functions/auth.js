/**
 * Authentication API - Netlify Function (Mock)
 * Handles user login, logout, token refresh, and password management
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockUsers = {
  'admin@store.com': {
    id: '1',
    name: 'Admin User',
    email: 'admin@store.com',
    password: 'Admin@123456',
    role: 'admin',
    department_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date().toISOString(),
  },
  'manager@store.com': {
    id: '2',
    name: 'Manager User',
    email: 'manager@store.com',
    password: 'Manager@123456',
    role: 'manager',
    department_id: '1',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date().toISOString(),
  },
  'cashier@store.com': {
    id: '3',
    name: 'Cashier User',
    email: 'cashier@store.com',
    password: 'Cashier@123456',
    role: 'cashier',
    department_id: '2',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date().toISOString(),
  },
};

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

const generateMockToken = (userId) =>
  Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64');

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
};

const getAuthUser = (event) => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const { httpMethod, path } = event;
  const pathSegments = path
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?auth/, '')
    .split('/')
    .filter(Boolean);
  const action = pathSegments[0];

  if (httpMethod === 'POST') {
    if (action === 'login') {
      const { email, password } = parseBody(event);

      if (!email || !password) {
        return errorResponse(400, 'Email and password are required');
      }

      const user = mockUsers[email.toLowerCase().trim()];

      if (!user || !user.is_active) {
        return errorResponse(401, 'Invalid email or password');
      }

      if (user.password !== password) {
        return errorResponse(401, 'Invalid email or password');
      }

      const token = generateMockToken(user.id);
      const refreshToken = generateMockToken(`refresh-${user.id}`);

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
    }

    if (action === 'logout') {
      return successResponse(null, 200, 'Logged out successfully');
    }

    if (action === 'refresh') {
      const { refreshToken } = parseBody(event);
      if (!refreshToken) {
        return errorResponse(400, 'Refresh token is required');
      }
      const user = Object.values(mockUsers)[0];
      const token = generateMockToken(user.id);
      return successResponse({ token }, 200, 'Token refreshed');
    }

    if (action === 'change-password') {
      const decoded = getAuthUser(event);
      if (!decoded) return errorResponse(401, 'Authorization token is required');
      const { currentPassword, newPassword } = parseBody(event);
      if (!currentPassword || !newPassword) {
        return errorResponse(400, 'Current password and new password are required');
      }
      if (newPassword.length < 8) {
        return errorResponse(400, 'New password must be at least 8 characters');
      }
      return successResponse(null, 200, 'Password changed successfully');
    }

    if (action === 'register') {
      const decoded = getAuthUser(event);
      if (!decoded) return errorResponse(401, 'Authorization token is required');
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
      if (mockUsers[email.toLowerCase()]) {
        return errorResponse(409, 'Email already registered');
      }
      const newUser = {
        id: String(Date.now()),
        name,
        email: email.toLowerCase(),
        role,
        department_id: departmentId || null,
        created_at: new Date().toISOString(),
      };
      return successResponse(newUser, 201, 'User registered successfully');
    }
  }

  if (httpMethod === 'GET' && action === 'me') {
    const decoded = getAuthUser(event);
    if (!decoded) return errorResponse(401, 'Authorization token is required');
    const user = Object.values(mockUsers).find((u) => u.id === String(decoded.userId)) ||
      Object.values(mockUsers)[0];
    const { password: _pwd, ...safeUser } = user;
    return successResponse(safeUser);
  }

  return errorResponse(404, 'Route not found');
};
