# Deployment Guide - Departmental Store Billing Software

This guide walks you through deploying the Departmental Store Billing Software to **Netlify** (frontend + serverless functions) with **Supabase** (PostgreSQL database).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Database Setup (Supabase)](#step-1-database-setup-supabase)
4. [Step 2: Netlify Setup](#step-2-netlify-setup)
5. [Step 3: Environment Variables](#step-3-environment-variables)
6. [Step 4: Deploy](#step-4-deploy)
7. [Step 5: Post-Deployment](#step-5-post-deployment)
8. [CI/CD with GitHub Actions](#cicd-with-github-actions)
9. [Environment Variables Reference](#environment-variables-reference)
10. [Troubleshooting](#troubleshooting)
11. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

- GitHub account with repository access
- [Netlify](https://netlify.com) account (free tier works)
- [Supabase](https://supabase.com) account (free tier works)
- [Razorpay](https://razorpay.com) account for payment processing (optional)
- Node.js 18+ installed locally

---

## Architecture Overview

```
GitHub Repository
       │
       ▼ (push to main)
GitHub Actions (CI/CD)
       │
       ├── Run Tests
       ├── Build React App
       └── Deploy to Netlify
              │
              ├── Frontend (React SPA)
              │   └── CDN Edge Nodes (Global)
              │
              └── Netlify Functions (Serverless)
                     │
                     └── Supabase PostgreSQL
                            (Database)
```

**Request Flow:**
```
User Browser → Netlify CDN → React App (SPA)
User Browser → /.netlify/functions/api/* → Serverless Function → Supabase DB
```

---

## Step 1: Database Setup (Supabase)

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click **New Project**
4. Fill in:
   - **Name**: `departmental-store-billing`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `ap-south-1` for India)
5. Click **Create new project** and wait ~2 minutes

### 1.2 Get Connection Details

1. Go to **Project Settings** → **Database**
2. Under **Connection string**, select **URI**
3. Copy the connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password

### 1.3 Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the contents of `database/schema.sql` and paste it
4. Click **Run** (or press Ctrl+Enter)
5. Verify tables were created in **Table Editor**

### 1.4 Load Sample Data (Optional)

1. In SQL Editor, create another new query
2. Copy and paste the contents of `database/seed.sql`
3. Click **Run**

> **Default Login Credentials after seeding:**
> - Admin: `admin@store.com` / `Admin@123456`
> - Manager: `manager@store.com` / `Manager@123456`
> - Cashier: `cashier@store.com` / `Cashier@123456`

---

## Step 2: Netlify Setup

### 2.1 Create Netlify Site

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click **Add new site** → **Import an existing project**
4. Select **GitHub**
5. Authorize Netlify to access your GitHub account
6. Select your repository: `departmental-store-billing`

### 2.2 Configure Build Settings

Netlify should auto-detect from `netlify.toml`, but verify:

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/build` |
| Functions directory | `functions` |

### 2.3 Deploy Settings

- Netlify will deploy automatically on every push to `main`
- Branch deploys create preview URLs
- Deploy previews work for pull requests

---

## Step 3: Environment Variables

### 3.1 Required Variables

In Netlify Dashboard → **Site Settings** → **Environment Variables**, add:

#### Database
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### Authentication
```
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

#### Application
```
NODE_ENV=production
```

#### Frontend
```
REACT_APP_API_URL=/.netlify/functions
REACT_APP_APP_NAME=My Departmental Store
REACT_APP_ENV=production
```

#### Payment Gateway (Razorpay)
```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-secret-key
REACT_APP_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

#### Store Information
```
STORE_NAME=My Departmental Store
STORE_ADDRESS=123 Store Street, City, State - 000000
STORE_PHONE=+91 XXXXX XXXXX
STORE_EMAIL=info@yourstore.com
STORE_GST_NUMBER=XXXXXXXXXXXX
```

### 3.2 GitHub Actions Secrets

Add these secrets in GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `NETLIFY_AUTH_TOKEN` | From Netlify: User Settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID` | From Netlify: Site Settings → General → Site ID |

---

## Step 4: Deploy

### 4.1 Automatic Deployment (Recommended)

Simply push to the `main` branch:

```bash
git add .
git commit -m "Deploy departmental store billing software"
git push origin main
```

GitHub Actions will:
1. Run tests
2. Build the React app
3. Deploy to Netlify production

### 4.2 Manual Deployment via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site (first time only)
netlify init

# Deploy to production
netlify deploy --prod --dir=frontend/build --functions=functions

# Deploy preview (staging)
netlify deploy --dir=frontend/build --functions=functions
```

### 4.3 Deploy via Netlify Dashboard

1. Go to your Netlify site
2. Click **Deploys**
3. Drag and drop the `frontend/build` folder to trigger a deploy

---

## Step 5: Post-Deployment

### 5.1 Custom Domain (Optional)

1. In Netlify Dashboard → **Domain Management**
2. Click **Add custom domain**
3. Enter your domain: `billing.yourstore.com`
4. Update your DNS:
   ```
   Type: CNAME
   Name: billing
   Value: your-site-name.netlify.app
   ```
5. Wait for DNS propagation (up to 24 hours)
6. Netlify auto-provisions SSL certificate

### 5.2 Verify Deployment

After deployment, test these endpoints:

```bash
# Health check (replace with your Netlify URL)
curl https://your-site.netlify.app

# Test auth endpoint
curl -X POST https://your-site.netlify.app/.netlify/functions/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@store.com","password":"Admin@123456"}'

# Test with token
TOKEN=$(curl -s -X POST https://your-site.netlify.app/.netlify/functions/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@store.com","password":"Admin@123456"}' | jq -r '.data.token')

curl https://your-site.netlify.app/.netlify/functions/api/inventory \
  -H "Authorization: Bearer $TOKEN"
```

---

## CI/CD with GitHub Actions

The `.github/workflows/deploy.yml` workflow runs on:

- **Push to `main`/`master`**: Full deployment to production
- **Pull Request**: Deploy preview build for review

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | Your Netlify site's unique ID |

### Workflow Steps

1. **Test** - Runs frontend tests and verifies function files
2. **Build** - Builds React application with production env vars
3. **Deploy Production** - Deploys to Netlify (push to main only)
4. **Deploy Preview** - Creates preview URL (PRs only)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32-char secret for JWT signing |
| `JWT_EXPIRES_IN` | Optional | Token expiry (default: `24h`) |
| `NODE_ENV` | ✅ | Set to `production` |
| `REACT_APP_API_URL` | ✅ | Set to `/.netlify/functions` |
| `REACT_APP_APP_NAME` | Optional | Display name in UI |
| `RAZORPAY_KEY_ID` | Optional | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay secret key |
| `REACT_APP_RAZORPAY_KEY_ID` | Optional | Razorpay key for frontend |
| `STORE_NAME` | Optional | Store display name |
| `STORE_GST_NUMBER` | Optional | GST number for receipts |

---

## Troubleshooting

### Build Fails

**Error: `Module not found`**
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Error: `CI=true` breaks build**
- Add `CI=false` to Netlify environment variables, or
- Fix all ESLint warnings in the code

### Functions Not Working

**Error: `Function not found`**
- Verify `functions` directory path in `netlify.toml`
- Check that function files export `handler`

**Error: `Database connection failed`**
- Verify `DATABASE_URL` is set correctly in Netlify env vars
- Check Supabase project is active (not paused)
- Ensure SSL is configured: add `?sslmode=require` to connection string if needed

**Error: `401 Unauthorized`**
- Check `JWT_SECRET` is set in Netlify env vars
- Verify token is being sent in `Authorization: Bearer <token>` header

### Database Issues

**Tables don't exist**
- Run `database/schema.sql` in Supabase SQL Editor

**Connection timeout**
- Supabase free tier may pause after inactivity
- Go to Supabase Dashboard and "Resume" the project
- Consider upgrading to paid tier for production

### Common Errors

| Error | Solution |
|-------|----------|
| `CORS error` | Check headers in `netlify.toml` |
| `404 on refresh` | Verify `[[redirects]]` in `netlify.toml` |
| `Function timeout` | Optimize DB queries, add indexes |
| `Build: ENOMEM` | Upgrade Netlify plan or optimize build |

---

## Post-Deployment Checklist

### Security
- [ ] `JWT_SECRET` is at least 32 characters and random
- [ ] Database password is strong and not default
- [ ] Razorpay is set to live mode (not test mode)
- [ ] HTTPS is enabled (automatic on Netlify)
- [ ] Remove default seed users or change their passwords

### Functionality
- [ ] Admin can log in at `/login`
- [ ] Dashboard shows correct data
- [ ] POS system creates bills successfully
- [ ] Inventory products are visible
- [ ] Payment processing works

### Performance
- [ ] Build is optimized (check Netlify deploy logs)
- [ ] CDN caching is configured
- [ ] Database indexes are in place (check `schema.sql`)

### Monitoring
- [ ] Set up Netlify Analytics
- [ ] Configure error alerting
- [ ] Set up database backups in Supabase
- [ ] Monitor Netlify function logs

### Backups
- [ ] Enable point-in-time recovery in Supabase (paid feature)
- [ ] Export database schema regularly
- [ ] Document environment variables securely

---

## Support

- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs
- **Razorpay Docs**: https://razorpay.com/docs
- **GitHub Issues**: Create an issue in this repository

---

*Last updated: April 2026*
