import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Strip all console.log calls in production (keep errors/warnings)
    compiler: {
        removeConsole: process.env.NODE_ENV === "production" ? {
            exclude: ['error', 'warn'],
        } : false,
    },
    // Allow long-lived SSE connections on the stream route (no timeout)
    experimental: {
        serverActions: {
            bodySizeLimit: "2mb",
        },
    },
    // Security & performance hardening
    poweredByHeader: false,
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
        ];
    },
};

export default nextConfig;
