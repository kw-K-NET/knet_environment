#!/bin/sh

# Replace environment variables in built files
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|import\.meta\.env\.VITE_API_BASE_URL|\"$VITE_API_BASE_URL\"|g" {} \;

# Start nginx
nginx -g "daemon off;" 