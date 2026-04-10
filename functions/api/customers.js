/**
 * Customers API - Netlify Function
 * Handles customer management, profiles, loyalty points, and purchase history
 */

const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const {
  withErrorHandling,
  successResponse,
  errorResponse,
  parseBody,
  getQueryParams,
} = require('../middleware/errorHandler');

const handler = async (event) => {
  const { httpMethod, path } = event;
  const pathSegments = path.replace('/.netlify/functions/api/customers', '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId && subAction === 'history') {
        return getCustomerHistory(resourceId, event);
      }
      if (resourceId && subAction === 'loyalty') {
        return getCustomerLoyalty(resourceId);
      }
      if (resourceId) {
        return getCustomerById(resourceId);
      }
      return getCustomers(event);

    case 'POST':
      return createCustomer(event);

    case 'PUT':
      if (resourceId && subAction === 'loyalty') {
        return redeemLoyaltyPoints(resourceId, event);
      }
      if (resourceId) {
        return updateCustomer(resourceId, event);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        return deleteCustomer(resourceId);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getCustomers = async (event) => {
  const { page = 1, limit = 20, search, tier } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE c.is_active = true';
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
  }

  if (tier) {
    params.push(tier);
    whereClause += ` AND c.loyalty_tier = $${params.length}`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.loyalty_points,
            c.loyalty_tier, c.total_purchases, c.created_at, c.updated_at
     FROM customers c
     ${whereClause}
     ORDER BY c.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM customers c ${whereClause}`,
    params.slice(0, -2)
  );

  return successResponse({
    customers: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getCustomerById = async (customerId) => {
  const result = await query(
    `SELECT c.*, COUNT(b.id) AS total_bills
     FROM customers c
     LEFT JOIN bills b ON c.id = b.customer_id AND b.status = 'completed'
     WHERE c.id = $1 OR c.phone = $1 OR c.email = $1
     GROUP BY c.id`,
    [customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Customer not found');
  }

  return successResponse(result.rows[0]);
};

const getCustomerHistory = async (customerId, event) => {
  const { page = 1, limit = 10 } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const result = await query(
    `SELECT b.id, b.bill_number, b.total_amount, b.discount_amount, b.tax_amount,
            b.net_amount, b.payment_method, b.status, b.created_at
     FROM bills b
     WHERE b.customer_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, parseInt(limit), offset]
  );

  const totalResult = await query(
    'SELECT COUNT(*), SUM(net_amount) AS total_spent FROM bills WHERE customer_id = $1 AND status = $2',
    [customerId, 'completed']
  );

  return successResponse({
    bills: result.rows,
    stats: {
      totalBills: parseInt(totalResult.rows[0].count),
      totalSpent: parseFloat(totalResult.rows[0].total_spent || 0),
    },
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getCustomerLoyalty = async (customerId) => {
  const result = await query(
    `SELECT c.id, c.name, c.loyalty_points, c.loyalty_tier, c.total_purchases,
            CASE
              WHEN c.loyalty_tier = 'bronze' THEN 1000 - c.loyalty_points
              WHEN c.loyalty_tier = 'silver' THEN 5000 - c.loyalty_points
              WHEN c.loyalty_tier = 'gold' THEN 10000 - c.loyalty_points
              ELSE 0
            END AS points_to_next_tier
     FROM customers c
     WHERE c.id = $1`,
    [customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Customer not found');
  }

  return successResponse(result.rows[0]);
};

const createCustomer = async (event) => {
  const { name, email, phone, address, dateOfBirth } = parseBody(event);

  if (!name || !phone) {
    return errorResponse(400, 'Name and phone number are required');
  }

  const existing = await query(
    'SELECT id FROM customers WHERE phone = $1 OR (email IS NOT NULL AND email = $2)',
    [phone, email || null]
  );

  if (existing.rows.length > 0) {
    return errorResponse(409, 'Customer with this phone or email already exists');
  }

  const result = await query(
    `INSERT INTO customers (name, email, phone, address, date_of_birth,
                           loyalty_points, loyalty_tier, total_purchases, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, 'bronze', 0, true, NOW())
     RETURNING *`,
    [name, email || null, phone, address || null, dateOfBirth || null]
  );

  return successResponse(result.rows[0], 201, 'Customer created successfully');
};

const updateCustomer = async (customerId, event) => {
  const { name, email, phone, address, dateOfBirth } = parseBody(event);

  const result = await query(
    `UPDATE customers SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       phone = COALESCE($3, phone),
       address = COALESCE($4, address),
       date_of_birth = COALESCE($5, date_of_birth),
       updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [name, email, phone, address, dateOfBirth, customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Customer not found');
  }

  return successResponse(result.rows[0], 200, 'Customer updated successfully');
};

const redeemLoyaltyPoints = async (customerId, event) => {
  const { points } = parseBody(event);

  if (!points || points <= 0) {
    return errorResponse(400, 'Valid points amount is required');
  }

  const result = await query(
    `UPDATE customers
     SET loyalty_points = GREATEST(0, loyalty_points - $1), updated_at = NOW()
     WHERE id = $2 AND loyalty_points >= $1
     RETURNING id, name, loyalty_points, loyalty_tier`,
    [points, customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(400, 'Insufficient loyalty points or customer not found');
  }

  const discountAmount = points * 0.5; // ₹0.50 per point

  return successResponse(
    { customer: result.rows[0], discountAmount },
    200,
    `${points} points redeemed for ₹${discountAmount.toFixed(2)} discount`
  );
};

const deleteCustomer = async (customerId) => {
  const result = await query(
    'UPDATE customers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Customer not found');
  }

  return successResponse(null, 200, 'Customer deactivated successfully');
};

exports.handler = withErrorHandling(handler);
