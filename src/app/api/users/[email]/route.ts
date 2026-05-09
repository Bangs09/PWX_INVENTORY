import { NextResponse } from "next/server";
import { updateUserProfile, deleteUserByEmail, updatePassword } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import bcrypt from "bcryptjs";

export async function PATCH(request: Request, { params }: { params: Promise<{ email: string }> }) {
    try {
        const { email } = await params;
        const decodedEmail = decodeURIComponent(email);
        const body = await request.json();
        const { role, name, action, newPassword } = body;

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ── Admin-only: Reset another user's password ──
        if (action === "resetPassword") {
            if (session.role !== "admin") {
                return NextResponse.json({ error: "Only admins can reset passwords" }, { status: 403 });
            }
            if (!newPassword || newPassword.length < 8) {
                return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
            }
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(newPassword, salt);
            await updatePassword(decodedEmail, passwordHash);
            console.log(`[ADMIN] Password reset for ${decodedEmail} by ${session.email}`);
            return NextResponse.json({ message: "Password reset successfully" });
        }

        const updates: any = {};

        // Validation for Name Update
        if (name !== undefined) {
            // Only admins or the user themselves can update the name
            if (session.email !== decodedEmail && session.role !== "admin") {
                return NextResponse.json({ error: "Unauthorized to update this profile" }, { status: 403 });
            }
            updates.name = name;
        }

        // Validation for Role Update
        if (role !== undefined) {
            // Strictly check admin role checking
            if (session.role !== "admin") {
                return NextResponse.json({ error: "Only admins can update roles" }, { status: 403 });
            }
            updates.role = role.toLowerCase(); // Ensure formatting mapping like 'admin', 'co-admin', 'user'
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await updateUserProfile(decodedEmail, updates);
        return NextResponse.json({ message: "Profile updated successfully" });
    } catch (error) {
        console.error("PATCH /api/users/[email] error:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ email: string }> }) {
    try {
        const { email } = await params;
        const decodedEmail = decodeURIComponent(email);
        
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.role !== "admin") {
            return NextResponse.json({ error: "Only admins can delete users" }, { status: 403 });
        }
        if (session.email === decodedEmail) {
            return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 });
        }

        await deleteUserByEmail(decodedEmail);
        return NextResponse.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("DELETE /api/users/[email] error:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
