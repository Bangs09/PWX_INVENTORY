import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
