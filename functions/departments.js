/**
 * Departments API - Netlify Function (Mock)
 * Handles department management
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockDepartments = [
  {
    id: '1',
    name: 'Electronics',
    description: 'Electronic items and gadgets',
    manager: 'Manager User',
    manager_id: '2',
    product_count: 15,
    total_revenue: 75000,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Clothing',
    description: 'Clothing and fashion items',
    manager: 'Manager User',
    manager_id: '2',
    product_count: 30,
    total_revenue: 45000,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Food',
    description: 'Food and grocery items',
    manager: 'Admin User',
    manager_id: '1',
    product_count: 50,
    total_revenue: 30000,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
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
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?departments/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId) {
        const dept = mockDepartments.find((d) => d.id === resourceId);
        if (!dept) return errorResponse(404, 'Department not found');
        return successResponse(dept);
      }
      return successResponse(mockDepartments);
    }

    case 'POST': {
      const { name, description } = parseBody(event);
      if (!name) return errorResponse(400, 'Department name is required');
      const newDept = {
        id: String(Date.now()),
        name,
        description: description || null,
        manager: null,
        manager_id: null,
        product_count: 0,
        total_revenue: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return successResponse(newDept, 201, 'Department created successfully');
    }

    case 'PUT': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const dept = mockDepartments.find((d) => d.id === resourceId);
      if (!dept) return errorResponse(404, 'Department not found');
      const updates = parseBody(event);
      const updated = { ...dept, ...updates, id: dept.id, updated_at: new Date().toISOString() };
      return successResponse(updated, 200, 'Department updated successfully');
    }

    case 'DELETE': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const dept = mockDepartments.find((d) => d.id === resourceId);
      if (!dept) return errorResponse(404, 'Department not found');
      return successResponse(null, 200, 'Department deleted successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
