/**
 * Payments API - Netlify Function (Mock)
 * Handles payment processing and records
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockPayments = [
  {
    id: '1',
    bill_id: '1',
    bill_number: 'BILL-20240101-0001',
    amount: 5000,
    method: 'cash',
    status: 'completed',
    transaction_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    bill_id: '2',
    bill_number: 'BILL-20240102-0002',
    amount: 2100,
    method: 'card',
    status: 'completed',
    transaction_id: 'TXN-001',
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
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?payments/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId && !subAction) {
        const payment = mockPayments.find((p) => p.id === resourceId);
        if (!payment) return errorResponse(404, 'Payment not found');
        return successResponse(payment);
      }
      const params = event.queryStringParameters || {};
      const page = parseInt(params.page || '1');
      const limit = parseInt(params.limit || '20');
      const paginated = mockPayments.slice((page - 1) * limit, page * limit);
      return successResponse({ payments: paginated, total: mockPayments.length, page, limit });
    }

    case 'POST': {
      if (resourceId === 'initiate') {
        const { billId, method, amount } = parseBody(event);
        if (!billId || !method || !amount) {
          return errorResponse(400, 'billId, method, and amount are required');
        }
        const validMethods = ['cash', 'card', 'upi', 'wallet', 'credit'];
        if (!validMethods.includes(method)) {
          return errorResponse(400, `Payment method must be one of: ${validMethods.join(', ')}`);
        }
        const payment = {
          id: String(Date.now()),
          bill_id: billId,
          amount: parseFloat(amount),
          method,
          status: method === 'cash' ? 'completed' : 'pending',
          transaction_id: method !== 'cash' ? `TXN-${Date.now()}` : null,
          razorpay_order_id: method === 'card' ? `order_${Date.now()}` : null,
          created_at: new Date().toISOString(),
        };
        return successResponse(payment, 201, 'Payment initiated');
      }

      if (resourceId === 'verify') {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parseBody(event);
        if (!razorpay_payment_id) {
          return errorResponse(400, 'Payment verification data is required');
        }
        return successResponse(
          { verified: true, payment_id: razorpay_payment_id },
          200,
          'Payment verified successfully'
        );
      }

      if (resourceId && subAction === 'refund') {
        const payment = mockPayments.find((p) => p.id === resourceId);
        if (!payment) return errorResponse(404, 'Payment not found');
        const { reason, amount } = parseBody(event);
        const refund = {
          id: String(Date.now()),
          payment_id: resourceId,
          amount: parseFloat(amount || payment.amount),
          reason: reason || 'Customer refund',
          status: 'completed',
          created_at: new Date().toISOString(),
        };
        return successResponse(refund, 201, 'Refund processed successfully');
      }

      const paymentData = parseBody(event);
      if (!paymentData.billId || !paymentData.method || !paymentData.amount) {
        return errorResponse(400, 'billId, method, and amount are required');
      }
      const newPayment = {
        id: String(Date.now()),
        bill_id: paymentData.billId,
        bill_number: paymentData.billNumber || null,
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        status: 'completed',
        transaction_id: paymentData.transactionId || null,
        created_at: new Date().toISOString(),
      };
      return successResponse(newPayment, 201, 'Payment recorded successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
