import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { updatePassword, getUserByEmail } from "@/lib/db";
import { z } from "zod";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "super-secret-fallback-key-for-development"
);

const changePasswordSchema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const tokenStr = cookieStore.get("pwx_auth_token")?.value;

        if (!tokenStr) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        let userPayload: any;
        try {
            const verified = await jwtVerify(tokenStr, JWT_SECRET);
            userPayload = verified.payload;
        } catch (err) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
        }

        const body = await req.json();
        const parseResult = changePasswordSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
        }

        const { newPassword } = parseResult.data;

        // Hash securely 
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update Backend
        await updatePassword(userPayload.email, passwordHash);

        // Fetch refreshed user layer
        const updatedUser = await getUserByEmail(userPayload.email);
        
        if (!updatedUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Issue clean token without forced change
        const newToken = await new SignJWT({ 
            userId: updatedUser.id, 
            role: updatedUser.role, 
            email: updatedUser.email,
            mustChangePassword: false 
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("24h")
            .sign(JWT_SECRET);

        cookieStore.set("pwx_auth_token", newToken, {
            httpOnly: true,  
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict", 
            path: "/",
            maxAge: 24 * 60 * 60,
        });

        return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });

    } catch (error) {
        console.error("Change Password exception:", error);
        return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }
}
