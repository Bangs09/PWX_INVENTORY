import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        // Enforce HTTPS in production environments
        if (process.env.NODE_ENV === "production") {
            const proto = req.headers.get("x-forwarded-proto");
            if (proto && proto !== "https") {
                return NextResponse.json(
                    { error: "HTTPS is required for authentication traffic." },
                    { status: 400 }
                );
            }
        }

        // Nullify the current HttpOnly cookie by forcing it into expiration correctly
        const cookieStore = await cookies();
        cookieStore.delete("pwx_auth_token");
        
        return NextResponse.json({ message: "Success. User securely unauthenticated." }, { status: 200 });
    } catch (error) {
        console.error("Logout exception:", error);
        return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json(
        { error: "Method Not Allowed. Authentication requests must use POST." },
        { status: 405, headers: { Allow: "POST" } }
    );
}

export async function PUT() { return GET(); }
export async function DELETE() { return GET(); }
export async function PATCH() { return GET(); }
