import { NextResponse } from "next/server";
import { getAllUsers, createUser } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth-server";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const users = await getAllUsers();
        return NextResponse.json(users);
    } catch (error) {
        console.error("GET /api/users error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "admin" && session.role !== "co-admin") {
            return NextResponse.json({ error: "Forbidden: Only admins can create users" }, { status: 403 });
        }

        const body = await request.json();
        const { name, email, password, role } = body;

        if (!name || !email || !password || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await createUser(name, email, passwordHash, role, "Active");
        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/users error:", error);
        if (error.message === "User with this email already exists") {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}
