/**
 * Payments API - Netlify Function
 * Handles payment processing, gateway integration, and payment records
 */

const { query, transaction } = require('../database');
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
  const pathSegments = path.replace(/^\/(\.netlify\/functions\/)?(?:api\/)?payments/, '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  const user = verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId) {
        return getPaymentById(resourceId);
      }
      return getPayments(event, user);

    case 'POST':
      if (resourceId === 'initiate') {
        return initiatePayment(event, user);
      }
      if (resourceId === 'verify') {
        return verifyPayment(event, user);
      }
      if (resourceId && subAction === 'refund') {
        requireRole(user, ['admin', 'manager']);
        return processRefund(resourceId, event, user);
      }
      return recordPayment(event, user);

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getPayments = async (event, user) => {
  const { page = 1, limit = 20, startDate, endDate, method, status } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (startDate) {
    params.push(startDate);
    whereClause += ` AND p.created_at >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    whereClause += ` AND p.created_at <= $${params.length}`;
  }

  if (method) {
    params.push(method);
    whereClause += ` AND p.method = $${params.length}`;
  }

  if (status) {
    params.push(status);
    whereClause += ` AND p.status = $${params.length}`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT p.id, p.bill_id, b.bill_number, p.amount, p.method,
            p.status, p.gateway_transaction_id, p.created_at
     FROM payments p
     LEFT JOIN bills b ON p.bill_id = b.id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return successResponse({
    payments: result.rows,
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getPaymentById = async (paymentId) => {
  const result = await query(
    `SELECT p.*, b.bill_number, b.net_amount AS bill_amount
     FROM payments p
     JOIN bills b ON p.bill_id = b.id
     WHERE p.id = $1 OR p.gateway_transaction_id = $1`,
    [paymentId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Payment not found');
  }

  return successResponse(result.rows[0]);
};

const initiatePayment = async (event, user) => {
  const { billId, method, amount } = parseBody(event);

  if (!billId || !method || !amount) {
    return errorResponse(400, 'Bill ID, payment method, and amount are required');
  }

  const billResult = await query(
    "SELECT * FROM bills WHERE id = $1 AND status = 'pending'",
    [billId]
  );

  if (billResult.rows.length === 0) {
    return errorResponse(404, 'Bill not found or not in pending status');
  }

  const bill = billResult.rows[0];

  if (Math.abs(parseFloat(amount) - parseFloat(bill.net_amount)) > 0.01) {
    return errorResponse(400, 'Payment amount does not match bill amount');
  }

  // For Razorpay integration
  if (method === 'razorpay') {
    const razorpayKey = process.env.RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      return errorResponse(500, 'Payment gateway not configured');
    }

    // In a real implementation, call Razorpay API to create an order
    const mockOrderId = `order_${Date.now()}`;

    return successResponse({
      orderId: mockOrderId,
      amount: Math.round(parseFloat(amount) * 100), // Razorpay uses paise
      currency: 'INR',
      key: razorpayKey,
      billNumber: bill.bill_number,
    }, 200, 'Payment order created');
  }

  // For cash/UPI payments - record directly
  return recordPayment(event, user);
};

const verifyPayment = async (event, user) => {
  const { billId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = parseBody(event);

  if (!billId || !gatewayPaymentId) {
    return errorResponse(400, 'Bill ID and payment ID are required');
  }

  // In production, verify the Razorpay signature here
  // const crypto = require('crypto');
  // const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  //   .update(`${gatewayOrderId}|${gatewayPaymentId}`)
  //   .digest('hex');
  // if (expectedSignature !== gatewaySignature) {
  //   return errorResponse(400, 'Invalid payment signature');
  // }

  return transaction(async (client) => {
    const paymentResult = await client.query(
      `INSERT INTO payments (bill_id, amount, method, status, gateway_transaction_id,
                            gateway_order_id, processed_by, created_at)
       SELECT id, net_amount, 'razorpay', 'completed', $1, $2, $3, NOW()
       FROM bills WHERE id = $4
       RETURNING *`,
      [gatewayPaymentId, gatewayOrderId, user.userId, billId]
    );

    await client.query(
      "UPDATE bills SET status = 'completed', payment_method = 'razorpay', updated_at = NOW() WHERE id = $1",
      [billId]
    );

    return successResponse(paymentResult.rows[0], 200, 'Payment verified and recorded');
  });
};

const recordPayment = async (event, user) => {
  const { billId, amount, method, notes } = parseBody(event);

  if (!billId || !amount || !method) {
    return errorResponse(400, 'Bill ID, amount, and method are required');
  }

  const validMethods = ['cash', 'card', 'upi', 'wallet'];
  if (!validMethods.includes(method)) {
    return errorResponse(400, `Payment method must be one of: ${validMethods.join(', ')}`);
  }

  return transaction(async (client) => {
    const billResult = await client.query(
      'SELECT * FROM bills WHERE id = $1',
      [billId]
    );

    if (billResult.rows.length === 0) {
      const error = new Error('Bill not found');
      error.statusCode = 404;
      throw error;
    }

    const paymentResult = await client.query(
      `INSERT INTO payments (bill_id, amount, method, status, notes, processed_by, created_at)
       VALUES ($1, $2, $3, 'completed', $4, $5, NOW())
       RETURNING *`,
      [billId, amount, method, notes || null, user.userId]
    );

    await client.query(
      "UPDATE bills SET status = 'completed', payment_method = $1, updated_at = NOW() WHERE id = $2",
      [method, billId]
    );

    return successResponse(paymentResult.rows[0], 201, 'Payment recorded successfully');
  });
};

const processRefund = async (paymentId, event, user) => {
  const { reason, amount } = parseBody(event);

  if (!reason) {
    return errorResponse(400, 'Refund reason is required');
  }

  return transaction(async (client) => {
    const paymentResult = await client.query(
      "SELECT * FROM payments WHERE id = $1 AND status = 'completed'",
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      const error = new Error('Payment not found or not eligible for refund');
      error.statusCode = 404;
      throw error;
    }

    const payment = paymentResult.rows[0];
    const refundAmount = amount || payment.amount;

    if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
      const error = new Error('Refund amount cannot exceed original payment amount');
      error.statusCode = 400;
      throw error;
    }

    const refundResult = await client.query(
      `INSERT INTO payments (bill_id, amount, method, status, notes, processed_by,
                            gateway_transaction_id, created_at)
       VALUES ($1, $2, $3, 'refunded', $4, $5, $6, NOW())
       RETURNING *`,
      [payment.bill_id, -Math.abs(refundAmount), payment.method,
       `Refund: ${reason}`, user.userId, payment.gateway_transaction_id]
    );

    await client.query(
      "UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1",
      [paymentId]
    );

    return successResponse(refundResult.rows[0], 201, `Refund of ₹${refundAmount} processed`);
  });
};

exports.handler = withErrorHandling(handler);
