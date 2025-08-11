# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy server package manifests first (better layer cache)
COPY server/package*.json ./

# Install app dependencies
RUN npm ci

# Bundle server source
COPY server ./

# Prepare a local copy of server shared types for admin-panel build (so Vite can resolve without traversing outside root in constrained build env)
RUN mkdir -p admin-panel/.server-types \
	&& mkdir -p admin-panel/.server-types/dto \
	&& cp -r server/src/domain/types/dto admin-panel/.server-types/ \
	&& mkdir -p admin-panel/.server-types/enums/user \
	&& cp server/src/domain/enums/user/UserStatus.ts admin-panel/.server-types/enums/user/ \
	&& mkdir -p admin-panel/.server-types/pagination \
	&& cp server/src/domain/types/pagination/PaginatedResult.ts admin-panel/.server-types/pagination/ \
	&& cp server/src/domain/types/pagination/PaginationOpts.ts admin-panel/.server-types/pagination/ || true

# --- Build admin-panel (static) ---
# Copy only manifests first for caching
COPY admin-panel/package*.json ./admin-panel/
RUN cd admin-panel && npm ci

# Copy admin-panel source and build
COPY admin-panel ./admin-panel
RUN cd admin-panel && npm run build

ENV NODE_ENV=production

# Build the TypeScript files
RUN npm run build


# Production stage
FROM node:24-alpine AS production

WORKDIR /app/server

COPY server/package*.json .

# Copy openapi schema
COPY openapi/schema.json /app/openapi/

COPY server/storage/ /app/server/storage/

RUN npm ci --omit=dev

# Copy built server files
COPY --from=build /app/dist ./dist

# Copy built admin-panel static assets (only dist)
COPY --from=build /app/admin-panel/dist /app/admin-panel/dist

ENV NODE_ENV=production

# Expose port server port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start:prod"]
