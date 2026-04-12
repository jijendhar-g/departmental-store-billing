/**
 * Inventory API - Netlify Function (Mock)
 * Handles product inventory management, stock tracking, and alerts
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockProducts = [
  {
    id: '1',
    name: 'Product 1',
    sku: 'SKU001',
    barcode: '1234567890001',
    description: 'Sample electronics product',
    price: 100,
    cost_price: 70,
    tax_rate: 5,
    stock_quantity: 50,
    min_stock_level: 10,
    department: 'Electronics',
    department_id: '1',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Product 2',
    sku: 'SKU002',
    barcode: '1234567890002',
    description: 'Sample clothing product',
    price: 200,
    cost_price: 120,
    tax_rate: 5,
    stock_quantity: 30,
    min_stock_level: 5,
    department: 'Clothing',
    department_id: '2',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Product 3',
    sku: 'SKU003',
    barcode: '1234567890003',
    description: 'Sample food product',
    price: 150,
    cost_price: 90,
    tax_rate: 5,
    stock_quantity: 5,
    min_stock_level: 10,
    department: 'Food',
    department_id: '3',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Product 4',
    sku: 'SKU004',
    barcode: '1234567890004',
    description: 'Sample grocery item',
    price: 50,
    cost_price: 30,
    tax_rate: 0,
    stock_quantity: 3,
    min_stock_level: 15,
    department: 'Grocery',
    department_id: '3',
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
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?inventory/, '')
    .split('/')
    .filter(Boolean);
  const resourceId = pathSegments[0];
  const subAction = pathSegments[1];

  switch (httpMethod) {
    case 'GET': {
      if (resourceId === 'low-stock') {
        const lowStock = mockProducts.filter((p) => p.stock_quantity <= p.min_stock_level);
        return successResponse(lowStock);
      }

      if (resourceId === 'search') {
        const q = (event.queryStringParameters || {}).q || '';
        const results = mockProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.sku.toLowerCase().includes(q.toLowerCase()) ||
            (p.barcode && p.barcode.includes(q))
        );
        return successResponse(results);
      }

      if (resourceId) {
        const product = mockProducts.find((p) => p.id === resourceId || p.sku === resourceId);
        if (!product) return errorResponse(404, 'Product not found');
        return successResponse(product);
      }

      const params = event.queryStringParameters || {};
      const page = parseInt(params.page || '1');
      const limit = parseInt(params.limit || '20');
      const filtered = mockProducts.filter((p) => {
        if (params.department && p.department !== params.department) return false;
        if (params.isActive !== undefined && String(p.is_active) !== params.isActive) return false;
        return true;
      });
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      return successResponse({ products: paginated, total: filtered.length, page, limit });
    }

    case 'POST': {
      if (resourceId && subAction === 'adjust') {
        const { adjustment, reason } = parseBody(event);
        const product = mockProducts.find((p) => p.id === resourceId);
        if (!product) return errorResponse(404, 'Product not found');
        const updated = {
          ...product,
          stock_quantity: Math.max(0, product.stock_quantity + parseInt(adjustment || 0)),
          updated_at: new Date().toISOString(),
        };
        return successResponse(updated, 200, `Stock adjusted by ${adjustment}. Reason: ${reason}`);
      }

      const newProductData = parseBody(event);
      if (!newProductData.name || !newProductData.sku) {
        return errorResponse(400, 'Product name and SKU are required');
      }
      const existing = mockProducts.find((p) => p.sku === newProductData.sku);
      if (existing) return errorResponse(409, 'SKU already exists');

      const newProduct = {
        id: String(Date.now()),
        name: newProductData.name,
        sku: newProductData.sku,
        barcode: newProductData.barcode || null,
        description: newProductData.description || null,
        price: parseFloat(newProductData.price || 0),
        cost_price: parseFloat(newProductData.cost_price || 0),
        tax_rate: parseFloat(newProductData.tax_rate || 0),
        stock_quantity: parseInt(newProductData.stock_quantity || 0),
        min_stock_level: parseInt(newProductData.min_stock_level || 10),
        department: newProductData.department || null,
        department_id: newProductData.department_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return successResponse(newProduct, 201, 'Product created successfully');
    }

    case 'PUT': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const product = mockProducts.find((p) => p.id === resourceId);
      if (!product) return errorResponse(404, 'Product not found');
      const updates = parseBody(event);
      const updated = { ...product, ...updates, id: product.id, updated_at: new Date().toISOString() };
      return successResponse(updated, 200, 'Product updated successfully');
    }

    case 'DELETE': {
      if (!resourceId) return errorResponse(404, 'Route not found');
      const product = mockProducts.find((p) => p.id === resourceId);
      if (!product) return errorResponse(404, 'Product not found');
      return successResponse(null, 200, 'Product deleted successfully');
    }

    default:
      return errorResponse(405, 'Method not allowed');
  }
};
