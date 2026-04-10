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
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
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
    apiClient.post('/api/auth/login', { email, password }),

  logout: () =>
    apiClient.post('/api/auth/logout'),

  refreshToken: (refreshToken) =>
    apiClient.post('/api/auth/refresh', { refreshToken }),

  getProfile: () =>
    apiClient.get('/api/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/api/auth/change-password', { currentPassword, newPassword }),

  registerUser: (userData) =>
    apiClient.post('/api/auth/register', userData),
};

// ============================================================
// Billing API
// ============================================================
export const billingAPI = {
  getBills: (params = {}) =>
    apiClient.get('/api/billing', { params }),

  getBillById: (billId) =>
    apiClient.get(`/api/billing/${billId}`),

  createBill: (billData) =>
    apiClient.post('/api/billing', billData),

  updateBill: (billId, data) =>
    apiClient.put(`/api/billing/${billId}`, data),

  voidBill: (billId) =>
    apiClient.delete(`/api/billing/${billId}`),

  processReturn: (billId, returnData) =>
    apiClient.post(`/api/billing/${billId}/return`, returnData),
};

// ============================================================
// Inventory API
// ============================================================
export const inventoryAPI = {
  getProducts: (params = {}) =>
    apiClient.get('/api/inventory', { params }),

  getProductById: (productId) =>
    apiClient.get(`/api/inventory/${productId}`),

  searchProducts: (query) =>
    apiClient.get('/api/inventory/search', { params: { q: query } }),

  getLowStockProducts: () =>
    apiClient.get('/api/inventory/low-stock'),

  createProduct: (productData) =>
    apiClient.post('/api/inventory', productData),

  updateProduct: (productId, data) =>
    apiClient.put(`/api/inventory/${productId}`, data),

  adjustStock: (productId, adjustment, reason) =>
    apiClient.post(`/api/inventory/${productId}/adjust`, { adjustment, reason }),

  deleteProduct: (productId) =>
    apiClient.delete(`/api/inventory/${productId}`),
};

// ============================================================
// Customers API
// ============================================================
export const customersAPI = {
  getCustomers: (params = {}) =>
    apiClient.get('/api/customers', { params }),

  getCustomerById: (customerId) =>
    apiClient.get(`/api/customers/${customerId}`),

  getCustomerHistory: (customerId, params = {}) =>
    apiClient.get(`/api/customers/${customerId}/history`, { params }),

  getCustomerLoyalty: (customerId) =>
    apiClient.get(`/api/customers/${customerId}/loyalty`),

  createCustomer: (customerData) =>
    apiClient.post('/api/customers', customerData),

  updateCustomer: (customerId, data) =>
    apiClient.put(`/api/customers/${customerId}`, data),

  redeemLoyaltyPoints: (customerId, points) =>
    apiClient.put(`/api/customers/${customerId}/loyalty`, { points }),

  deleteCustomer: (customerId) =>
    apiClient.delete(`/api/customers/${customerId}`),
};

// ============================================================
// Sales Analytics API
// ============================================================
export const salesAPI = {
  getDashboard: (params = {}) =>
    apiClient.get('/api/sales/dashboard', { params }),

  getDailyReport: (date) =>
    apiClient.get('/api/sales/daily', { params: { date } }),

  getWeeklyReport: (weekStart) =>
    apiClient.get('/api/sales/weekly', { params: { weekStart } }),

  getMonthlyReport: (year, month) =>
    apiClient.get('/api/sales/monthly', { params: { year, month } }),

  getDepartmentReport: (params = {}) =>
    apiClient.get('/api/sales/department', { params }),

  getProductReport: (params = {}) =>
    apiClient.get('/api/sales/product', { params }),

  getCashierReport: (params = {}) =>
    apiClient.get('/api/sales/cashier', { params }),

  getTaxReport: (params = {}) =>
    apiClient.get('/api/sales/tax', { params }),

  getTopProducts: (params = {}) =>
    apiClient.get('/api/sales/top-products', { params }),

  getTopCustomers: (params = {}) =>
    apiClient.get('/api/sales/top-customers', { params }),
};

// ============================================================
// Departments API
// ============================================================
export const departmentsAPI = {
  getDepartments: (includeStats = false) =>
    apiClient.get('/api/departments', { params: { includeStats } }),

  getDepartmentById: (departmentId) =>
    apiClient.get(`/api/departments/${departmentId}`),

  createDepartment: (data) =>
    apiClient.post('/api/departments', data),

  updateDepartment: (departmentId, data) =>
    apiClient.put(`/api/departments/${departmentId}`, data),

  deleteDepartment: (departmentId) =>
    apiClient.delete(`/api/departments/${departmentId}`),
};

// ============================================================
// Payments API
// ============================================================
export const paymentsAPI = {
  getPayments: (params = {}) =>
    apiClient.get('/api/payments', { params }),

  getPaymentById: (paymentId) =>
    apiClient.get(`/api/payments/${paymentId}`),

  initiatePayment: (billId, method, amount) =>
    apiClient.post('/api/payments/initiate', { billId, method, amount }),

  verifyPayment: (verificationData) =>
    apiClient.post('/api/payments/verify', verificationData),

  recordPayment: (paymentData) =>
    apiClient.post('/api/payments', paymentData),

  processRefund: (paymentId, reason, amount) =>
    apiClient.post(`/api/payments/${paymentId}/refund`, { reason, amount }),
};

export default apiClient;
