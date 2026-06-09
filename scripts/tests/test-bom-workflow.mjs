import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'database', 'database.sqlite');
const db = new Database(dbPath);

console.log('Connecting to database at:', dbPath);

// Ensure schema is updated
const schemaSql = fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8');
db.exec(schemaSql);

// Replicate approval transaction logic from db.ts to test it in isolation
function testApproveBOM(bomId, adminEmail) {
    const executeTx = db.transaction(() => {
        const bom = db.prepare("SELECT * FROM boms WHERE id = ?").get(bomId);
        if (!bom) throw new Error("BOM not found");
        if (bom.status !== "Pending Approval") {
            throw new Error("BOM must be Pending Approval to be approved.");
        }

        const items = db.prepare("SELECT * FROM bom_items WHERE bom_id = ?").all(bomId);
        const targetQty = bom.target_qty;

        const deductions = [];

        for (const item of items) {
            const requiredQty = Math.round(item.qpa * targetQty);
            const sku = item.part_number.toUpperCase().trim();

            if (!sku) continue;

            const warehousesWithStock = db.prepare(`
                SELECT id, name, stock, warehouse 
                FROM inventory_components 
                WHERE sku = ? AND (warehouse LIKE 'PWX%' OR warehouse = 'PWX IoT Hub')
            `).all(sku);

            if (warehousesWithStock.length === 0) {
                throw new Error(`Insufficient Stock. Component: ${item.description || sku} is not in the inventory. Required: ${requiredQty}, Available: 0`);
            }

            const match = warehousesWithStock.find(w => w.stock >= requiredQty);

            if (!match) {
                const totalAvailable = warehousesWithStock.reduce((sum, w) => sum + w.stock, 0);
                throw new Error(`Insufficient Stock. Component: ${item.description || sku}. Required: ${requiredQty}. Available: ${totalAvailable}.`);
            }

            deductions.push({
                compId: match.id,
                componentName: match.name,
                requiredQty,
                availableQty: match.stock,
                stockBefore: match.stock,
                warehouse: match.warehouse
            });
        }

        // Deduct
        for (const ded of deductions) {
            const stockAfter = ded.stockBefore - ded.requiredQty;

            db.prepare(`
                UPDATE inventory_components 
                SET stock = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(stockAfter, ded.compId);

            db.prepare(`
                INSERT INTO inventory_transactions (transaction_type, reference_number, component_id, quantity_deducted, stock_before, stock_after, performed_by)
                VALUES ('BOM_CONSUMPTION', ?, ?, ?, ?, ?, ?)
            `).run(bomId, ded.compId, ded.requiredQty, ded.stockBefore, stockAfter, adminEmail);
        }

        db.prepare(`
            UPDATE boms 
            SET status = 'Approved',
                approved_by = ?,
                approved_at = CURRENT_TIMESTAMP,
                last_modified_by = ?,
                last_modified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(adminEmail, adminEmail, bomId);

        return true;
    });

    return executeTx();
}

async function runTests() {
    console.log('--- STARTING BOM WORKFLOW TRANSACTION TESTS ---');

    // 1. Clean up potential old test data
    db.prepare("DELETE FROM boms WHERE id LIKE 'TEST-BOM-%'").run();
    db.prepare("DELETE FROM inventory_transactions WHERE reference_number LIKE 'TEST-BOM-%'").run();
    db.prepare("DELETE FROM inventory_components WHERE sku LIKE 'TEST-COMP-%'").run();

    // 2. Setup mock components in inventory_components
    db.prepare(`
        INSERT INTO inventory_components (sku, name, stock, min_stock, unit_cost, category, warehouse)
        VALUES 
        ('TEST-COMP-001', 'Test Resistor 10k', 100, 10, 0.05, 'Resistors', 'PWX IoT Hub'),
        ('TEST-COMP-002', 'Test Capacitor 10uF', 10, 5, 0.15, 'Capacitors', 'PWX IoT Hub')
    `).run();

    console.log('Mock components created:');
    console.log(db.prepare("SELECT sku, stock, warehouse FROM inventory_components WHERE sku LIKE 'TEST-COMP-%'").all());

    // 3. Create test BOM
    db.prepare(`
        INSERT INTO boms (id, name, cpn, revision, phase, target_qty, author, last_modified_by, status)
        VALUES ('TEST-BOM-001', 'Test Assembly Baseboard', 'CPN-TEST-100', 'Rev A', 'Prototype', 10, 'test@packetworx.com', 'test@packetworx.com', 'Draft')
    `).run();

    // 4. Add items to BOM
    // TEST-COMP-001: QPA = 2 (Requires 2 * 10 = 20. Stock: 100 -> Sufficient)
    // TEST-COMP-002: QPA = 2 (Requires 2 * 10 = 20. Stock: 10 -> Insufficient)
    db.prepare(`
        INSERT INTO bom_items (id, bom_id, line_number, level, part_number, description, qpa, uom, unit_cost)
        VALUES 
        ('line-test-1', 'TEST-BOM-001', 1, 1, 'TEST-COMP-001', 'Resistor 10k', 2, 'Each', 0.05),
        ('line-test-2', 'TEST-BOM-001', 2, 1, 'TEST-COMP-002', 'Capacitor 10uF', 2, 'Each', 0.15)
    `).run();

    console.log('BOM and Items set up. Submitting for approval...');
    
    // Submit
    db.prepare("UPDATE boms SET status = 'Pending Approval', submitted_by = 'test@packetworx.com', submitted_at = CURRENT_TIMESTAMP WHERE id = 'TEST-BOM-001'").run();

    // 5. Attempt approval (should fail due to TEST-COMP-002 stock)
    console.log('Testing approval validation (Expected: Fails due to insufficient stock)...');
    try {
        testApproveBOM('TEST-BOM-001', 'admin@packetworx.com');
        console.error('ERROR: Approval succeeded when it should have failed!');
        process.exit(1);
    } catch (error) {
        console.log('SUCCESS: Approval failed as expected. Error message:', error.message);
        if (!error.message.includes('Insufficient Stock')) {
            console.error('ERROR: Wrong error message returned:', error.message);
            process.exit(1);
        }
    }

    // 6. Verify rollback (TEST-COMP-001 stock should still be 100, not 80)
    const comp1Stock = db.prepare("SELECT stock FROM inventory_components WHERE sku = 'TEST-COMP-001'").get().stock;
    if (comp1Stock !== 100) {
        console.error(`ERROR: Rollback failed! TEST-COMP-001 stock was deducted to ${comp1Stock}`);
        process.exit(1);
    } else {
        console.log('SUCCESS: Transaction rollback verified. TEST-COMP-001 stock remains untouched.');
    }

    // 7. Adjust TEST-COMP-002 stock to be sufficient (e.g. set stock to 50)
    console.log('Adjusting TEST-COMP-002 stock to 50...');
    db.prepare("UPDATE inventory_components SET stock = 50 WHERE sku = 'TEST-COMP-002'").run();

    // 8. Re-attempt approval (should succeed now)
    console.log('Testing approval validation with sufficient stock (Expected: Success)...');
    try {
        testApproveBOM('TEST-BOM-001', 'admin@packetworx.com');
        console.log('SUCCESS: BOM approved successfully.');
    } catch (error) {
        console.error('ERROR: Approval failed unexpectedly:', error.message);
        process.exit(1);
    }

    // 9. Verify database changes
    const approvedBom = db.prepare("SELECT status, approved_by FROM boms WHERE id = 'TEST-BOM-001'").get();
    if (approvedBom.status !== 'Approved') {
        console.error(`ERROR: BOM status is ${approvedBom.status}, expected Approved.`);
        process.exit(1);
    }
    console.log(`SUCCESS: BOM status updated to ${approvedBom.status} under approval by ${approvedBom.approved_by}`);

    // 10. Verify stock deduction
    const comp1StockFinal = db.prepare("SELECT stock FROM inventory_components WHERE sku = 'TEST-COMP-001'").get().stock;
    const comp2StockFinal = db.prepare("SELECT stock FROM inventory_components WHERE sku = 'TEST-COMP-002'").get().stock;
    
    if (comp1StockFinal !== 80 || comp2StockFinal !== 30) {
        console.error(`ERROR: Stock deduction incorrect. TEST-COMP-001: ${comp1StockFinal} (Expected 80), TEST-COMP-002: ${comp2StockFinal} (Expected 30)`);
        process.exit(1);
    }
    console.log(`SUCCESS: Stock correctly deducted. TEST-COMP-001: ${comp1StockFinal}, TEST-COMP-002: ${comp2StockFinal}`);

    // 11. Verify inventory transactions
    const txs = db.prepare("SELECT * FROM inventory_transactions WHERE reference_number = 'TEST-BOM-001' ORDER BY id ASC").all();
    if (txs.length !== 2) {
        console.error(`ERROR: Expected 2 transactions logged, found ${txs.length}`);
        process.exit(1);
    }
    console.log(`SUCCESS: 2 transactions logged correctly:`);
    txs.forEach(t => {
        console.log(` - Comp ID: ${t.component_id}, Deducted: ${t.quantity_deducted}, Stock Before: ${t.stock_before}, Stock After: ${t.stock_after}`);
    });

    // 12. Clean up test data
    console.log('Cleaning up test data...');
    db.prepare("DELETE FROM boms WHERE id = 'TEST-BOM-001'").run();
    db.prepare("DELETE FROM bom_items WHERE bom_id = 'TEST-BOM-001'").run();
    db.prepare("DELETE FROM inventory_transactions WHERE reference_number = 'TEST-BOM-001'").run();
    db.prepare("DELETE FROM inventory_components WHERE sku LIKE 'TEST-COMP-%'").run();

    console.log('--- ALL WORKFLOW TRANSACTION TESTS PASSED SUCCESSFULLY! ---');
    db.close();
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
