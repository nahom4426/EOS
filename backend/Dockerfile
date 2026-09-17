# ==========================================
# EOS Backend - Production Dockerfile
# ==========================================
FROM node:20-alpine

# Install postgresql-client for pg_isready and wget for healthchecks
RUN apk add --no-cache postgresql-client wget bash

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure upload directories exist
RUN mkdir -p public/uploads/avatars public/uploads/audio

# Make entrypoint script executable
RUN chmod +x ./docker-entrypoint.sh

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]
