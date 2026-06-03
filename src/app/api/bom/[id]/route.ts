import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { 
    getBOMById, 
    deleteBOM, 
    submitBOMForApproval, 
    approveBOM, 
    rejectBOM, 
    archiveBOM,
    getBOMTransactions,
    logActivity
} from "@/lib/db";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const bom = await getBOMById(id);
        if (!bom) {
            return NextResponse.json({ error: "BOM not found" }, { status: 404 });
        }

        // Add transaction history log to the details response if they are an admin
        const isAdmin = session.role === "admin" || session.role === "co-admin";
        if (isAdmin && bom.status === "Approved") {
            const transactions = await getBOMTransactions(id);
            (bom as any).transactions = transactions;
        }

        return NextResponse.json(bom);
    } catch (error) {
        console.error("Failed to fetch BOM details:", error);
        return NextResponse.json({ error: "Failed to fetch BOM details" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { action, remarks } = await request.json();

        const isAdmin = session.role === "admin" || session.role === "co-admin";

        let result;
        let logAction = "";
        let logDetail = "";

        if (action === "submit") {
            result = await submitBOMForApproval(id, session.email);
            logAction = "BOM Submitted";
            logDetail = `BOM ${result.name} (${result.id}) submitted for approval`;
        } else if (action === "approve") {
            if (!isAdmin) {
                return NextResponse.json({ error: "Only administrators can approve BOMs." }, { status: 403 });
            }
            result = await approveBOM(id, session.email);
            logAction = "BOM Approved";
            logDetail = `BOM ${result.name} (${result.id}) approved. Inventory deducted.`;
        } else if (action === "reject") {
            if (!isAdmin) {
                return NextResponse.json({ error: "Only administrators can reject BOMs." }, { status: 403 });
            }
            if (!remarks || remarks.trim() === "") {
                return NextResponse.json({ error: "Rejection remarks are required." }, { status: 400 });
            }
            result = await rejectBOM(id, remarks, session.email);
            logAction = "BOM Rejected";
            logDetail = `BOM ${result.name} (${result.id}) rejected: ${remarks}`;
        } else if (action === "archive") {
            result = await archiveBOM(id, session.email);
            logAction = "BOM Archived";
            logDetail = `BOM ${result.name} (${result.id}) status set to ${result.status}`;
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (logAction) {
            await logActivity(logAction, logDetail, session.email);
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Failed to process BOM status PATCH:", error.message);
        return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await deleteBOM(id);
        await logActivity("BOM Deleted", `BOM ID: ${id} deleted`, session.email);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete BOM:", error.message);
        return NextResponse.json({ error: error.message || "Failed to delete BOM" }, { status: 400 });
    }
}
