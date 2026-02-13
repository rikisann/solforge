FROM node:18-alpine

WORKDIR /app

# Copy package files and install ALL deps (need @types for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Prune to production only
RUN npm prune --production && rm -rf src/ tsconfig.json

# Non-root user
RUN addgroup -g 1001 -S solforge && \
    adduser -S solforge -u 1001
USER solforge

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
