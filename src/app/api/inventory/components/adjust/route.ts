import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { adjustComponentStock, logActivity } from "@/lib/db";

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'co-admin')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { sku, warehouse, delta } = await request.json();
        
        if (!sku || typeof delta !== 'number') {
            return NextResponse.json({ error: "Missing required fields: sku and delta" }, { status: 400 });
        }

        const updatedItem = await adjustComponentStock(sku, warehouse, delta);
        const actionName = delta >= 0 ? "Stock Increased" : "Stock Decreased";
        const actionDetail = `${updatedItem.name} stock ${delta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)} pcs`;
        await logActivity(actionName, actionDetail, session.email, updatedItem.sku);
        return NextResponse.json(updatedItem);
    } catch (error: any) {
        console.error("[API_ADJUST_STOCK_ERROR]", error.message);
        return NextResponse.json({ error: error.message || "Failed to adjust stock" }, { status: 500 });
    }
}
