-- =============================================================
-- Departmental Store Billing - Seed Data
-- Insert sample data for testing and demo purposes
-- =============================================================

-- Insert Departments
INSERT INTO departments (id, name, description, is_active) VALUES
    ('d1000000-0000-0000-0000-000000000001', 'Groceries', 'Daily essentials, food items, and beverages', true),
    ('d1000000-0000-0000-0000-000000000002', 'Electronics', 'Consumer electronics, appliances, and accessories', true),
    ('d1000000-0000-0000-0000-000000000003', 'Clothing', 'Apparel, footwear, and fashion accessories', true),
    ('d1000000-0000-0000-0000-000000000004', 'Home & Kitchen', 'Household items, kitchenware, and furniture', true),
    ('d1000000-0000-0000-0000-000000000005', 'Health & Beauty', 'Personal care, medicines, and wellness products', true)
ON CONFLICT (name) DO NOTHING;

-- Insert Admin User (password: Admin@123456)
-- Hash generated with bcrypt cost factor 12
INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES
    ('u1000000-0000-0000-0000-000000000001', 'Store Admin', 'admin@store.com',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oMFJlHxKu', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Insert Manager User (password: Manager@123456)
INSERT INTO users (id, name, email, password_hash, role, department_id, is_active) VALUES
    ('u1000000-0000-0000-0000-000000000002', 'Store Manager', 'manager@store.com',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oMFJlHxKu', 'manager',
     'd1000000-0000-0000-0000-000000000001', true)
ON CONFLICT (email) DO NOTHING;

-- Insert Cashier User (password: Cashier@123456)
INSERT INTO users (id, name, email, password_hash, role, department_id, is_active) VALUES
    ('u1000000-0000-0000-0000-000000000003', 'John Cashier', 'cashier@store.com',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oMFJlHxKu', 'cashier',
     'd1000000-0000-0000-0000-000000000001', true)
ON CONFLICT (email) DO NOTHING;

-- Update department managers
UPDATE departments SET manager_id = 'u1000000-0000-0000-0000-000000000002'
WHERE id = 'd1000000-0000-0000-0000-000000000001';

-- Insert Suppliers
INSERT INTO suppliers (id, name, contact_person, contact_email, contact_phone, is_active) VALUES
    ('s1000000-0000-0000-0000-000000000001', 'Fresh Foods Distributor', 'Raj Kumar', 'raj@freshfoods.com', '+91-9876543210', true),
    ('s1000000-0000-0000-0000-000000000002', 'Tech World Supplies', 'Priya Singh', 'priya@techworld.com', '+91-9876543211', true),
    ('s1000000-0000-0000-0000-000000000003', 'Fashion Hub', 'Meena Joshi', 'meena@fashionhub.com', '+91-9876543212', true)
ON CONFLICT DO NOTHING;

-- Insert Sample Products - Groceries
INSERT INTO products (name, sku, barcode, price, tax_rate, stock_quantity, minimum_stock, unit, category, department_id, supplier_id) VALUES
    ('Basmati Rice 5kg', 'GRC001', '8901234567890', 350.00, 0, 100, 20, 'packet', 'Rice & Grains', 'd1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001'),
    ('Toor Dal 1kg', 'GRC002', '8901234567891', 120.00, 0, 80, 15, 'packet', 'Pulses', 'd1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001'),
    ('Sunflower Oil 1L', 'GRC003', '8901234567892', 130.00, 5, 60, 10, 'bottle', 'Cooking Oil', 'd1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001'),
    ('Amul Milk 1L', 'GRC004', '8901234567893', 55.00, 0, 50, 20, 'litre', 'Dairy', 'd1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001'),
    ('Wheat Flour 5kg', 'GRC005', '8901234567894', 220.00, 0, 70, 15, 'packet', 'Flour', 'd1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001')
ON CONFLICT (sku) DO NOTHING;

-- Insert Sample Products - Electronics
INSERT INTO products (name, sku, barcode, price, tax_rate, stock_quantity, minimum_stock, unit, category, department_id, supplier_id) VALUES
    ('USB-C Cable 1m', 'ELC001', '8901234567900', 299.00, 18, 40, 5, 'piece', 'Cables', 'd1000000-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000002'),
    ('Bluetooth Earphones', 'ELC002', '8901234567901', 1499.00, 18, 25, 3, 'piece', 'Audio', 'd1000000-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000002'),
    ('Phone Charger 20W', 'ELC003', '8901234567902', 699.00, 18, 30, 5, 'piece', 'Chargers', 'd1000000-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000002')
ON CONFLICT (sku) DO NOTHING;

-- Insert Sample Customers
INSERT INTO customers (id, name, email, phone, loyalty_points, loyalty_tier, total_purchases, is_active) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Amit Sharma', 'amit@example.com', '+91-9999000001', 2500, 'silver', 25000.00, true),
    ('c1000000-0000-0000-0000-000000000002', 'Priya Patel', 'priya@example.com', '+91-9999000002', 850, 'bronze', 8500.00, true),
    ('c1000000-0000-0000-0000-000000000003', 'Ravi Verma', 'ravi@example.com', '+91-9999000003', 12000, 'gold', 120000.00, true)
ON CONFLICT (phone) DO NOTHING;
