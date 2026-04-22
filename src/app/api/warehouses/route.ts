import { NextResponse } from "next/server";
import { getWarehouses, createWarehouse, logActivity } from "@/lib/db";
import * as z from "zod";

const warehouseSchema = z.object({
    name: z.string().min(1, "Name is required"),
    zone: z.string().min(1, "Zone is required"),
    total_components: z.number().min(0, "Total components cannot be negative"),
    status: z.string()
});

export async function GET() {
    try {
        const warehouses = await getWarehouses();
        return NextResponse.json(warehouses);
    } catch (error) {
        console.error("GET Warehouses Error:", error);
        return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = warehouseSchema.parse(body);

        await createWarehouse(data);
        await logActivity("created", "Warehouse Location", "System User", data.name);

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("POST Warehouse Error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
    }
}
