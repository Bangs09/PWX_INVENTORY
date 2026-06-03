import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getBOMs, saveBOM, logActivity } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const boms = await getBOMs(session.role, session.email);
        return NextResponse.json(boms);
    } catch (error) {
        console.error("Failed to fetch BOMs API:", error);
        return NextResponse.json({ error: "Failed to fetch BOMs" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const isUpdate = !!body.id;
        const savedBom = await saveBOM(body, session.email);

        const actionStr = isUpdate ? "BOM Updated" : "BOM Created";
        const detailStr = `${savedBom.name} (${savedBom.id}) ${isUpdate ? "modified" : "created"}`;
        await logActivity(actionStr, detailStr, session.email);

        return NextResponse.json(savedBom, { status: 201 });
    } catch (error: any) {
        console.error("Failed to save BOM API:", error.message);
        return NextResponse.json({ error: error.message || "Failed to save BOM" }, { status: 400 });
    }
}
