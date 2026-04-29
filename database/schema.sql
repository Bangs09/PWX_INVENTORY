-- Database Schema for Network Department Inventory System (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT DEFAULT 'Active',
    must_change_password INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Default Production Seeds (Mandatory change on first login)
INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES 
('System Admin', 'admin@packetworx.com', '$2b$10$k6/OUnRWiu/L89XY6KX5ZOHrpk1Skjcy2EKIHHh3zb/pFsu5h86.y', 'admin', 1),
('Default User', 'user@packetworx.com', '$2b$10$k6/OUnRWiu/L89XY6KX5ZOHrpk1Skjcy2EKIHHh3zb/pFsu5h86.y', 'user', 1)
ON CONFLICT (email) DO NOTHING;

-- Inventory Components
CREATE TABLE IF NOT EXISTS inventory_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 10,
    unit_cost REAL NOT NULL DEFAULT 0,
    category TEXT,
    warehouse TEXT NOT NULL,
    tag TEXT DEFAULT 'Local',
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sku, warehouse)
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    zone TEXT NOT NULL,
    total_components INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO warehouses (name, zone, total_components, status) VALUES 
('PWX IoT Hub', 'PWX Office', 0, 'Active'),
('Jenny''s', 'Pasig', 0, 'Active')
ON CONFLICT (name) DO NOTHING;

-- Gateways
CREATE TABLE IF NOT EXISTS gateways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock Requests
CREATE TABLE IF NOT EXISTS stock_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'component' or 'gateway'
    item_sku TEXT NOT NULL,
    item_name TEXT NOT NULL,
    requested_qty INTEGER NOT NULL,
    requested_by TEXT NOT NULL, -- email
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    is_processed INTEGER DEFAULT 0, -- 0 for false, 1 for true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id), -- Specific target if needed, else null for broadcast
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'stock_request', 'new_user', etc.
    related_id INTEGER, -- link to stock_request_id or user_id
    is_read INTEGER DEFAULT 0, -- 0 for false, 1 for true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_components(sku);

-- Critical Stock Logs
CREATE TABLE IF NOT EXISTS critical_stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_sku TEXT NOT NULL,
    warehouse TEXT NOT NULL,
    old_value INTEGER NOT NULL,
    new_value INTEGER NOT NULL,
    changed_by TEXT NOT NULL, -- email
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_critical_stock_logs_sku ON critical_stock_logs(item_sku);
