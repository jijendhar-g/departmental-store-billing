/**
 * Sales Analytics API - Netlify Function
 * Handles sales reports, dashboards, and analytics
 */

const { query } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  withErrorHandling,
  successResponse,
  errorResponse,
  getQueryParams,
} = require('../middleware/errorHandler');

const handler = async (event) => {
  const { httpMethod, path } = event;
  const pathSegments = path.replace('/.netlify/functions/api/sales', '').split('/').filter(Boolean);
  const reportType = pathSegments[0];

  const user = verifyToken(event);
  requireRole(user, ['admin', 'manager']);

  if (httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  switch (reportType) {
    case 'dashboard':
      return getDashboardStats(event);
    case 'daily':
      return getDailyReport(event);
    case 'weekly':
      return getWeeklyReport(event);
    case 'monthly':
      return getMonthlyReport(event);
    case 'department':
      return getDepartmentReport(event);
    case 'product':
      return getProductReport(event);
    case 'cashier':
      return getCashierReport(event);
    case 'tax':
      return getTaxReport(event);
    case 'top-products':
      return getTopProducts(event);
    case 'top-customers':
      return getTopCustomers(event);
    default:
      return getDashboardStats(event);
  }
};

const getDashboardStats = async (event) => {
  const { startDate, endDate } = getQueryParams(event);

  const today = new Date().toISOString().split('T')[0];
  const start = startDate || today;
  const end = endDate || today;

  const [todayStats, weekStats, monthStats, lowStock, recentBills] = await Promise.all([
    // Today's stats
    query(
      `SELECT
         COUNT(*) AS total_transactions,
         COALESCE(SUM(net_amount), 0) AS total_revenue,
         COALESCE(SUM(tax_amount), 0) AS total_tax,
         COALESCE(SUM(discount_amount), 0) AS total_discounts,
         COALESCE(AVG(net_amount), 0) AS avg_transaction_value
       FROM bills
       WHERE DATE(created_at) = $1 AND status = 'completed'`,
      [today]
    ),

    // This week's stats
    query(
      `SELECT
         COUNT(*) AS total_transactions,
         COALESCE(SUM(net_amount), 0) AS total_revenue
       FROM bills
       WHERE created_at >= DATE_TRUNC('week', NOW()) AND status = 'completed'`
    ),

    // This month's stats
    query(
      `SELECT
         COUNT(*) AS total_transactions,
         COALESCE(SUM(net_amount), 0) AS total_revenue
       FROM bills
       WHERE created_at >= DATE_TRUNC('month', NOW()) AND status = 'completed'`
    ),

    // Low stock count
    query(
      'SELECT COUNT(*) FROM products WHERE is_active = true AND stock_quantity <= minimum_stock'
    ),

    // Recent bills
    query(
      `SELECT b.id, b.bill_number, b.net_amount, b.payment_method,
              b.status, c.name AS customer_name, b.created_at
       FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.status = 'completed'
       ORDER BY b.created_at DESC
       LIMIT 10`
    ),
  ]);

  return successResponse({
    today: todayStats.rows[0],
    week: weekStats.rows[0],
    month: monthStats.rows[0],
    lowStockAlerts: parseInt(lowStock.rows[0].count),
    recentBills: recentBills.rows,
  });
};

const getDailyReport = async (event) => {
  const { date } = getQueryParams(event);
  const targetDate = date || new Date().toISOString().split('T')[0];

  const [summary, hourlyBreakdown, paymentBreakdown, topProducts] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_transactions,
         COALESCE(SUM(net_amount), 0) AS total_revenue,
         COALESCE(SUM(tax_amount), 0) AS total_tax,
         COALESCE(SUM(discount_amount), 0) AS total_discounts,
         COALESCE(AVG(net_amount), 0) AS avg_transaction_value,
         COUNT(DISTINCT customer_id) AS unique_customers
       FROM bills
       WHERE DATE(created_at) = $1 AND status = 'completed'`,
      [targetDate]
    ),

    query(
      `SELECT
         EXTRACT(HOUR FROM created_at) AS hour,
         COUNT(*) AS transactions,
         COALESCE(SUM(net_amount), 0) AS revenue
       FROM bills
       WHERE DATE(created_at) = $1 AND status = 'completed'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [targetDate]
    ),

    query(
      `SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(net_amount), 0) AS amount
       FROM bills
       WHERE DATE(created_at) = $1 AND status = 'completed'
       GROUP BY payment_method
       ORDER BY amount DESC`,
      [targetDate]
    ),

    query(
      `SELECT p.name, SUM(bi.quantity) AS total_sold, SUM(bi.total_price) AS revenue
       FROM bill_items bi
       JOIN products p ON bi.product_id = p.id
       JOIN bills b ON bi.bill_id = b.id
       WHERE DATE(b.created_at) = $1 AND b.status = 'completed'
       GROUP BY p.id, p.name
       ORDER BY revenue DESC
       LIMIT 10`,
      [targetDate]
    ),
  ]);

  return successResponse({
    date: targetDate,
    summary: summary.rows[0],
    hourlyBreakdown: hourlyBreakdown.rows,
    paymentBreakdown: paymentBreakdown.rows,
    topProducts: topProducts.rows,
  });
};

const getWeeklyReport = async (event) => {
  const { weekStart } = getQueryParams(event);

  const result = await query(
    `SELECT
       DATE(created_at) AS date,
       TO_CHAR(created_at, 'Day') AS day_name,
       COUNT(*) AS total_transactions,
       COALESCE(SUM(net_amount), 0) AS total_revenue,
       COALESCE(SUM(tax_amount), 0) AS total_tax
     FROM bills
     WHERE created_at >= COALESCE($1::date, DATE_TRUNC('week', NOW()))
       AND created_at < COALESCE($1::date, DATE_TRUNC('week', NOW())) + INTERVAL '7 days'
       AND status = 'completed'
     GROUP BY DATE(created_at), TO_CHAR(created_at, 'Day')
     ORDER BY date`,
    [weekStart || null]
  );

  const totals = await query(
    `SELECT
       COUNT(*) AS total_transactions,
       COALESCE(SUM(net_amount), 0) AS total_revenue,
       COALESCE(SUM(tax_amount), 0) AS total_tax,
       COALESCE(AVG(net_amount), 0) AS avg_transaction_value
     FROM bills
     WHERE created_at >= COALESCE($1::date, DATE_TRUNC('week', NOW()))
       AND created_at < COALESCE($1::date, DATE_TRUNC('week', NOW())) + INTERVAL '7 days'
       AND status = 'completed'`,
    [weekStart || null]
  );

  return successResponse({
    dailyBreakdown: result.rows,
    totals: totals.rows[0],
  });
};

const getMonthlyReport = async (event) => {
  const { year, month } = getQueryParams(event);
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);

  const [summary, weeklyBreakdown, departmentBreakdown] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_transactions,
         COALESCE(SUM(net_amount), 0) AS total_revenue,
         COALESCE(SUM(tax_amount), 0) AS total_tax,
         COALESCE(SUM(discount_amount), 0) AS total_discounts,
         COALESCE(AVG(net_amount), 0) AS avg_transaction_value,
         COUNT(DISTINCT customer_id) AS unique_customers
       FROM bills
       WHERE EXTRACT(YEAR FROM created_at) = $1
         AND EXTRACT(MONTH FROM created_at) = $2
         AND status = 'completed'`,
      [targetYear, targetMonth]
    ),

    query(
      `SELECT
         DATE_TRUNC('week', created_at) AS week_start,
         COUNT(*) AS transactions,
         COALESCE(SUM(net_amount), 0) AS revenue
       FROM bills
       WHERE EXTRACT(YEAR FROM created_at) = $1
         AND EXTRACT(MONTH FROM created_at) = $2
         AND status = 'completed'
       GROUP BY DATE_TRUNC('week', created_at)
       ORDER BY week_start`,
      [targetYear, targetMonth]
    ),

    query(
      `SELECT d.name AS department, COUNT(b.id) AS transactions,
              COALESCE(SUM(bi.total_price), 0) AS revenue
       FROM departments d
       LEFT JOIN products p ON p.department_id = d.id
       LEFT JOIN bill_items bi ON bi.product_id = p.id
       LEFT JOIN bills b ON bi.bill_id = b.id
         AND EXTRACT(YEAR FROM b.created_at) = $1
         AND EXTRACT(MONTH FROM b.created_at) = $2
         AND b.status = 'completed'
       GROUP BY d.id, d.name
       ORDER BY revenue DESC`,
      [targetYear, targetMonth]
    ),
  ]);

  return successResponse({
    year: targetYear,
    month: targetMonth,
    summary: summary.rows[0],
    weeklyBreakdown: weeklyBreakdown.rows,
    departmentBreakdown: departmentBreakdown.rows,
  });
};

const getDepartmentReport = async (event) => {
  const { startDate, endDate, departmentId } = getQueryParams(event);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  let whereClause = 'WHERE b.created_at BETWEEN $1 AND $2 AND b.status = \'completed\'';
  const params = [start, end];

  if (departmentId) {
    params.push(departmentId);
    whereClause += ` AND p.department_id = $${params.length}`;
  }

  const result = await query(
    `SELECT d.id, d.name AS department,
            COUNT(DISTINCT b.id) AS total_bills,
            COALESCE(SUM(bi.quantity), 0) AS items_sold,
            COALESCE(SUM(bi.total_price), 0) AS revenue,
            COALESCE(SUM(bi.tax_amount), 0) AS tax_collected
     FROM departments d
     LEFT JOIN products p ON p.department_id = d.id
     LEFT JOIN bill_items bi ON bi.product_id = p.id
     LEFT JOIN bills b ON bi.bill_id = b.id ${whereClause}
     GROUP BY d.id, d.name
     ORDER BY revenue DESC`,
    params
  );

  return successResponse({ departments: result.rows, startDate: start, endDate: end });
};

const getProductReport = async (event) => {
  const { startDate, endDate, department, limit = 20 } = getQueryParams(event);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const params = [start, end, parseInt(limit)];
  let departmentFilter = '';

  if (department) {
    params.push(department);
    departmentFilter = `AND p.department_id = $${params.length}`;
  }

  const result = await query(
    `SELECT p.id, p.name, p.sku, p.category,
            COALESCE(SUM(bi.quantity), 0) AS total_sold,
            COALESCE(SUM(bi.total_price), 0) AS revenue,
            COALESCE(SUM(bi.tax_amount), 0) AS tax_collected,
            p.stock_quantity AS current_stock
     FROM products p
     LEFT JOIN bill_items bi ON bi.product_id = p.id
     LEFT JOIN bills b ON bi.bill_id = b.id
       AND b.created_at BETWEEN $1 AND $2
       AND b.status = 'completed'
     WHERE p.is_active = true ${departmentFilter}
     GROUP BY p.id, p.name, p.sku, p.category, p.stock_quantity
     ORDER BY revenue DESC
     LIMIT $3`,
    params
  );

  return successResponse({ products: result.rows, startDate: start, endDate: end });
};

const getCashierReport = async (event) => {
  const { startDate, endDate } = getQueryParams(event);
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT u.id, u.name AS cashier,
            COUNT(b.id) AS total_bills,
            COALESCE(SUM(b.net_amount), 0) AS total_revenue,
            COALESCE(AVG(b.net_amount), 0) AS avg_bill_value,
            COALESCE(SUM(b.discount_amount), 0) AS total_discounts
     FROM users u
     LEFT JOIN bills b ON b.cashier_id = u.id
       AND b.created_at BETWEEN $1 AND $2
       AND b.status = 'completed'
     WHERE u.role = 'cashier' AND u.is_active = true
     GROUP BY u.id, u.name
     ORDER BY total_revenue DESC`,
    [start, end]
  );

  return successResponse({ cashiers: result.rows, startDate: start, endDate: end });
};

const getTaxReport = async (event) => {
  const { startDate, endDate } = getQueryParams(event);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const [summary, byTaxRate] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_bills,
         COALESCE(SUM(net_amount), 0) AS total_revenue,
         COALESCE(SUM(tax_amount), 0) AS total_tax_collected
       FROM bills
       WHERE created_at BETWEEN $1 AND $2 AND status = 'completed'`,
      [start, end]
    ),
    query(
      `SELECT bi.tax_rate,
              COALESCE(SUM(bi.total_price - bi.tax_amount), 0) AS taxable_amount,
              COALESCE(SUM(bi.tax_amount), 0) AS tax_amount,
              COUNT(DISTINCT b.id) AS bills_count
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.created_at BETWEEN $1 AND $2 AND b.status = 'completed'
       GROUP BY bi.tax_rate
       ORDER BY bi.tax_rate`,
      [start, end]
    ),
  ]);

  return successResponse({
    summary: summary.rows[0],
    byTaxRate: byTaxRate.rows,
    startDate: start,
    endDate: end,
  });
};

const getTopProducts = async (event) => {
  const { limit = 10, startDate, endDate } = getQueryParams(event);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT p.id, p.name, p.sku, p.category,
            SUM(bi.quantity) AS total_sold,
            SUM(bi.total_price) AS revenue
     FROM bill_items bi
     JOIN products p ON bi.product_id = p.id
     JOIN bills b ON bi.bill_id = b.id
     WHERE b.created_at BETWEEN $1 AND $2 AND b.status = 'completed'
     GROUP BY p.id, p.name, p.sku, p.category
     ORDER BY total_sold DESC
     LIMIT $3`,
    [start, end, parseInt(limit)]
  );

  return successResponse(result.rows);
};

const getTopCustomers = async (event) => {
  const { limit = 10, startDate, endDate } = getQueryParams(event);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier,
            COUNT(b.id) AS total_bills,
            SUM(b.net_amount) AS total_spent
     FROM customers c
     JOIN bills b ON b.customer_id = c.id
     WHERE b.created_at BETWEEN $1 AND $2 AND b.status = 'completed'
     GROUP BY c.id, c.name, c.email, c.phone, c.loyalty_tier
     ORDER BY total_spent DESC
     LIMIT $3`,
    [start, end, parseInt(limit)]
  );

  return successResponse(result.rows);
};

exports.handler = withErrorHandling(handler);
