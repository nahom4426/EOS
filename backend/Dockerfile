# Production Dockerfile for Backend API
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files first for cached layer installation
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose API port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start Express server
CMD ["npm", "start"]
