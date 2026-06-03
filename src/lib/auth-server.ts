/**
 * SERVER-ONLY authentication helpers.
 * This file must NEVER be imported by client components ("use client").
 * It reads the HttpOnly JWT cookie and verifies it server-side.
 */
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET_VALUE = process.env.JWT_SECRET;

function getJwtSecret(): Uint8Array {
    if (!JWT_SECRET_VALUE && process.env.NODE_ENV === "production") {
        throw new Error("[FATAL] JWT_SECRET environment variable is not set. The server cannot handle authenticated requests securely.");
    }
    return new TextEncoder().encode(
        JWT_SECRET_VALUE || "super-secret-fallback-key-for-development"
    );
}

export type UserRole = "admin" | "co-admin" | "user";

export type SessionPayload = {
    userId: number;
    email: string;
    role: UserRole;
};

/**
 * Reads and verifies the HttpOnly JWT cookie.
 * Call this inside API Route handlers only.
 * Returns the decoded session payload, or null if missing/invalid/expired.
 */
export async function getSession(): Promise<SessionPayload | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("pwx_auth_token")?.value;
        if (!token) return null;

        const { payload } = await jwtVerify(token, getJwtSecret());
        return {
            userId: payload.userId as number,
            email: payload.email as string,
            role: payload.role as UserRole,
        };
    } catch {
        // Token missing, expired, or tampered — treat as unauthenticated
        return null;
    }
}
