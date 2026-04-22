import Database from 'better-sqlite3';
import path from 'path';

// Initialize the SQLite Connection.
const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// --- Types ---

export type User = {
    id: number;
    name: string | null;
    email: string;
    password_hash: string;
    role: 'admin' | 'co-admin' | 'user';
    status: 'Active' | 'Inactive';
    must_change_password?: boolean | number;
    created_at?: string;
    updated_at?: string;
};

export type StockRequest = {
    id: number;
    type: 'component' | 'gateway';
    item_sku: string;
    item_name: string;
    requested_qty: number;
    requested_by: string; // email
    status: 'pending' | 'accepted' | 'declined';
    is_processed: boolean;
    created_at: string;
};

export type Notification = {
    id: number;
    user_id: number | null;
    message: string;
    type: string;
    related_id: number | null;
    is_read: boolean;
    created_at: string;
};

export type ComponentItem = {
    id: number;
    sku: string;
    name: string;
    stock: number;
    min_stock: number;
    category: string;
    warehouse: string;
    tag?: string;
    image?: string;
    created_at: string;
    updated_at: string;
};

export type GatewayItem = {
    id: number;
    sku: string;
    name: string;
    location: string;
    quantity: number;
    image?: string;
    created_at: string;
    updated_at: string;
};

export type ActivityLog = {
    id: number;
    action: string;
    detail: string;
    user_name: string;
    item_sku: string | null;
    created_at: string;
};

export type Warehouse = {
    id: number;
    name: string;
    zone: string;
    total_components: number;
    status: string;
    created_at: string;
    updated_at: string;
};

// --- Users ---

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const queryText = `
            SELECT id, name, email, password_hash, role, status, must_change_password
            FROM users
            WHERE email = ?;
        `;
        const row = db.prepare(queryText).get(email.toLowerCase()) as User | undefined;
        return row || null;
    } catch (error) {
        console.error("[CRITICAL DB EXCEPTION] Failed user lookup:", error);
        throw new Error("Internal Database Error");
    }
}

export async function getAllUsers(): Promise<Omit<User, 'password_hash'>[]> {
    try {
        const queryText = `
            SELECT id, name, email, role, status, must_change_password, created_at, updated_at
            FROM users
            ORDER BY id ASC;
        `;
        return db.prepare(queryText).all() as Omit<User, 'password_hash'>[];
    } catch (error) {
        console.error("Failed fetching all users:", error);
        throw new Error("Internal Database Error");
    }
}

export async function updateUserRole(email: string, role: 'admin' | 'co-admin' | 'user'): Promise<void> {
    try {
        const queryText = `
            UPDATE users
            SET role = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?;
        `;
        db.prepare(queryText).run(role, email.toLowerCase());
    } catch (error) {
        console.error("Failed updating user role:", error);
        throw new Error("Internal Database Error");
    }
}

export async function updateUserProfile(email: string, updates: { name?: string, role?: string }): Promise<void> {
    const executeTx = db.transaction(() => {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) {
            fields.push(`name = ?`);
            values.push(updates.name);

            // Retroactively update activity logs to ensure name is consistent everywhere
            try {
                db.prepare(`UPDATE activity_logs SET user_name = ? WHERE user_email = ?`)
                  .run(updates.name, email.toLowerCase());
            } catch (err: any) {
                // Table might not exist yet, suppress error
                if (!err.message.includes('no such table')) throw err;
            }
        }
        if (updates.role !== undefined) {
            fields.push(`role = ?`);
            values.push(updates.role);
        }

        if (fields.length > 0) {
            values.push(email.toLowerCase());
            const queryText = `
                UPDATE users
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE email = ?;
            `;
            db.prepare(queryText).run(...values);
        }
    });

    try {
        executeTx();
    } catch (error) {
        console.error("Failed updating user profile:", error);
        throw new Error("Internal Database Error");
    }
}

export async function updatePassword(email: string, passwordHash: string): Promise<void> {
    try {
        const queryText = `
            UPDATE users
            SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?;
        `;
        db.prepare(queryText).run(passwordHash, email.toLowerCase());
    } catch (error) {
        console.error("Failed updating password:", error);
        throw new Error("Internal Database Error");
    }
}

export async function deleteUserByEmail(email: string): Promise<void> {
    try {
        const queryText = `
            DELETE FROM users
            WHERE email = ?;
        `;
        db.prepare(queryText).run(email.toLowerCase());
    } catch (error) {
        console.error("Failed deleting user:", error);
        throw new Error("Internal Database Error");
    }
}

export async function createUser(
    name: string,
    email: string,
    passwordHash: string,
    role: string,
    status: string = 'Active'
): Promise<User> {
    try {
        const queryText = `
            INSERT INTO users (name, email, password_hash, role, status, must_change_password)
            VALUES (?, ?, ?, ?, ?, 1)
            RETURNING id, name, email, role, status, must_change_password, created_at, updated_at;
        `;
        const result = db.prepare(queryText).get(name, email.toLowerCase(), passwordHash, role, status) as User;
        return result;
    } catch (error: any) {
        console.error("Failed creating user:", error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
            throw new Error("User with this email already exists");
        }
        throw new Error("Internal Database Error");
    }
}

// --- Inventory (Components) ---

export async function getInventoryComponents(): Promise<ComponentItem[]> {
    try {
        return db.prepare("SELECT *, image AS image_url FROM inventory_components ORDER BY name ASC").all() as ComponentItem[];
    } catch (error) {
        console.error("Failed fetching components:", error);
        throw new Error("Internal Database Error");
    }
}

export async function upsertComponent(item: Partial<ComponentItem>): Promise<ComponentItem> {
    try {
        const queryText = `
            INSERT INTO inventory_components (sku, name, stock, min_stock, category, warehouse, tag, image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (sku, warehouse) 
            DO UPDATE SET 
                name = excluded.name,
                stock = excluded.stock,
                min_stock = excluded.min_stock,
                category = excluded.category,
                tag = excluded.tag,
                image = COALESCE(excluded.image, inventory_components.image),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = db.prepare(queryText).get(
            item.sku?.toUpperCase().trim(),
            item.name,
            item.stock,
            item.min_stock || (item as any).min || 0,
            item.category,
            item.warehouse || "PWX IoT Hub",
            item.tag || "Local",
            item.image
        ) as ComponentItem;
        return result;
    } catch (error) {
        console.error("Failed upserting component:", error);
        throw new Error("Internal Database Error");
    }
}

export async function logCriticalStockChange(sku: string, warehouse: string, oldVal: number, newVal: number, changedBy: string): Promise<void> {
    try {
        // Ensure table exists
        db.exec(`
            CREATE TABLE IF NOT EXISTS critical_stock_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_sku TEXT NOT NULL,
                warehouse TEXT NOT NULL,
                old_value INTEGER NOT NULL,
                new_value INTEGER NOT NULL,
                changed_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_critical_stock_sku ON critical_stock_logs(item_sku);
        `);

        const query = `
            INSERT INTO critical_stock_logs (item_sku, warehouse, old_value, new_value, changed_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.prepare(query).run(sku.toUpperCase().trim(), warehouse, oldVal, newVal, changedBy);
    } catch (error) {
        console.error("Failed to log critical stock change:", error);
    }
}

export async function updateComponent(sku: string, warehouse: string, updates: Partial<ComponentItem>, changedBy?: string): Promise<ComponentItem> {
    try {
        const minStockToUpdate = updates.min_stock !== undefined ? updates.min_stock : (updates as any).min;
        let oldMinStock: number | undefined;
        
        if (minStockToUpdate !== undefined && changedBy) {
            const currentObj = db.prepare("SELECT min_stock FROM inventory_components WHERE sku = ? AND warehouse = ?")
                                 .get(sku.toUpperCase().trim(), warehouse || "PWX IoT Hub") as any;
            if (currentObj) {
                oldMinStock = currentObj.min_stock;
            }
        }

        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) { fields.push(`name = ?`); values.push(updates.name); }
        if (updates.stock !== undefined) { fields.push(`stock = ?`); values.push(updates.stock); }
        if (minStockToUpdate !== undefined) { fields.push(`min_stock = ?`); values.push(minStockToUpdate); }
        if (updates.category !== undefined) { fields.push(`category = ?`); values.push(updates.category); }
        if (updates.tag !== undefined) { fields.push(`tag = ?`); values.push(updates.tag); }
        if (updates.image !== undefined) { fields.push(`image = ?`); values.push(updates.image); }

        if (fields.length === 0) throw new Error("No fields provided for update");

        values.push(sku.toUpperCase().trim());
        values.push(warehouse || "PWX IoT Hub");

        const queryText = `
            UPDATE inventory_components 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE sku = ? AND warehouse = ?
            RETURNING *;
        `;
        const row = db.prepare(queryText).get(...values) as ComponentItem | undefined;
        if (!row) throw new Error("Component not found");

        if (minStockToUpdate !== undefined && changedBy && oldMinStock !== undefined && oldMinStock !== minStockToUpdate) {
            await logCriticalStockChange(sku, warehouse, oldMinStock, minStockToUpdate, changedBy);
        }

        return row;
    } catch (error) {
        console.error("Failed updating component:", error);
        throw error;
    }
}

export async function adjustComponentStock(sku: string, warehouse: string, delta: number): Promise<ComponentItem> {
    try {
        const queryText = `
            UPDATE inventory_components 
            SET stock = MAX(0, stock + ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE sku = ? AND warehouse = ?
            RETURNING *;
        `;
        const row = db.prepare(queryText).get(delta, sku.toUpperCase().trim(), warehouse || "PWX IoT Hub") as ComponentItem | undefined;
        if (!row) throw new Error("Component not found in specified warehouse");
        return row;
    } catch (error) {
        console.error("Failed adjusting component stock:", error);
        throw error;
    }
}

export async function deleteComponent(sku: string, warehouse: string): Promise<void> {
    try {
        db.prepare("DELETE FROM inventory_components WHERE sku = ? AND warehouse = ?").run(sku, warehouse);
    } catch (error) {
        console.error("Failed deleting component:", error);
        throw new Error("Internal Database Error");
    }
}

// --- Gateways ---

export async function getGateways(): Promise<GatewayItem[]> {
    try {
        return db.prepare("SELECT * FROM gateways ORDER BY name ASC").all() as GatewayItem[];
    } catch (error) {
        console.error("Failed fetching gateways:", error);
        throw new Error("Internal Database Error");
    }
}

export async function upsertGateway(gw: Partial<GatewayItem>): Promise<GatewayItem> {
    try {
        const queryText = `
            INSERT INTO gateways (sku, name, location, quantity, image)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (sku) 
            DO UPDATE SET 
                name = excluded.name,
                location = excluded.location,
                quantity = excluded.quantity,
                image = COALESCE(excluded.image, gateways.image),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const row = db.prepare(queryText).get(
            gw.sku?.toUpperCase().trim(),
            gw.name,
            gw.location || "PWX IoT Hub",
            gw.quantity,
            gw.image
        ) as GatewayItem;
        return row;
    } catch (error) {
        console.error("Failed upserting gateway:", error);
        throw new Error("Internal Database Error");
    }
}

export async function deleteGateway(sku: string): Promise<void> {
    try {
        db.prepare("DELETE FROM gateways WHERE sku = ?").run(sku);
    } catch (error) {
        console.error("Failed deleting gateway:", error);
        throw new Error("Internal Database Error");
    }
}

export async function adjustGatewayQuantity(sku: string, delta: number): Promise<GatewayItem> {
    try {
        const queryText = `
            UPDATE gateways 
            SET quantity = MAX(0, quantity + ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE sku = ?
            RETURNING *;
        `;
        const row = db.prepare(queryText).get(delta, sku.toUpperCase().trim()) as GatewayItem | undefined;
        if (!row) throw new Error("Gateway not found");
        return row;
    } catch (error) {
        console.error("Failed adjusting gateway quantity:", error);
        throw error;
    }
}

// --- Stock Requests ---

export async function createStockRequest(
    type: string,
    itemSku: string,
    itemName: string,
    requestedQty: number,
    requestedBy: string
): Promise<StockRequest> {
    const executeTx = db.transaction(() => {
        const queryText = `
            INSERT INTO stock_requests (type, item_sku, item_name, requested_qty, requested_by)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *;
        `;
        const newRequest = db.prepare(queryText).get(
            type,
            itemSku.toUpperCase().trim(),
            itemName,
            requestedQty,
            requestedBy.toLowerCase().trim()
        ) as any;

        const notificationMsg = `${requestedBy} requested ${requestedQty} units of ${itemName} (${itemSku})`;
        db.prepare(`
            INSERT INTO notifications (message, type, related_id)
            VALUES (?, ?, ?)
        `).run(notificationMsg, 'stock_request', newRequest.id);

        // Map sqlite outputs nicely
        return {
            ...newRequest,
            is_processed: Boolean(newRequest.is_processed)
        };
    });

    try {
        return executeTx();
    } catch (error) {
        console.error("Failed creating stock request:", error);
        throw new Error("Internal Database Error");
    }
}

export async function getStockRequests(): Promise<StockRequest[]> {
    try {
        const rows = db.prepare("SELECT * FROM stock_requests ORDER BY created_at DESC").all() as any[];
        return rows.map(r => ({ ...r, is_processed: Boolean(r.is_processed) }));
    } catch (error) {
        console.error("Failed fetching stock requests:", error);
        throw new Error("Internal Database Error");
    }
}

export async function updateStockRequestStatus(id: number, status: string, processedBy?: string): Promise<void> {
    const executeTx = db.transaction(() => {
        const reqRow = db.prepare("SELECT * FROM stock_requests WHERE id = ?").get(id) as any;
        if (!reqRow) throw new Error("Request not found");
        
        const request = { ...reqRow, is_processed: Boolean(reqRow.is_processed) };

        if (request.is_processed && status === 'accepted') {
            throw new Error("Request already processed and accepted.");
        }

        if (status === 'accepted' && !request.is_processed) {
            const absQty = Math.abs(request.requested_qty);

            if (request.type === 'component') {
                const compObj = db.prepare("SELECT id, sku, stock, warehouse FROM inventory_components WHERE sku = ? AND stock >= ? LIMIT 1")
                                 .get(request.item_sku, absQty) as any;

                if (!compObj) {
                    const allWhRows = db.prepare("SELECT warehouse, stock FROM inventory_components WHERE sku = ?")
                                        .all(request.item_sku) as any[];
                    const whStocks = allWhRows.map((r: any) => `${r.warehouse}: ${r.stock}`).join(', ') || 'N/A';
                    throw new Error(`Insufficient stock for ${request.item_sku}. Needed: ${absQty}. Available in warehouses: ${whStocks}`);
                }

                db.prepare("UPDATE inventory_components SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                  .run(absQty, compObj.id);
            } else {
                const gwObj = db.prepare("SELECT quantity FROM gateways WHERE sku = ? AND quantity >= ?")
                                .get(request.item_sku, absQty) as any;

                if (!gwObj) {
                    const currGw = db.prepare("SELECT quantity FROM gateways WHERE sku = ?").get(request.item_sku) as any;
                    const currentQty = currGw ? currGw.quantity : 0;
                    throw new Error(`Insufficient gateway stock for ${request.item_sku}. Needed: ${absQty}, Available: ${currentQty}`);
                }

                db.prepare("UPDATE gateways SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?")
                  .run(absQty, request.item_sku);
            }
        }

        db.prepare("UPDATE stock_requests SET status = ?, is_processed = 1 WHERE id = ?").run(status, id);

        if (processedBy) {
            // Because logActivity is async and relies on sseManager, we'll delay it or let it execute separately.
            // But we can synchronously write the activity log row here.
            const actionStr = status === 'accepted' ? 'Stock Disbursed' : 'Request Declined';
            const detailStr = status === 'accepted' 
                ? `${request.requested_qty}x ${request.item_name} disbursed for request`
                : `${request.requested_qty}x ${request.item_name} request declined`;
            
            let userName = processedBy;
            if (processedBy.includes('@')) {
                const userRow = db.prepare("SELECT name FROM users WHERE email = ?").get(processedBy) as any;
                if (userRow && userRow.name) userName = userRow.name;
                else userName = processedBy.split('@')[0];
            }
            db.prepare(`
                INSERT INTO activity_logs (action, detail, user_name, user_email, item_sku)
                VALUES (?, ?, ?, ?, ?)
            `).run(actionStr, detailStr, userName, processedBy, request.item_sku);
        }

        const userObj = db.prepare("SELECT id FROM users WHERE email = ?").get(request.requested_by) as any;
        if (userObj) {
            const msg = `Your request for ${request.requested_qty}x ${request.item_name} has been ${status}.`;
            db.prepare(`
                INSERT INTO notifications (user_id, message, type, related_id) VALUES (?, ?, ?, ?)
            `).run(userObj.id, msg, 'request_update', id);
        }
    });

    try {
        executeTx();
    } catch (error: any) {
        console.error("Failed updating stock request status:", error.message);
        throw error;
    }
}

// --- Notifications ---

export async function createNotification(message: string, type: string, relatedId: number | null = null, userId: number | null = null): Promise<void> {
    try {
        db.prepare(`
            INSERT INTO notifications (message, type, related_id, user_id)
            VALUES (?, ?, ?, ?)
        `).run(message, type, relatedId, userId);
    } catch (error) {
        console.error("Failed creating notification:", error);
    }
}

export async function getUnreadNotifications(userId: number | null = null): Promise<Notification[]> {
    try {
        let query = "SELECT * FROM notifications WHERE is_read = 0 ";
        const params: any[] = [];

        if (userId !== null) {
            query += "AND (user_id = ? OR user_id IS NULL) ";
            params.push(userId);
        } else {
            query += "AND user_id IS NULL ";
        }

        query += "ORDER BY created_at DESC";

        const rows = db.prepare(query).all(...params) as any[];
        return rows.map((r: any) => ({ ...r, is_read: Boolean(r.is_read) }));
    } catch (error) {
        console.error("Failed fetching notifications:", error);
        throw new Error("Internal Database Error");
    }
}

export async function markNotificationAsRead(id: number): Promise<void> {
    try {
        db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    } catch (error) {
        console.error("Failed marking notification as read:", error);
        throw new Error("Internal Database Error");
    }
}

export async function markAllNotificationsAsRead(userId?: number): Promise<void> {
    try {
        if (userId !== undefined) {
            db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL").run(userId);
        } else {
            db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id IS NULL").run();
        }
    } catch (error) {
        console.error("Failed marking all notifications as read:", error);
        throw new Error("Internal Database Error");
    }
}

// --- Activity Logs ---

export async function logActivity(action: string, detail: string, emailOrName: string, itemSku: string | null = null): Promise<void> {
    try {
        let userName = emailOrName;
        if (emailOrName.includes('@')) {
            const userRow = db.prepare("SELECT name FROM users WHERE email = ?").get(emailOrName) as any;
            if (userRow && userRow.name) {
                userName = userRow.name;
            } else {
                userName = emailOrName.split('@')[0];
            }
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                detail TEXT NOT NULL,
                user_name TEXT,
                user_email TEXT,
                icon_type TEXT,
                color_class TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                item_sku TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_item_sku ON activity_logs(item_sku);
        `);

        const row = db.prepare(`
            INSERT INTO activity_logs (action, detail, user_name, user_email, item_sku)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
        `).get(action, detail, userName, emailOrName, itemSku) as any;
        
        const { sseManager } = require('./sse-clients');
        sseManager.broadcast("activity_update", row);
    } catch (error) {
        console.error("Failed creating activity log:", error);
    }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
    try {
        return db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200").all() as ActivityLog[];
    } catch (error: any) {
        if (error.message.includes('no such table')) {
            return [];
        }
        console.error("Failed fetching activity logs:", error);
        throw new Error("Internal Database Error");
    }
}

export async function getItemActivityLogs(itemSku: string): Promise<ActivityLog[]> {
    try {
        return db.prepare("SELECT * FROM activity_logs WHERE item_sku = ? ORDER BY created_at DESC").all(itemSku) as ActivityLog[];
    } catch (error: any) {
        if (error.message.includes('no such table')) {
            return [];
        }
        console.error("Failed fetching item activity logs:", error);
        throw new Error("Internal Database Error");
    }
}

// --- Dashboard Stats ---

export type DashboardSummary = {
    gateways: { 
        total: number; 
        categories: { name: string; count: number; items: { name: string; location: string }[] }[] 
    };
    components: { 
        total: number; 
        categories: { name: string; count: number; items: { name: string; sku: string; stock: number }[] }[] 
    };
    alerts: { 
        total: number; 
        categories: { name: string; count: number; items: ComponentItem[] }[] 
    };
};

// --- Warehouses ---

export async function getWarehouses(): Promise<Warehouse[]> {
    try {
        return db.prepare("SELECT * FROM warehouses ORDER BY name ASC").all() as Warehouse[];
    } catch (error) {
        console.error("Failed fetching warehouses:", error);
        throw new Error("Internal Database Error");
    }
}

export async function createWarehouse(data: { name: string; zone: string; total_components: number; status: string }): Promise<void> {
    try {
        db.prepare(`
            INSERT INTO warehouses (name, zone, total_components, status) 
            VALUES (?, ?, ?, ?)
        `).run(data.name, data.zone, data.total_components, data.status);
    } catch (error) {
        console.error("Failed creating warehouse:", error);
        throw new Error("Internal Database Error");
    }
}

export async function updateWarehouse(id: number, data: { name: string; zone: string; total_components: number; status: string }): Promise<void> {
    try {
        db.prepare(`
            UPDATE warehouses 
            SET name = ?, zone = ?, total_components = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(data.name, data.zone, data.total_components, data.status, id);
    } catch (error) {
        console.error("Failed updating warehouse:", error);
        throw new Error("Internal Database Error");
    }
}

export async function deleteWarehouse(id: number): Promise<void> {
    try {
        db.prepare("DELETE FROM warehouses WHERE id = ?").run(id);
    } catch (error) {
        console.error("Failed deleting warehouse:", error);
        throw new Error("Internal Database Error");
    }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
    try {
        const allGateways = db.prepare("SELECT name, location, type FROM gateways ORDER BY name ASC").all() as any[];
        const allComponents = db.prepare("SELECT * FROM inventory_components ORDER BY name ASC").all() as ComponentItem[];
        const warehouseTotal = db.prepare("SELECT SUM(total_components) as total FROM warehouses").get() as { total: number | null };
        const componentsTotalSum = warehouseTotal.total || 0;
        
        const criticalAlerts = allComponents.filter(c => c.stock <= c.min_stock);

        const gwGroup: Record<string, { name: string; count: number; items: any[] }> = {};
        const gwTypes = ['Femto Outdoor', 'Gateway 868 Indoor & Outdoor', 'Gateway 915 Indoor & Outdoor'];
        gwTypes.forEach(t => gwGroup[t] = { name: t, count: 0, items: [] });
        
        allGateways.forEach(g => {
            const type = g.type || 'Gateway 915 Indoor & Outdoor';
            if (!gwGroup[type]) gwGroup[type] = { name: type, count: 0, items: [] };
            gwGroup[type].count++;
            gwGroup[type].items.push({ name: g.name, location: g.location });
        });

        const compGroup: Record<string, { name: string; count: number; items: any[] }> = {};
        allComponents.forEach(c => {
            const cat = c.category || 'Uncategorized';
            if (!compGroup[cat]) compGroup[cat] = { name: cat, count: 0, items: [] };
            compGroup[cat].count++;
            compGroup[cat].items.push({ name: c.name, sku: c.sku, stock: c.stock });
        });

        const alertGroup: Record<string, { name: string; count: number; items: any[] }> = {};
        criticalAlerts.forEach(c => {
            const cat = c.category || 'Uncategorized';
            if (!alertGroup[cat]) alertGroup[cat] = { name: cat, count: 0, items: [] };
            alertGroup[cat].count++;
            alertGroup[cat].items.push(c);
        });

        return {
            gateways: {
                total: allGateways.length,
                categories: Object.values(gwGroup).filter(g => g.count > 0)
            },
            components: {
                total: componentsTotalSum,
                categories: Object.values(compGroup).sort((a,b) => b.count - a.count)
            },
            alerts: {
                total: criticalAlerts.length,
                categories: Object.values(alertGroup).sort((a,b) => b.count - a.count)
            }
        };
    } catch (error) {
        console.error("Failed fetching dashboard summary:", error);
        throw new Error("Internal Database Error");
    }
}
