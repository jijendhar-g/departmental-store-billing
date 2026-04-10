import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { authAPI } from './services/api';
import env from './config/env';

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      authAPI.getProfile()
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    const { token, refreshToken, user: userData } = res.data;
    localStorage.setItem('authToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// ============================================================
// Protected Route
// ============================================================
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// ============================================================
// Login Page
// ============================================================
const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🏪 {env.appName}</h1>
        <p>Sign in to your account to continue</p>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@store.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================
// Sidebar Navigation
// ============================================================
const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        🏪 <span>Store Billing</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard">📊 <span>Dashboard</span></NavLink>
        <NavLink to="/pos">💳 <span>POS / Billing</span></NavLink>
        <NavLink to="/inventory">📦 <span>Inventory</span></NavLink>
        <NavLink to="/customers">👥 <span>Customers</span></NavLink>
        {['admin', 'manager'].includes(user?.role) && (
          <>
            <NavLink to="/sales">📈 <span>Sales Reports</span></NavLink>
            <NavLink to="/departments">🏢 <span>Departments</span></NavLink>
          </>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/users">👤 <span>Users</span></NavLink>
        )}
      </nav>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '8px' }}>
          {user?.name} ({user?.role})
        </div>
        <button
          onClick={logout}
          className="btn btn-secondary"
          style={{ width: '100%', fontSize: '0.8rem' }}
        >
          🚪 <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Dashboard Page
// ============================================================
const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    import('./services/api').then(({ salesAPI }) => {
      salesAPI.getDashboard()
        .then((res) => setStats(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (error) return <div className="error-container">⚠️ {error}</div>;

  return (
    <div>
      <div className="navbar">
        <h2>📊 Dashboard</h2>
        <span style={{ color: '#666', fontSize: '0.875rem' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Today's Revenue</h3>
          <div className="value">₹{parseFloat(stats?.today?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#388e3c' }}>
          <h3>Today's Transactions</h3>
          <div className="value">{stats?.today?.total_transactions || 0}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#f57c00' }}>
          <h3>This Week's Revenue</h3>
          <div className="value">₹{parseFloat(stats?.week?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#7b1fa2' }}>
          <h3>This Month's Revenue</h3>
          <div className="value">₹{parseFloat(stats?.month?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        {stats?.lowStockAlerts > 0 && (
          <div className="stat-card" style={{ borderLeftColor: '#d32f2f' }}>
            <h3>⚠️ Low Stock Alerts</h3>
            <div className="value" style={{ color: '#d32f2f' }}>{stats.lowStockAlerts}</div>
          </div>
        )}
      </div>

      {stats?.recentBills?.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Recent Transactions</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBills.map((bill) => (
                  <tr key={bill.id}>
                    <td><strong>{bill.bill_number}</strong></td>
                    <td>{bill.customer_name || 'Walk-in'}</td>
                    <td>₹{parseFloat(bill.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textTransform: 'capitalize' }}>{bill.payment_method}</td>
                    <td>
                      <span className={`badge badge-${bill.status === 'completed' ? 'success' : 'warning'}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td>{new Date(bill.created_at).toLocaleTimeString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// POS Page (Simplified)
// ============================================================
const POSPage = () => {
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const searchProducts = async (query) => {
    if (!query.trim()) return;
    try {
      const { inventoryAPI } = await import('./services/api');
      const res = await inventoryAPI.searchProducts(query);
      setProducts(res.data || []);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    try {
      const { billingAPI } = await import('./services/api');
      await billingAPI.createBill({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
      });
      setCart([]);
      setMessage('✅ Bill created successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  };

  return (
    <div>
      <div className="navbar">
        <h2>💳 Point of Sale</h2>
        <span style={{ color: '#666' }}>Cashier: {user?.name}</span>
      </div>

      {message && (
        <div style={{ background: message.startsWith('✅') ? '#e8f5e9' : '#ffebee', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', color: message.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
          {message}
        </div>
      )}

      <div className="pos-layout">
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Search products by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchProducts(searchQuery)}
                style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem' }}
              />
              <button className="btn btn-primary" onClick={() => searchProducts(searchQuery)}>
                Search
              </button>
            </div>
          </div>

          <div className="product-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📦</div>
                <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '0.875rem' }}>{product.name}</div>
                <div style={{ color: '#1976d2', fontWeight: '700' }}>₹{parseFloat(product.price).toFixed(2)}</div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                  Stock: {product.stock_quantity}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cart-panel">
          <h3 style={{ marginBottom: '16px' }}>🛒 Cart</h3>
          {cart.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Cart is empty</p>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{item.name}</div>
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>₹{item.price} × {item.quantity}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.productId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', fontSize: '1.2rem' }}>×</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px' }}>
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="upi">📱 UPI</option>
                    <option value="wallet">👛 Wallet</option>
                  </select>
                </div>

                <button className="btn btn-success" style={{ width: '100%' }} onClick={checkout}>
                  ✅ Complete Payment - ₹{total.toFixed(2)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Placeholder pages for other sections
// ============================================================
const PlaceholderPage = ({ title, icon }) => (
  <div>
    <div className="navbar">
      <h2>{icon} {title}</h2>
    </div>
    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{icon}</div>
      <h2 style={{ marginBottom: '8px' }}>{title}</h2>
      <p style={{ color: '#666' }}>This section is connected to the Netlify Functions API.</p>
      <p style={{ color: '#999', fontSize: '0.875rem', marginTop: '8px' }}>API endpoint: <code>/.netlify/functions/api/{title.toLowerCase().replace(' ', '-')}</code></p>
    </div>
  </div>
);

// ============================================================
// App Layout
// ============================================================
const AppLayout = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-content">
      {children}
    </div>
  </div>
);

// ============================================================
// Main App
// ============================================================
const AppRoutes = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><PlaceholderPage title="Inventory" icon="📦" /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><PlaceholderPage title="Customers" icon="👥" /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute roles={['admin', 'manager']}><PlaceholderPage title="Sales Reports" icon="📈" /></ProtectedRoute>} />
        <Route path="/departments" element={<ProtectedRoute roles={['admin', 'manager']}><PlaceholderPage title="Departments" icon="🏢" /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><PlaceholderPage title="Users" icon="👤" /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;
