/**
 * Environment Configuration
 * Centralizes all environment variable access for the frontend
 */

const env = {
  // API Configuration
  apiUrl: process.env.REACT_APP_API_URL || '/.netlify/functions',
  appName: process.env.REACT_APP_APP_NAME || 'Departmental Store Billing',
  appVersion: process.env.REACT_APP_VERSION || '1.0.0',
  environment: process.env.REACT_APP_ENV || 'development',

  // Payment Gateway
  razorpayKeyId: process.env.REACT_APP_RAZORPAY_KEY_ID || '',

  // Supabase
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',

  // Feature Flags
  isProduction: process.env.REACT_APP_ENV === 'production',
  isDevelopment: process.env.REACT_APP_ENV !== 'production',
};

export default env;
