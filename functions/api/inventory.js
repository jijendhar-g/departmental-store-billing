/**
 * Inventory API - Netlify Function
 * Handles product inventory management, stock tracking, and alerts
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
  const pathSegments = path.replace(/^\/(\.netlify\/functions\/)?(?:api\/)?inventory/, '').split('/').filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  const user = verifyToken(event);

  switch (httpMethod) {
    case 'GET':
      if (resourceId === 'low-stock') {
        return getLowStockProducts();
      }
      if (resourceId === 'search') {
        return searchProducts(event);
      }
      if (resourceId) {
        return getProductById(resourceId);
      }
      return getProducts(event);

    case 'POST':
      if (resourceId && subAction === 'adjust') {
        requireRole(user, ['admin', 'manager']);
        return adjustStock(resourceId, event, user);
      }
      requireRole(user, ['admin', 'manager']);
      return createProduct(event);

    case 'PUT':
      if (resourceId) {
        requireRole(user, ['admin', 'manager']);
        return updateProduct(resourceId, event);
      }
      break;

    case 'DELETE':
      if (resourceId) {
        requireRole(user, ['admin']);
        return deleteProduct(resourceId);
      }
      break;

    default:
      break;
  }

  return errorResponse(404, 'Route not found');
};

const getProducts = async (event) => {
  const {
    page = 1,
    limit = 20,
    department,
    category,
    inStock,
    search,
  } = getQueryParams(event);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE p.is_active = true';
  const params = [];

  if (department) {
    params.push(department);
    whereClause += ` AND p.department_id = $${params.length}`;
  }

  if (category) {
    params.push(category);
    whereClause += ` AND p.category = $${params.length}`;
  }

  if (inStock === 'true') {
    whereClause += ' AND p.stock_quantity > 0';
  }

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
  }

  params.push(parseInt(limit));
  params.push(offset);

  const result = await query(
    `SELECT p.id, p.name, p.sku, p.barcode, p.description, p.price, p.tax_rate,
            p.stock_quantity, p.minimum_stock, p.unit, p.category,
            p.department_id, d.name AS department_name,
            p.supplier_id, s.name AS supplier_name,
            p.created_at, p.updated_at
     FROM products p
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     ${whereClause}
     ORDER BY p.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM products p ${whereClause}`,
    params.slice(0, -2)
  );

  return successResponse({
    products: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

const getProductById = async (productId) => {
  const result = await query(
    `SELECT p.*, d.name AS department_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.id = $1 OR p.barcode = $1 OR p.sku = $1`,
    [productId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Product not found');
  }

  return successResponse(result.rows[0]);
};

const searchProducts = async (event) => {
  const { q } = getQueryParams(event);

  if (!q) {
    return errorResponse(400, 'Search query is required');
  }

  const result = await query(
    `SELECT p.id, p.name, p.sku, p.barcode, p.price, p.tax_rate,
            p.stock_quantity, p.unit, p.category, p.department_id,
            d.name AS department_name
     FROM products p
     LEFT JOIN departments d ON p.department_id = d.id
     WHERE p.is_active = true
       AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.barcode = $2)
     ORDER BY p.name ASC
     LIMIT 20`,
    [`%${q}%`, q]
  );

  return successResponse(result.rows);
};

const getLowStockProducts = async () => {
  const result = await query(
    `SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, p.minimum_stock,
            p.unit, p.department_id, d.name AS department_name,
            p.supplier_id, s.name AS supplier_name, s.contact_email AS supplier_email
     FROM products p
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.is_active = true AND p.stock_quantity <= p.minimum_stock
     ORDER BY p.stock_quantity ASC`,
    []
  );

  return successResponse({
    products: result.rows,
    count: result.rows.length,
  });
};

const createProduct = async (event) => {
  const {
    name, sku, barcode, description, price, taxRate = 0,
    stockQuantity = 0, minimumStock = 5, unit = 'piece',
    category, departmentId, supplierId,
  } = parseBody(event);

  if (!name || !sku || !price) {
    return errorResponse(400, 'Name, SKU, and price are required');
  }

  const existing = await query(
    'SELECT id FROM products WHERE sku = $1 OR (barcode IS NOT NULL AND barcode = $2)',
    [sku, barcode || null]
  );

  if (existing.rows.length > 0) {
    return errorResponse(409, 'Product with this SKU or barcode already exists');
  }

  const result = await query(
    `INSERT INTO products (name, sku, barcode, description, price, tax_rate,
                          stock_quantity, minimum_stock, unit, category,
                          department_id, supplier_id, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
     RETURNING *`,
    [name, sku, barcode || null, description || null, price, taxRate,
     stockQuantity, minimumStock, unit, category || null, departmentId || null, supplierId || null]
  );

  return successResponse(result.rows[0], 201, 'Product created successfully');
};

const updateProduct = async (productId, event) => {
  const {
    name, sku, barcode, description, price, taxRate,
    minimumStock, unit, category, departmentId, supplierId, isActive,
  } = parseBody(event);

  const result = await query(
    `UPDATE products SET
       name = COALESCE($1, name),
       sku = COALESCE($2, sku),
       barcode = COALESCE($3, barcode),
       description = COALESCE($4, description),
       price = COALESCE($5, price),
       tax_rate = COALESCE($6, tax_rate),
       minimum_stock = COALESCE($7, minimum_stock),
       unit = COALESCE($8, unit),
       category = COALESCE($9, category),
       department_id = COALESCE($10, department_id),
       supplier_id = COALESCE($11, supplier_id),
       is_active = COALESCE($12, is_active),
       updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [name, sku, barcode, description, price, taxRate, minimumStock, unit,
     category, departmentId, supplierId, isActive, productId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Product not found');
  }

  return successResponse(result.rows[0], 200, 'Product updated successfully');
};

const adjustStock = async (productId, event, user) => {
  const { adjustment, reason, type = 'manual' } = parseBody(event);

  if (adjustment === undefined || adjustment === null) {
    return errorResponse(400, 'Stock adjustment value is required');
  }

  return transaction(async (client) => {
    const productResult = await client.query(
      'SELECT id, name, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    if (productResult.rows.length === 0) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const product = productResult.rows[0];
    const newQuantity = product.stock_quantity + parseInt(adjustment);

    if (newQuantity < 0) {
      const error = new Error('Stock cannot go below 0');
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
      [newQuantity, productId]
    );

    // Log stock adjustment
    await client.query(
      `INSERT INTO stock_adjustments (product_id, adjustment, previous_quantity, new_quantity,
                                     reason, type, adjusted_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [productId, adjustment, product.stock_quantity, newQuantity, reason || null, type, user.userId]
    );

    return successResponse(
      { productId, previousQuantity: product.stock_quantity, newQuantity, adjustment },
      200,
      'Stock adjusted successfully'
    );
  });
};

const deleteProduct = async (productId) => {
  // Soft delete
  const result = await query(
    'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [productId]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Product not found');
  }

  return successResponse(null, 200, 'Product deactivated successfully');
};

exports.handler = withErrorHandling(handler);
