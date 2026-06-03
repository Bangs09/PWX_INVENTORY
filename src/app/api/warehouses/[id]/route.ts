import { NextResponse } from "next/server";
import { updateWarehouse, deleteWarehouse, logActivity } from "@/lib/db";
import * as z from "zod";
import { getSession } from "@/lib/auth-server";

const warehouseSchema = z.object({
    name: z.string().min(1, "Name is required"),
    zone: z.string().min(1, "Zone is required"),
    total_components: z.number().min(0, "Total components cannot be negative"),
    status: z.string()
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "admin" && session.role !== "co-admin") {
            return NextResponse.json({ error: "Forbidden: Only admins can modify warehouses" }, { status: 403 });
        }

        const { id } = await params;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const body = await req.json();
        const data = warehouseSchema.parse(body);

        await updateWarehouse(parsedId, data);
        await logActivity("updated", "Warehouse Location", "System User", data.name);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PUT Warehouse Error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to update warehouse" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "admin" && session.role !== "co-admin") {
            return NextResponse.json({ error: "Forbidden: Only admins can delete warehouses" }, { status: 403 });
        }

        const { id } = await params;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        await deleteWarehouse(parsedId);
        await logActivity("deleted", "Warehouse Location", "System User", `ID: ${parsedId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE Warehouse Error:", error);
        return NextResponse.json({ error: "Failed to delete warehouse" }, { status: 500 });
    }
}
