import { NextResponse } from "next/server";
import { getWarehouses, createWarehouse, logActivity } from "@/lib/db";
import * as z from "zod";
import { getSession } from "@/lib/auth-server";

const warehouseSchema = z.object({
    name: z.string().min(1, "Name is required"),
    zone: z.string().min(1, "Zone is required"),
    total_components: z.number().min(0, "Total components cannot be negative"),
    status: z.string()
});

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const warehouses = await getWarehouses();
        return NextResponse.json(warehouses);
    } catch (error) {
        console.error("GET Warehouses Error:", error);
        return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "admin" && session.role !== "co-admin") {
            return NextResponse.json({ error: "Forbidden: Only admins can manage warehouses" }, { status: 403 });
        }

        const body = await req.json();
        const data = warehouseSchema.parse(body);

        await createWarehouse(data);
        await logActivity("created", "Warehouse Location", "System User", data.name);

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error("POST Warehouse Error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.issues }, { status: 400 });
        }
        if (error.message === "Warehouse with this name already exists") {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
    }
}
