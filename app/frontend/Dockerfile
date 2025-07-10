# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (without package-lock.json to avoid optional dependency issues)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose port
EXPOSE 80

# Start with entrypoint script
CMD ["/usr/local/bin/entrypoint.sh"] 