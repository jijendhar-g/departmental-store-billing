/**
 * Billing API - Netlify Function (Mock)
 * Handles bill creation, retrieval, updates, and returns
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockBills = [
  {
    id: '1',
    bill_number: 'BILL-20240101-0001',
    customer_id: '1',
    customer_name: 'John Doe',
    customer_phone: '9876543210',
    cashier_id: '3',
    cashier_name: 'Cashier User',
    total_amount: 4500,
    discount_amount: 0,
    tax_amount: 500,
    net_amount: 5000,
    payment_method: 'cash',
    status: 'completed',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: '1',
        product_id: '1',
        product_name: 'Product 1',
        sku: 'SKU001',
        quantity: 2,
        unit_price: 100,
        discount: 0,
        tax_rate: 5,
        tax_amount: 10,
        total_price: 210,
      },
    ],
  },
  {
    id: '2',
    bill_number: 'BILL-20240102-0002',
    customer_id: '2',
    customer_name: 'Jane Smith',
    customer_phone: '9876543211',
    cashier_id: '3',
    cashier_name: 'Cashier User',
    total_amount: 2000,
    discount_amount: 100,
    tax_amount: 200,
    net_amount: 2100,
    payment_method: 'card',
    status: 'completed',
    notes: 'Regular customer',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    items: [
      {
        id: '2',
        product_id: '2',
        product_name: 'Product 2',
        sku: 'SKU002',
        quantity: 1,
        unit_price: 200,
        discount: 0,
        tax_rate: 5,
        tax_amount: 10,
        total_price: 210,
      },
    ],
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
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?billing/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId) {
        const bill = mockBills.find((b) => b.id === resourceId || b.bill_number === resourceId);
        if (!bill) return errorResponse(404, 'Bill not found');
        return successResponse(bill);
      }
      const params = event.queryStringParameters || {};
      const page = parseInt(params.page || '1');
      const limit = parseInt(params.limit || '20');
      const filtered = mockBills.filter((b) => {
        if (params.status && b.status !== params.status) return false;
        if (params.customerId && b.customer_id !== params.customerId) return false;
        return true;
      });
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      return successResponse({ bills: paginated, total: filtered.length, page, limit });
    }

    case 'POST': {
      if (resourceId && subAction === 'return') {
        const { items, reason } = parseBody(event);
        if (!items || items.length === 0) {
          return errorResponse(400, 'Return items are required');
        }
        const returnRecord = {
          id: String(Date.now()),
          bill_id: resourceId,
          return_amount: 500,
          reason: reason || 'Customer return',
          items,
          created_at: new Date().toISOString(),
        };
        return successResponse(returnRecord, 201, 'Return processed. Refund amount: ₹500.00');
      }
      const { customerId, items, paymentMethod, discountAmount = 0, notes } = parseBody(event);
      if (!items || items.length === 0) {
        return errorResponse(400, 'Bill must have at least one item');
      }
      if (!paymentMethod) {
        return errorResponse(400, 'Payment method is required');
      }
      const validPaymentMethods = ['cash', 'card', 'upi', 'wallet', 'credit'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return errorResponse(400, `Payment method must be one of: ${validPaymentMethods.join(', ')}`);
      }
      const total = items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 100), 0);
      const tax = total * 0.05;
      const net = total + tax - parseFloat(discountAmount);
      const newBill = {
        id: String(Date.now()),
        bill_number: `BILL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(mockBills.length + 1).padStart(4, '0')}`,
        customer_id: customerId || null,
        cashier_id: '3',
        cashier_name: 'Cashier User',
        total_amount: total,
        discount_amount: discountAmount,
        tax_amount: tax,
        net_amount: net,
        payment_method: paymentMethod,
        status: 'completed',
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items,
      };
      return successResponse(newBill, 201, 'Bill created successfully');
    }

    case 'PUT': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const bill = mockBills.find((b) => b.id === resourceId);
      if (!bill) return errorResponse(404, 'Bill not found');
      const updates = parseBody(event);
      const updated = { ...bill, ...updates, updated_at: new Date().toISOString() };
      return successResponse(updated, 200, 'Bill updated successfully');
    }

    case 'DELETE': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const bill = mockBills.find((b) => b.id === resourceId);
      if (!bill) return errorResponse(404, 'Bill not found');
      return successResponse(null, 200, 'Bill voided successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
