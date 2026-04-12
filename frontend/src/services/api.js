/**
 * API Service Layer for Netlify Functions
 * Handles all API calls to backend serverless functions
 */

import axios from 'axios';
import env from '../config/env';

const API_BASE_URL = env.apiUrl;

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { token } = response.data.data;
          localStorage.setItem('authToken', token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch {
          // Refresh failed - clear storage and redirect to login
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    const errorMessage = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);

// ============================================================
// Auth API
// ============================================================
export const authAPI = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),

  logout: () =>
    apiClient.post('/auth/logout'),

  refreshToken: (refreshToken) =>
    apiClient.post('/auth/refresh', { refreshToken }),

  getProfile: () =>
    apiClient.get('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),

  registerUser: (userData) =>
    apiClient.post('/auth/register', userData),
};

// ============================================================
// Billing API
// ============================================================
export const billingAPI = {
  getBills: (params = {}) =>
    apiClient.get('/billing', { params }),

  getBillById: (billId) =>
    apiClient.get(`/billing/${billId}`),

  createBill: (billData) =>
    apiClient.post('/billing', billData),

  updateBill: (billId, data) =>
    apiClient.put(`/billing/${billId}`, data),

  voidBill: (billId) =>
    apiClient.delete(`/billing/${billId}`),

  processReturn: (billId, returnData) =>
    apiClient.post(`/billing/${billId}/return`, returnData),
};

// ============================================================
// Inventory API
// ============================================================
export const inventoryAPI = {
  getProducts: (params = {}) =>
    apiClient.get('/inventory', { params }),

  getProductById: (productId) =>
    apiClient.get(`/inventory/${productId}`),

  searchProducts: (query) =>
    apiClient.get('/inventory/search', { params: { q: query } }),

  getLowStockProducts: () =>
    apiClient.get('/inventory/low-stock'),

  createProduct: (productData) =>
    apiClient.post('/inventory', productData),

  updateProduct: (productId, data) =>
    apiClient.put(`/inventory/${productId}`, data),

  adjustStock: (productId, adjustment, reason) =>
    apiClient.post(`/inventory/${productId}/adjust`, { adjustment, reason }),

  deleteProduct: (productId) =>
    apiClient.delete(`/inventory/${productId}`),
};

// ============================================================
// Customers API
// ============================================================
export const customersAPI = {
  getCustomers: (params = {}) =>
    apiClient.get('/customers', { params }),

  getCustomerById: (customerId) =>
    apiClient.get(`/customers/${customerId}`),

  getCustomerHistory: (customerId, params = {}) =>
    apiClient.get(`/customers/${customerId}/history`, { params }),

  getCustomerLoyalty: (customerId) =>
    apiClient.get(`/customers/${customerId}/loyalty`),

  createCustomer: (customerData) =>
    apiClient.post('/customers', customerData),

  updateCustomer: (customerId, data) =>
    apiClient.put(`/customers/${customerId}`, data),

  redeemLoyaltyPoints: (customerId, points) =>
    apiClient.put(`/customers/${customerId}/loyalty`, { points }),

  deleteCustomer: (customerId) =>
    apiClient.delete(`/customers/${customerId}`),
};

// ============================================================
// Sales Analytics API
// ============================================================
export const salesAPI = {
  getDashboard: (params = {}) =>
    apiClient.get('/sales/dashboard', { params }),

  getDailyReport: (date) =>
    apiClient.get('/sales/daily', { params: { date } }),

  getWeeklyReport: (weekStart) =>
    apiClient.get('/sales/weekly', { params: { weekStart } }),

  getMonthlyReport: (year, month) =>
    apiClient.get('/sales/monthly', { params: { year, month } }),

  getDepartmentReport: (params = {}) =>
    apiClient.get('/sales/department', { params }),

  getProductReport: (params = {}) =>
    apiClient.get('/sales/product', { params }),

  getCashierReport: (params = {}) =>
    apiClient.get('/sales/cashier', { params }),

  getTaxReport: (params = {}) =>
    apiClient.get('/sales/tax', { params }),

  getTopProducts: (params = {}) =>
    apiClient.get('/sales/top-products', { params }),

  getTopCustomers: (params = {}) =>
    apiClient.get('/sales/top-customers', { params }),
};

// ============================================================
// Departments API
// ============================================================
export const departmentsAPI = {
  getDepartments: (includeStats = false) =>
    apiClient.get('/departments', { params: { includeStats } }),

  getDepartmentById: (departmentId) =>
    apiClient.get(`/departments/${departmentId}`),

  createDepartment: (data) =>
    apiClient.post('/departments', data),

  updateDepartment: (departmentId, data) =>
    apiClient.put(`/departments/${departmentId}`, data),

  deleteDepartment: (departmentId) =>
    apiClient.delete(`/departments/${departmentId}`),
};

// ============================================================
// Payments API
// ============================================================
export const paymentsAPI = {
  getPayments: (params = {}) =>
    apiClient.get('/payments', { params }),

  getPaymentById: (paymentId) =>
    apiClient.get(`/payments/${paymentId}`),

  initiatePayment: (billId, method, amount) =>
    apiClient.post('/payments/initiate', { billId, method, amount }),

  verifyPayment: (verificationData) =>
    apiClient.post('/payments/verify', verificationData),

  recordPayment: (paymentData) =>
    apiClient.post('/payments', paymentData),

  processRefund: (paymentId, reason, amount) =>
    apiClient.post(`/payments/${paymentId}/refund`, { reason, amount }),
};

export default apiClient;
