# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create temp directory with proper permissions
RUN mkdir -p /tmp/mcp-voice-desc && \
    chown -R nodejs:nodejs /tmp/mcp-voice-desc && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('./dist/utils/health.js').check()" || exit 1

# Expose port for WebSocket transport (if used)
EXPOSE 3001

# Set NODE_ENV
ENV NODE_ENV=production

# Start server
CMD ["node", "dist/index.js"]