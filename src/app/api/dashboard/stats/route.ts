import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/db";
import { getSession } from "@/lib/auth-server";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const stats = await getDashboardSummary();
        return NextResponse.json(stats);
    } catch (error) {
        console.error("Dashboard Stats API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
