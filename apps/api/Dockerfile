FROM node:20-slim

WORKDIR /app

# Install OpenSSL, curl (for HEALTHCHECK), and ca-certificates
RUN apt-get update && apt-get install -y openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy root and workspace package.jsons
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Copy shared source before npm install so workspaces link properly
COPY packages/shared/*.js ./packages/shared/

# Defensive: remove any host-copied node_modules before installing
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules

RUN npm install

# Copy everything else
COPY . .

# FIX: Correct relative symlink paths
RUN rm -rf /app/node_modules/@resonance && \
    mkdir -p /app/node_modules/@resonance && \
    ln -s ../../packages/shared /app/node_modules/@resonance/shared && \
    ln -s ../../apps/api /app/node_modules/@resonance/api && \
    ln -s ../../apps/web /app/node_modules/@resonance/web

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# RUN apt-get update && apt-get install -y openssl curl ca-certificates git && rm -rf /var/lib/apt/lists/*

EXPOSE 3001

# ============================================================================
# HEALTH CHECK — L09/L11 production requirement
# Returns 200 when OK, 503 when degraded (DB/Redis/Queue down)
# ============================================================================
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

# ============================================================================
# L06: ENTRYPOINT SCRIPT — routes to API or Worker based on APP_MODE
# ============================================================================
# Usage:
#   docker run -e APP_MODE=api resonance-api        → starts HTTP server
#   docker run -e APP_MODE=worker resonance-api     → starts BullMQ worker
# ============================================================================
COPY apps/api/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["api"]