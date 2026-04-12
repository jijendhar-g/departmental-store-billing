/**
 * Billing API - Netlify Function
 * Handles bill creation, retrieval, updates, and returns
 */

const { query, transaction } = require('../database');
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
  const pathSegments = path.replace(/^\/(\.netlify\/functions\/)?(?:api\/)?billing/, '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  const user = verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId) {
        return getBillById(resourceId);
      }
      return getBills(event, user);

    case 'POST':
      if (resourceId && subAction === 'return') {
        return processReturn(resourceId, event, user);
      }
      return createBill(event, user);

    case 'PUT':
      if (resourceId) {
        return updateBill(resourceId, event, user);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        return voidBill(resourceId, user);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getBills = async (event, user) => {
  const { page = 1, limit = 20, startDate, endDate, status, customerId } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user.role === 'cashier') {
    params.push(user.userId);
    whereClause += ` AND b.cashier_id = $${params.length}`;
  }

  if (startDate) {
    params.push(startDate);
    whereClause += ` AND b.created_at >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    whereClause += ` AND b.created_at <= $${params.length}`;
  }

  if (status) {
    params.push(status);
    whereClause += ` AND b.status = $${params.length}`;
  }

  if (customerId) {
    params.push(customerId);
    whereClause += ` AND b.customer_id = $${params.length}`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT b.id, b.bill_number, b.customer_id, c.name AS customer_name,
            b.total_amount, b.discount_amount, b.tax_amount, b.net_amount,
            b.payment_method, b.status, b.cashier_id, u.name AS cashier_name,
            b.created_at, b.updated_at
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id
     LEFT JOIN users u ON b.cashier_id = u.id
     ${whereClause}
     ORDER BY b.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM bills b ${whereClause}`,
    params.slice(0, -2)
  );

  return successResponse({
    bills: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getBillById = async (billId) => {
  const billResult = await query(
    `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
            u.name AS cashier_name
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id
     LEFT JOIN users u ON b.cashier_id = u.id
     WHERE b.id = $1 OR b.bill_number = $1`,
    [billId]
  );

  if (billResult.rows.length === 0) {
    return errorResponse(404, 'Bill not found');
  }

  const bill = billResult.rows[0];

  const itemsResult = await query(
    `SELECT bi.id, bi.product_id, p.name AS product_name, p.sku, p.barcode,
            bi.quantity, bi.unit_price, bi.discount, bi.tax_rate,
            bi.tax_amount, bi.total_price
     FROM bill_items bi
     JOIN products p ON bi.product_id = p.id
     WHERE bi.bill_id = $1`,
    [bill.id]
  );

  bill.items = itemsResult.rows;

  return successResponse(bill);
};

const createBill = async (event, user) => {
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

  return transaction(async (client) => {
    // Generate bill number
    const billNumberResult = await client.query(
      "SELECT 'BILL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('bill_sequence')::text, 4, '0') AS bill_number"
    );
    const billNumber = billNumberResult.rows[0].bill_number;

    let totalAmount = 0;
    let taxAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, tax_rate, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(`Product ${item.productId} not found`);
        error.statusCode = 404;
        throw error;
      }

      const product = productResult.rows[0];

      if (product.stock_quantity < item.quantity) {
        const error = new Error(`Insufficient stock for product: ${product.name}`);
        error.statusCode = 400;
        throw error;
      }

      const itemDiscount = item.discount || 0;
      const unitPrice = parseFloat(product.price);
      const itemTotal = (unitPrice * item.quantity) - itemDiscount;
      const itemTax = itemTotal * (parseFloat(product.tax_rate) / 100);

      totalAmount += itemTotal;
      taxAmount += itemTax;

      processedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        taxRate: product.tax_rate,
        taxAmount: itemTax,
        totalPrice: itemTotal + itemTax,
      });

      // Deduct stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, product.id]
      );
    }

    const netAmount = totalAmount + taxAmount - parseFloat(discountAmount);

    // Insert bill
    const billResult = await client.query(
      `INSERT INTO bills (bill_number, customer_id, cashier_id, total_amount, discount_amount,
                         tax_amount, net_amount, payment_method, status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, NOW())
       RETURNING *`,
      [billNumber, customerId || null, user.userId, totalAmount, discountAmount, taxAmount, netAmount, paymentMethod, notes || null]
    );

    const bill = billResult.rows[0];

    // Insert bill items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, discount, tax_rate, tax_amount, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [bill.id, item.productId, item.quantity, item.unitPrice, item.discount, item.taxRate, item.taxAmount, item.totalPrice]
      );
    }

    // Update customer loyalty points if customer provided
    if (customerId) {
      const points = Math.floor(netAmount / 10); // 1 point per ₹10 spent
      await client.query(
        'UPDATE customers SET loyalty_points = loyalty_points + $1, total_purchases = total_purchases + $2 WHERE id = $3',
        [points, netAmount, customerId]
      );
    }

    return successResponse({ ...bill, items: processedItems }, 201, 'Bill created successfully');
  });
};

const updateBill = async (billId, event, user) => {
  if (!['admin', 'manager'].includes(user.role)) {
    return errorResponse(403, 'Only admins and managers can update bills');
  }

  const { notes, status } = parseBody(event);

  const result = await query(
    'UPDATE bills SET notes = COALESCE($1, notes), status = COALESCE($2, status), updated_at = NOW() WHERE id = $3 RETURNING *',
    [notes, status, billId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Bill not found');
  }

  return successResponse(result.rows[0], 200, 'Bill updated successfully');
};

const voidBill = async (billId, user) => {
  if (!['admin', 'manager'].includes(user.role)) {
    return errorResponse(403, 'Only admins and managers can void bills');
  }

  return transaction(async (client) => {
    const billResult = await client.query(
      "SELECT * FROM bills WHERE id = $1 AND status != 'voided'",
      [billId]
    );

    if (billResult.rows.length === 0) {
      const error = new Error('Bill not found or already voided');
      error.statusCode = 404;
      throw error;
    }

    const bill = billResult.rows[0];

    // Restore stock for all items
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM bill_items WHERE bill_id = $1',
      [billId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Void the bill
    await client.query(
      "UPDATE bills SET status = 'voided', updated_at = NOW() WHERE id = $1",
      [billId]
    );

    // Reverse loyalty points if customer
    if (bill.customer_id) {
      const points = Math.floor(bill.net_amount / 10);
      await client.query(
        'UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points - $1), total_purchases = GREATEST(0, total_purchases - $2) WHERE id = $3',
        [points, bill.net_amount, bill.customer_id]
      );
    }

    return successResponse(null, 200, 'Bill voided successfully');
  });
};

const processReturn = async (billId, event, user) => {
  if (!['admin', 'manager', 'cashier'].includes(user.role)) {
    return errorResponse(403, 'Insufficient permissions');
  }

  const { items, reason } = parseBody(event);

  if (!items || items.length === 0) {
    return errorResponse(400, 'Return items are required');
  }

  return transaction(async (client) => {
    const billResult = await client.query(
      "SELECT * FROM bills WHERE id = $1 AND status = 'completed'",
      [billId]
    );

    if (billResult.rows.length === 0) {
      const error = new Error('Bill not found or not eligible for return');
      error.statusCode = 404;
      throw error;
    }

    const bill = billResult.rows[0];
    let returnAmount = 0;

    for (const returnItem of items) {
      const itemResult = await client.query(
        'SELECT * FROM bill_items WHERE bill_id = $1 AND product_id = $2',
        [billId, returnItem.productId]
      );

      if (itemResult.rows.length === 0) {
        const error = new Error(`Product ${returnItem.productId} not found in this bill`);
        error.statusCode = 404;
        throw error;
      }

      const originalItem = itemResult.rows[0];

      if (returnItem.quantity > originalItem.quantity) {
        const error = new Error(`Return quantity exceeds original quantity for product ${returnItem.productId}`);
        error.statusCode = 400;
        throw error;
      }

      const itemReturnAmount = (originalItem.total_price / originalItem.quantity) * returnItem.quantity;
      returnAmount += itemReturnAmount;

      // Restore stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
        [returnItem.quantity, returnItem.productId]
      );
    }

    // Create return record
    const returnResult = await client.query(
      `INSERT INTO returns (bill_id, cashier_id, return_amount, reason, items, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [billId, user.userId, returnAmount, reason, JSON.stringify(items)]
    );

    await client.query(
      "UPDATE bills SET status = 'partially_returned', updated_at = NOW() WHERE id = $1",
      [billId]
    );

    return successResponse(
      { ...returnResult.rows[0], originalBill: bill },
      201,
      `Return processed. Refund amount: ₹${returnAmount.toFixed(2)}`
    );
  });
};

exports.handler = withErrorHandling(handler);
