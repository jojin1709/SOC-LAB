FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY control-center/frontend/package*.json ./
RUN npm ci
COPY control-center/frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY control-center/package*.json ./
RUN npm ci --only=production
COPY control-center/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package*.json ./
COPY --from=backend-builder /app/static.json ./dist/public 2>/dev/null || true
COPY --from=frontend-builder /frontend/dist ./dist/public

EXPOSE 8088
CMD ["node", "dist/index.js"]