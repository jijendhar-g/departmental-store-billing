/**
 * Customers API - Netlify Function (Mock)
 * Handles customer management, history, and loyalty points
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockCustomers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    address: '123 Main Street, City',
    loyalty_points: 100,
    total_purchases: 15000,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '9876543211',
    address: '456 Oak Avenue, Town',
    loyalty_points: 250,
    total_purchases: 32000,
    is_active: true,
    created_at: '2024-01-05T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '9876543212',
    address: '789 Pine Road, Village',
    loyalty_points: 50,
    total_purchases: 8000,
    is_active: true,
    created_at: '2024-02-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
];

const mockPurchaseHistory = [
  {
    id: '1',
    bill_number: 'BILL-20240101-0001',
    total: 5000,
    net_amount: 5000,
    payment_method: 'cash',
    status: 'completed',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    bill_number: 'BILL-20240102-0002',
    total: 2100,
    net_amount: 2100,
    payment_method: 'card',
    status: 'completed',
    created_at: new Date(Date.now() - 86400000).toISOString(),
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
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?customers/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId && subAction === 'history') {
        const customer = mockCustomers.find((c) => c.id === resourceId);
        if (!customer) return errorResponse(404, 'Customer not found');
        return successResponse({ bills: mockPurchaseHistory, total: mockPurchaseHistory.length });
      }

      if (resourceId && subAction === 'loyalty') {
        const customer = mockCustomers.find((c) => c.id === resourceId);
        if (!customer) return errorResponse(404, 'Customer not found');
        return successResponse({
          customerId: resourceId,
          loyaltyPoints: customer.loyalty_points,
          totalPurchases: customer.total_purchases,
          tier: customer.loyalty_points >= 200 ? 'Gold' : 'Silver',
        });
      }

      if (resourceId) {
        const customer = mockCustomers.find((c) => c.id === resourceId);
        if (!customer) return errorResponse(404, 'Customer not found');
        return successResponse(customer);
      }

      const params = event.queryStringParameters || {};
      const page = parseInt(params.page || '1');
      const limit = parseInt(params.limit || '20');
      const paginated = mockCustomers.slice((page - 1) * limit, page * limit);
      return successResponse({ customers: paginated, total: mockCustomers.length, page, limit });
    }

    case 'POST': {
      const { name, email, phone, address } = parseBody(event);
      if (!name || !phone) {
        return errorResponse(400, 'Name and phone are required');
      }
      const newCustomer = {
        id: String(Date.now()),
        name,
        email: email || null,
        phone,
        address: address || null,
        loyalty_points: 0,
        total_purchases: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return successResponse(newCustomer, 201, 'Customer created successfully');
    }

    case 'PUT': {
      if (!resourceId) return errorResponse(404, 'Route not found');

      if (subAction === 'loyalty') {
        const customer = mockCustomers.find((c) => c.id === resourceId);
        if (!customer) return errorResponse(404, 'Customer not found');
        const { points } = parseBody(event);
        const updated = {
          ...customer,
          loyalty_points: Math.max(0, customer.loyalty_points - parseInt(points || 0)),
          updated_at: new Date().toISOString(),
        };
        return successResponse(updated, 200, `${points} loyalty points redeemed`);
      }

      const customer = mockCustomers.find((c) => c.id === resourceId);
      if (!customer) return errorResponse(404, 'Customer not found');
      const updates = parseBody(event);
      const updated = { ...customer, ...updates, id: customer.id, updated_at: new Date().toISOString() };
      return successResponse(updated, 200, 'Customer updated successfully');
    }

    case 'DELETE': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const customer = mockCustomers.find((c) => c.id === resourceId);
      if (!customer) return errorResponse(404, 'Customer not found');
      return successResponse(null, 200, 'Customer deleted successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
