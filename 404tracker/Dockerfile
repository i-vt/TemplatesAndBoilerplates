FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Create data directory
RUN mkdir -p /app/data

# Expose custom high port
EXPOSE 8742

# Non-root user for security
RUN addgroup -S tracker && adduser -S tracker -G tracker
RUN chown -R tracker:tracker /app
USER tracker

ENV NODE_ENV=production
ENV PORT=8742

CMD ["node", "src/server.js"]
