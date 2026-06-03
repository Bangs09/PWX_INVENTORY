import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 120; // Allow 120 requests per minute per IP

export default function proxy(request: NextRequest) {
    // Only apply to our backend API endpoints
    if (request.nextUrl.pathname.startsWith('/api/')) {

        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown-ip';

        const now = Date.now();
        const clientData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

        // Reset the count if the time window has passed
        if (now - clientData.lastReset > RATE_LIMIT_WINDOW_MS) {
            clientData.count = 0;
            clientData.lastReset = now;
        }

        // Increment request count
        clientData.count++;
        rateLimitMap.set(ip, clientData);

        // Block if limit exceeded
        if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - clientData.lastReset)) / 1000)
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((RATE_LIMIT_WINDOW_MS - (now - clientData.lastReset)) / 1000).toString()
                    }
                }
            );
        }

        // Anti-memory-leak safeguard: Keep the map size reasonable
        if (rateLimitMap.size > 5000) {
            rateLimitMap.clear();
        }
    }

    // Pass the request along
    const response = NextResponse.next();

    // Add essential security headers to all responses
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;
}

// Ensure the middleware only runs for API routes
export const config = {
    matcher: '/api/:path*',
};
