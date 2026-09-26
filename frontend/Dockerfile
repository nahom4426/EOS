# ==========================================
# EOS Frontend - Node / Vite Production Container
# ==========================================
FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Clean install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Optional build argument for API base URL
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build production assets
RUN npm run build

# Expose Vite preview port
EXPOSE 5173

# Serve production build on port 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
