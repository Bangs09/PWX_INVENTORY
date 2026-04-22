import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import {
    createWarehouse,
    getWarehouses,
    upsertComponent,
    logActivity,
} from "@/lib/db";

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || (session.role !== "admin" && session.role !== "co-admin")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { format, rows } = body as {
            format: "warehouses" | "components";
            rows: any[];
        };

        if (!format || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const successRows: any[] = [];
        const failedRows: { row: number; reason: string }[] = [];

        if (format === "warehouses") {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const name = String(row.name || row["Location Name"] || row.Name || "").trim();
                const zone = String(row.zone || row.Zone || "Unassigned").trim();
                const total_components = Number(row.total_components ?? row["Total Components"] ?? 0);
                const status = String(row.status || row.Status || "Active").trim();

                if (!name) {
                    failedRows.push({ row: i + 2, reason: "Missing required 'Location Name'" });
                    continue;
                }

                try {
                    await createWarehouse({ name, zone, total_components, status });
                    await logActivity("Warehouse Created", `${name} (${zone})`, session.email, null);
                    successRows.push({ name });
                } catch (err: any) {
                    failedRows.push({ row: i + 2, reason: err.message || "Failed to insert warehouse" });
                }
            }
        } else if (format === "components") {
            // Fetch existing warehouses for validation
            const existingWarehouses = await getWarehouses();
            const warehouseNames = new Set(existingWarehouses.map(w => w.name.toLowerCase()));

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const name = String(row.name || row.Name || "").trim();
                const sku = String(row.sku || row.SKU || "").trim().toUpperCase();
                const category = String(row.category || row.Category || "Accessories").trim();
                const stock = Number(row.stock ?? row.Stock ?? 0);
                const min_stock = Number(row.min_stock ?? row["Critical Stock"] ?? row["Min Stock"] ?? 0);
                const warehouse = String(row.warehouse || row.Warehouse || "PWX IoT Hub").trim();
                const tag = String(row["Item Source"] || row.item_source || row.tag || "Local").trim();

                if (!name) {
                    failedRows.push({ row: i + 2, reason: "Missing required 'Name'" });
                    continue;
                }
                if (!sku) {
                    failedRows.push({ row: i + 2, reason: `${name}: Missing required 'SKU'` });
                    continue;
                }
                if (isNaN(stock) || stock < 0) {
                    failedRows.push({ row: i + 2, reason: `${name} (${sku}): Stock must be >= 0` });
                    continue;
                }

                // Auto-create warehouse if it doesn't exist
                if (!warehouseNames.has(warehouse.toLowerCase())) {
                    try {
                        await createWarehouse({ name: warehouse, zone: "Imported", total_components: 0, status: "Active" });
                        warehouseNames.add(warehouse.toLowerCase());
                        await logActivity("Warehouse Auto-Created", `${warehouse} created during component import`, session.email, null);
                    } catch {
                        // Might already exist (race condition), continue
                    }
                }

                try {
                    await upsertComponent({ name, sku, category, stock, min_stock, warehouse, tag });
                    await logActivity("Component Imported", `${name} (${sku}) x${stock} → ${warehouse}`, session.email, sku);
                    successRows.push({ name, sku });
                } catch (err: any) {
                    failedRows.push({ row: i + 2, reason: `${name} (${sku}): ${err.message}` });
                }
            }
        } else {
            return NextResponse.json({ error: "Unknown format type" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            imported: successRows.length,
            failed: failedRows.length,
            failedRows,
        });
    } catch (error: any) {
        console.error("Import-Data API Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
