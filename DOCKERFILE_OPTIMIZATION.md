# ============================================================================
# OPTIMIZATION GUIDE: Key Changes & Rationale
# ============================================================================

## 1. THREE-STAGE BUILD (vs TWO-STAGE)
   - Stage 1 (builder): Compile TypeScript, run build
   - Stage 2 (pruned): Fresh install of PRODUCTION dependencies only
   - Stage 3 (runtime): Final minimal image
   
   WHY: Two-stage can include dev dependencies if npm ci caches incorrectly.
   Three-stage guarantees clean production node_modules.

## 2. DEPENDENCY INSTALLATION OPTIMIZATION
   OLD: npm ci --only=production
   NEW: npm ci --omit=dev in builder stage, separate pruned stage
   
   WHY: --only=production is deprecated. --omit=dev is explicit. Separate stage
   ensures zero dev dependencies leak into runtime image.

## 3. LAYER CACHING STRATEGY
   OLD: package*.json copied after WORKDIR
   NEW: package*.json copied FIRST before source code
   
   WHY: Docker layers cache from bottom-up. If only source code changes,
   npm ci (most expensive operation) is skipped. Cache hit = fast rebuilds.

## 4. NON-ROOT USER (SECURITY)
   OLD: Ran as root (dangerous in production)
   NEW: Created 'nextjs' user (UID 1001)
   
   WHY: Root compromise = full container compromise. Non-root limits blast radius.
   Best practice for container security. Pass ownership with --chown flags.

## 5. ENVIRONMENT VARIABLES
   OLD: NODE_ENV=production only
   NEW: Added NEXT_TELEMETRY_DISABLED=1
   
   WHY: Disables Next.js telemetry, reduces startup time, respects privacy.
   Set early to affect all layers.

## 6. ENTRYPOINT OPTIMIZATION
   OLD: CMD ["npm", "start"]
   NEW: CMD ["node_modules/.bin/next", "start"]
   
   WHY: Skips npm overhead (PID 1 = npm, not Next.js). Direct process management
   ensures proper signal handling (SIGTERM/SIGKILL). Faster startup, cleaner shutdown.

## 7. HEALTH CHECK IMPROVEMENTS
   OLD: 5s timeout, 5s start-period
   NEW: 5s timeout, 10s start-period
   
   WHY: Next.js needs time to compile on first start. Extended start-period
   prevents premature failures. Same 5s timeout for steady state.

## 8. FILE OWNERSHIP
   OLD: Root owner by default
   NEW: nextjs:nodejs owner explicitly set
   
   WHY: Consistency when running as non-root user. Prevents permission errors
   during app execution.

## 9. COPY EFFICIENCY
   OLD: Separate COPY commands
   NEW: Combined with --chown in single command per file
   
   WHY: Fewer layers = smaller image. --chown during COPY is atomic.

## ============================================================================
## SIZE COMPARISON (Expected)
## ============================================================================
OLD image:   ~280 MB (with dev dependencies)
NEW image:   ~240 MB (production only)
Improvement: ~40 MB smaller, faster pulls/deploys

## ============================================================================
## SECURITY IMPROVEMENTS
## ============================================================================
✓ Non-root user execution
✓ No dev dependencies in runtime
✓ Telemetry disabled
✓ Explicit UID/GID for reproducibility

## ============================================================================
## PERFORMANCE IMPROVEMENTS
## ============================================================================
✓ Faster cold starts (no npm wrapper)
✓ Better signal handling (SIGTERM → immediate shutdown)
✓ Optimized layer caching (faster rebuilds when code changes)
✓ Direct process management (no zombie processes from npm)

## ============================================================================
## DEPLOYMENT CONSIDERATIONS
## ============================================================================
- Use docker build -t pwx-inventory:latest -f Dockerfile.prod .
- Test locally: docker run -p 3000:3000 pwx-inventory:latest
- Verify non-root execution: docker run --user=root -it pwx-inventory /bin/sh
  (should fail if user can't be changed post-build)
- Monitor health: docker inspect <container> | grep Health
