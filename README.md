# 🏪 Departmental Store Billing Software

A comprehensive billing and POS system for departmental stores with inventory management, sales analytics, and advanced features. Deployed on **Netlify** with serverless functions and **Supabase** PostgreSQL.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jijendhar-g/departmental-store-billing)

---

## ✨ Features

### 🏪 Point of Sale (POS)
- Real-time billing with barcode scanning support
- Multiple payment methods (Cash, Card, UPI, Wallet)
- Digital receipts generation
- Return and exchange management

### 📦 Inventory Management
- Real-time stock tracking across departments
- Low stock alerts and notifications
- Stock adjustment with audit trail
- Supplier management

### 👥 Customer Management
- Customer profiles and purchase history
- Loyalty points system (Bronze/Silver/Gold/Platinum)
- Points redemption for discounts
- SMS/Email notifications

### 📊 Sales Analytics
- Real-time dashboard with KPIs
- Daily, weekly, and monthly reports
- Department and product performance
- Tax reports for GST compliance
- Top products and customers

### 🏢 Multi-Department Support
- Unlimited departments
- Department-wise inventory and reporting
- Role-based access per department

### 🔐 Security & Authentication
- JWT-based authentication
- Role-based access control (Admin, Manager, Cashier)
- Secure HTTPS with SSL (automatic on Netlify)
- Content Security Policy headers

### 💳 Payment Processing
- Razorpay payment gateway integration
- Cash, Card, UPI payment methods
- Refund processing
- Payment audit trail

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [Supabase](https://supabase.com) account (free tier)
- [Netlify](https://netlify.com) account (free tier)

### Local Development

```bash
# Clone the repository
git clone https://github.com/jijendhar-g/departmental-store-billing.git
cd departmental-store-billing

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations (in Supabase SQL Editor)
# Copy and paste: database/schema.sql
# Copy and paste: database/seed.sql (optional - for sample data)

# Start development server
npm run dev
```

Access the app at `http://localhost:3000`

### Default Login (after seeding)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@store.com | Admin@123456 |
| Manager | manager@store.com | Manager@123456 |
| Cashier | cashier@store.com | Cashier@123456 |

---

## 📁 Project Structure

```
departmental-store-billing/
├── functions/                    # Netlify Serverless Functions
│   ├── api/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── billing.js            # Billing operations
│   │   ├── customers.js          # Customer management
│   │   ├── departments.js        # Department management
│   │   ├── inventory.js          # Inventory management
│   │   ├── payments.js           # Payment processing
│   │   └── sales.js              # Sales analytics
│   ├── middleware/
│   │   ├── auth.js               # JWT verification
│   │   └── errorHandler.js       # Error handling
│   └── database.js               # PostgreSQL connection pool
│
├── frontend/                     # React.js Frontend
│   ├── public/
│   └── src/
│       ├── config/
│       │   └── env.js            # Environment configuration
│       ├── services/
│       │   └── api.js            # API service layer
│       ├── App.js                # Main app with routing
│       └── index.js              # App entry point
│
├── database/
│   ├── schema.sql                # Database schema & migrations
│   └── seed.sql                  # Sample data
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD automation
│
├── netlify.toml                  # Netlify configuration
├── .env.example                  # Environment variables template
├── .env.production               # Production env template
├── package.json                  # Root package configuration
├── DEPLOYMENT.md                 # Complete deployment guide
└── README.md
```

---

## 🌐 API Endpoints

All API endpoints are available via Netlify Functions:

| Endpoint | Description |
|----------|-------------|
| `POST /.netlify/functions/api/auth/login` | User login |
| `GET /.netlify/functions/api/auth/me` | Get current user |
| `GET /.netlify/functions/api/billing` | List bills |
| `POST /.netlify/functions/api/billing` | Create new bill |
| `GET /.netlify/functions/api/inventory` | List products |
| `GET /.netlify/functions/api/inventory/low-stock` | Low stock alerts |
| `GET /.netlify/functions/api/customers` | List customers |
| `GET /.netlify/functions/api/sales/dashboard` | Dashboard stats |
| `GET /.netlify/functions/api/sales/daily` | Daily report |
| `GET /.netlify/functions/api/departments` | List departments |
| `POST /.netlify/functions/api/payments/initiate` | Initiate payment |

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React.js 18, React Router v6 |
| **Backend** | Netlify Functions (Node.js serverless) |
| **Database** | PostgreSQL (Supabase) |
| **Authentication** | JWT (jsonwebtoken) |
| **Payment** | Razorpay |
| **Deployment** | Netlify (Frontend + Functions) |
| **CI/CD** | GitHub Actions |

---

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment guide.

**Quick deploy to Netlify:**
1. Fork this repository
2. Connect to Netlify
3. Set up Supabase database
4. Configure environment variables
5. Push to `main` → Auto-deploys!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
