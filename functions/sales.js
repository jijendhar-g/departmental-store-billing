/**
 * Sales Analytics API - Netlify Function (Mock)
 * Handles sales reports, dashboards, and analytics
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const mockDashboard = {
  totalSales: 150000,
  totalBills: 250,
  totalCustomers: 1200,
  lowStockProducts: 15,
  topProduct: 'Product 1',
  revenue: 140000,
  profit: 35000,
  todaySales: 12000,
  todayBills: 45,
  weekSales: 85000,
  weekBills: 180,
  monthSales: 150000,
  monthBills: 250,
};

const mockDailyReport = [
  { date: new Date().toISOString().slice(0, 10), total_sales: 12000, bill_count: 45, avg_bill: 266.67 },
  { date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), total_sales: 9500, bill_count: 38, avg_bill: 250 },
  { date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), total_sales: 11000, bill_count: 42, avg_bill: 261.9 },
];

const mockWeeklyReport = [
  { week: 'Week 1', total_sales: 85000, bill_count: 180, avg_bill: 472.22 },
  { week: 'Week 2', total_sales: 92000, bill_count: 195, avg_bill: 471.79 },
];

const mockMonthlyReport = [
  { month: 'January 2024', total_sales: 150000, bill_count: 250, avg_bill: 600 },
  { month: 'February 2024', total_sales: 165000, bill_count: 275, avg_bill: 600 },
];

const mockTopProducts = [
  { product_id: '1', product_name: 'Product 1', total_quantity: 500, total_revenue: 50000 },
  { product_id: '2', product_name: 'Product 2', total_quantity: 300, total_revenue: 60000 },
  { product_id: '3', product_name: 'Product 3', total_quantity: 200, total_revenue: 30000 },
];

const mockTopCustomers = [
  { customer_id: '2', customer_name: 'Jane Smith', total_purchases: 32000, bill_count: 8 },
  { customer_id: '1', customer_name: 'John Doe', total_purchases: 15000, bill_count: 5 },
];

const mockDepartmentReport = [
  { department_id: '1', department_name: 'Electronics', total_sales: 75000, bill_count: 120 },
  { department_id: '2', department_name: 'Clothing', total_sales: 45000, bill_count: 80 },
  { department_id: '3', department_name: 'Food', total_sales: 30000, bill_count: 50 },
];

const mockCashierReport = [
  { cashier_id: '3', cashier_name: 'Cashier User', total_bills: 250, total_sales: 150000 },
];

const mockTaxReport = [
  { tax_rate: 5, total_taxable: 100000, total_tax: 5000 },
  { tax_rate: 0, total_taxable: 50000, total_tax: 0 },
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  const { path } = event;
  const pathSegments = path
    .replace(/^\/(\.netlify\/functions\/)?(?:api\/)?sales/, '')
    .split('/')
    .filter(Boolean);
  const reportType = pathSegments[0];

  switch (reportType) {
    case 'dashboard':
      return successResponse(mockDashboard);

    case 'daily':
      return successResponse(mockDailyReport);

    case 'weekly':
      return successResponse(mockWeeklyReport);

    case 'monthly':
      return successResponse(mockMonthlyReport);

    case 'department':
      return successResponse(mockDepartmentReport);

    case 'product':
      return successResponse(mockTopProducts);

    case 'cashier':
      return successResponse(mockCashierReport);

    case 'tax':
      return successResponse(mockTaxReport);

    case 'top-products':
      return successResponse(mockTopProducts);

    case 'top-customers':
      return successResponse(mockTopCustomers);

    default:
      return successResponse([]);
  }
};
