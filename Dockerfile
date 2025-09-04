# Multi-stage Docker build for production optimization
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --include=dev
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S idwo -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=build --chown=idwo:nodejs /app/dist ./dist
COPY --from=build --chown=idwo:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=idwo:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p logs && chown idwo:nodejs logs

# Switch to non-root user
USER idwo

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

# Start the application
CMD ["node", "dist/server.js"]

# Labels for metadata
LABEL maintainer="IDWO Team"
LABEL version="1.0.0"
LABEL description="Intelligent Development Workflow Orchestrator - MCP Server"
LABEL org.opencontainers.image.source="https://github.com/your-org/idwo-mcp-server"