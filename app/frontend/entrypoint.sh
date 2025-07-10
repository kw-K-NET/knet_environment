#!/bin/sh

# Replace environment variables in built files if they exist
if [ -n "$VITE_API_BASE_URL" ]; then
  echo "Setting VITE_API_BASE_URL to: $VITE_API_BASE_URL"
  find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|import\.meta\.env\.VITE_API_BASE_URL|\"$VITE_API_BASE_URL\"|g" {} \;
fi

# Start nginx
nginx -g "daemon off;" 