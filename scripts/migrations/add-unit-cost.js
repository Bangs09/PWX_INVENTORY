const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'Database', 'database.sqlite');
const db = new Database(dbPath);

try {
    console.log("Checking for unit_cost column...");
    const info = db.prepare("PRAGMA table_info(inventory_components)").all();
    const hasUnitCost = info.some(col => col.name === 'unit_cost');
    
    if (!hasUnitCost) {
        console.log("Adding unit_cost column to inventory_components...");
        db.exec("ALTER TABLE inventory_components ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0");
        console.log("Column added successfully.");
    } else {
        console.log("unit_cost column already exists.");
    }
} catch (err) {
    console.error("Migration failed:", err.message);
} finally {
    db.close();
}
