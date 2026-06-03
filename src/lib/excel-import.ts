import * as XLSX from "xlsx";
import type { ComponentItem } from "@/app/(protected)/components/add_components";
import type { GatewayItem } from "@/app/(protected)/gateways/add_gateways";

export function downloadExcelTemplate() {
    // 1. Create a blank workbook
    const wb = XLSX.utils.book_new();

    // 2. Add "Components" sheet
    const componentsHeaders = ["Name", "SKU", "Category", "Stock", "Critical Stock", "Unit Cost", "Warehouse", "Item Source"];
    const wsComponents = XLSX.utils.aoa_to_sheet([
        componentsHeaders,
        ["Example Component", "EX-COMP-01", "Hardware", 100, 20, 1.5, "PWX IoT Hub", "Local"]
    ]);
    XLSX.utils.book_append_sheet(wb, wsComponents, "Components");

    // 3. Add "Gateways" sheet
    const gatewaysHeaders = ["Name", "SKU", "Location", "Quantity"];
    const wsGateways = XLSX.utils.aoa_to_sheet([
        gatewaysHeaders,
        ["Example Gateway Outdoor", "EX-GW-OA", "Jenny's", 5]
    ]);
    XLSX.utils.book_append_sheet(wb, wsGateways, "Gateways");

    // 4. Trigger download
    XLSX.writeFile(wb, "Inventory_Import_Template.xlsx");
}

export interface ImportResult {
    success: boolean;
    components: { added: ComponentItem[]; updated: ComponentItem[]; };
    gateways: { added: GatewayItem[]; updated: GatewayItem[]; };
    finalComponents: ComponentItem[];
    finalGateways: GatewayItem[];
    errors: string[];
    error?: string; // Critical/Global error
}

export async function processExcelImport(
    file: File,
    currentComponents: ComponentItem[],
    currentGateways: GatewayItem[]
): Promise<ImportResult> {
    try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });

        const addedComponents: ComponentItem[] = [];
        const updatedComponents: ComponentItem[] = [];
        const addedGateways: GatewayItem[] = [];
        const updatedGateways: GatewayItem[] = [];
        const importErrors: string[] = [];

        // Prepopulate maps with current data
        const compMap = new Map<string, ComponentItem>();
        for (const c of currentComponents) {
            const wh = c.warehouse || "PWX IoT Hub";
            compMap.set(`${c.sku.toLowerCase()}-${wh.toLowerCase()}`, { ...c });
        }

        const gwMap = new Map<string, GatewayItem>();
        for (const g of currentGateways) {
            const loc = g.location || "PWX IoT Hub";
            gwMap.set(`${g.sku.toLowerCase()}-${loc.toLowerCase()}`, { ...g });
        }

        // --- Process Components ---
        let wsComponents = wb.Sheets["Components"];
        if (!wsComponents) {
            const componentSheetName = wb.SheetNames.find(name => name.toLowerCase().includes("component") || name.toLowerCase().includes("item"));
            if (componentSheetName) {
                wsComponents = wb.Sheets[componentSheetName];
            } else if (wb.SheetNames.length > 0) {
                // Ultimate fallback: assume the first sheet is Components if it has relevant columns
                const firstSheet = wb.Sheets[wb.SheetNames[0]];
                const firstSheetHeaders = XLSX.utils.sheet_to_json<any>(firstSheet)[0] || {};
                if (firstSheetHeaders["Component"] || firstSheetHeaders["Name"] || firstSheetHeaders["SKU"] || firstSheetHeaders["Stock"]) {
                    wsComponents = firstSheet;
                } else if (wb.SheetNames.length === 1) {
                    wsComponents = firstSheet;
                }
            }
        }

        if (wsComponents) {
            const rawComponents = XLSX.utils.sheet_to_json<any>(wsComponents);

            let rowIndex = 2; // header is row 1 conceptually
            for (const row of rawComponents) {
                const name = row["Component"] || row["component"] || row["Name"] || row["name"] || row["Item Name"] || row["item_name"];
                const sku = String(row["SKU"] || row["sku"] || row["Part Number"] || row["part_number"] || "").trim();
                const category = row["Category"] || row["category"] || row["type"];
                let stock = Number(row["Stock"] || row["Current Stock"] || row["stock"] || row["quantity"] || row["Qty"]);
                let min = Number(row["Min Stock"] || row["Critical Stock"] || row["Critical Sto"] || row["min"] || row["alert"]);
                let cost = Number(row["Unit Cost"] || row["unit cost"] || row["cost"] || row["price"] || 0);
                const warehouse = String(row["Warehouse"] || row["warehouse"] || row["location"] || "PWX IoT Hub").trim();
                const tag = String(row["Item Source"] || row["item source"] || row["tag"] || "Local").trim();

                if (!name || !sku) {
                    importErrors.push(`Components Row ${rowIndex}: Missing required 'Component' (Name) or 'SKU'.`);
                    rowIndex++;
                    continue;
                }

                if (!category) {
                    importErrors.push(`Components Row ${rowIndex} (${name}): Missing required 'Category'.`);
                    rowIndex++;
                    continue;
                }

                if (row["Stock"] === undefined && row["Current Stock"] === undefined && row["stock"] === undefined) {
                    importErrors.push(`Components Row ${rowIndex} (${name}): Missing required 'Stock' quantity.`);
                    rowIndex++;
                    continue;
                }

                if (isNaN(stock) || stock < 0) stock = 0;
                if (isNaN(min) || min < 0) min = 0;
                if (isNaN(cost) || cost < 0) cost = 0;

                const lookupKey = `${sku.toLowerCase()}-${warehouse.toLowerCase()}`;

                if (compMap.has(lookupKey)) {
                    // Update: Record the quantity to ADD (delta)
                    const existing = compMap.get(lookupKey)!;
                    // We record the incoming 'stock' as the adjustment amount
                    const updateCopy = { ...existing, stock: stock };
                    updatedComponents.push(updateCopy);

                    // Update local map for internal preview consistency if needed
                    existing.stock += stock;
                    if (min > existing.min_stock) existing.min_stock = min;
                    if (cost > 0) existing.unit_cost = cost;
                    compMap.set(lookupKey, existing);
                } else {
                    // Add new
                    const newItem: ComponentItem = {
                        name: String(name),
                        sku: sku,
                        category: String(category || "Accessories"),
                        stock: stock,
                        min_stock: min,
                        unit_cost: cost,
                        warehouse: warehouse,
                        tag: tag,
                    };
                    addedComponents.push(newItem);
                    compMap.set(lookupKey, newItem);
                }
                rowIndex++;
            }
        }

        // --- Process Gateways ---
        let wsGateways = wb.Sheets["Gateways"];
        if (!wsGateways) {
            const gatewaySheetName = wb.SheetNames.find(name => name.toLowerCase().includes("gateway") || name.toLowerCase().includes("connection"));
            if (gatewaySheetName) {
                wsGateways = wb.Sheets[gatewaySheetName];
            } else if (!wsComponents && wb.SheetNames.length === 1) {
                // If it wasn't a components sheet, maybe it's a gateways sheet
                 const firstSheet = wb.Sheets[wb.SheetNames[0]];
                 const headers = XLSX.utils.sheet_to_json<any>(firstSheet)[0] || {};
                 if (headers["Location"] || headers["Quantity"]) {
                     wsGateways = firstSheet;
                 }
            } else if (wsComponents && wb.SheetNames.length > 1) {
                // If first sheet is components, assume second sheet is gateways
                wsGateways = wb.Sheets[wb.SheetNames[1]];
            }
        }

        if (wsGateways) {
            const rawGateways = XLSX.utils.sheet_to_json<any>(wsGateways);

            let rowIndex = 2;
            for (const row of rawGateways) {
                const name = row["Name"] || row["name"] || row["gateway_name"];
                const sku = String(row["SKU"] || row["sku"] || row["id"] || "").trim();
                const location = String(row["Location"] || row["location"] || row["Warehouse"] || row["warehouse"] || "PWX IoT Hub").trim();
                let quantity = Number(row["Quantity"] || row["quantity"] || row["Qty"] || row["stock"]);

                if (!name || !sku) {
                    importErrors.push(`Gateways Row ${rowIndex}: Missing required 'Name' or 'SKU'.`);
                    rowIndex++;
                    continue;
                }

                if (row["Quantity"] === undefined && row["quantity"] === undefined && row["Qty"] === undefined) {
                    importErrors.push(`Gateways Row ${rowIndex} (${name}): Missing required 'Quantity'.`);
                    rowIndex++;
                    continue;
                }

                if (isNaN(quantity) || quantity < 0) quantity = 0;

                const lookupKey = `${sku.toLowerCase()}-${location.toLowerCase()}`;

                if (gwMap.has(lookupKey)) {
                    const existing = gwMap.get(lookupKey)!;
                    const updateCopy = { ...existing, quantity: quantity }; // record the delta
                    updatedGateways.push(updateCopy);

                    existing.quantity += quantity;
                    gwMap.set(lookupKey, existing);
                } else {
                    const newItem: GatewayItem = {
                        name: String(name),
                        sku: sku,
                        location: location,
                        quantity: quantity
                    };
                    addedGateways.push(newItem);
                    gwMap.set(lookupKey, newItem);
                }
                rowIndex++;
            }
        }

        if (!wsComponents && !wsGateways) {
            return {
                success: false,
                components: { added: [], updated: [] },
                gateways: { added: [], updated: [] },
                finalComponents: [],
                finalGateways: [],
                errors: [],
                error: "Invalid Excel format. Expected 'Components' or 'Gateways' sheets."
            };
        }

        return {
            success: true,
            components: { added: addedComponents, updated: updatedComponents },
            gateways: { added: addedGateways, updated: updatedGateways },
            finalComponents: Array.from(compMap.values()),
            finalGateways: Array.from(gwMap.values()),
            errors: importErrors
        };
    } catch (e: any) {
        return {
            success: false,
            components: { added: [], updated: [] },
            gateways: { added: [], updated: [] },
            finalComponents: [],
            finalGateways: [],
            errors: [],
            error: e.message || "An error occurred while parsing the file."
        };
    }
}

export function exportComponentsToExcel(components: ComponentItem[]) {
    const wb = XLSX.utils.book_new();
    const headers = ["Component", "SKU", "Category", "Stock", "Critical Stock", "Unit Cost", "Warehouse", "Item Source"];

    const rows = components.map(c => [
        c.name,
        c.sku,
        c.category,
        c.stock,
        c.min_stock,
        c.unit_cost || 0,
        c.warehouse || "PWX IoT Hub",
        c.tag || "Local"
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Components");

    // Trigger download
    XLSX.writeFile(wb, "Pocketworx_Components_Export.xlsx");
}

export async function saveExcelImport(importPreview: ImportResult) {
    const handleRes = async (res: Response, itemContext: string) => {
        if (!res.ok) {
            let errText = await res.text();
            throw new Error(`Failed to save ${itemContext}. Status: ${res.status}, Details: ${errText}`);
        }
        return res;
    };

    const componentAdjustOps = importPreview.components.updated.map(c => 
        fetch("/api/inventory/components/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sku: c.sku, warehouse: c.warehouse, delta: c.stock })
        }).then(r => handleRes(r, `Adjust Component ${c.sku}`))
    );

    const gatewayOps = [
        ...importPreview.gateways.added.map(g => 
            fetch("/api/inventory/gateways", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(g)
            }).then(r => handleRes(r, `Add Gateway ${g.sku}`))
        ),
        ...importPreview.gateways.updated.map(g => 
            fetch("/api/inventory/gateways/adjust", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sku: g.sku, location: g.location, delta: g.quantity })
            }).then(r => handleRes(r, `Adjust Gateway ${g.sku}`))
        )
    ];

    const componentOps = importPreview.components.added.map(c => 
        fetch("/api/inventory/components", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c)
        }).then(r => handleRes(r, `Add Component ${c.sku}`))
    );

    await Promise.all([...componentAdjustOps, ...gatewayOps]);
    for (const op of componentOps) {
        await op;
    }
}
