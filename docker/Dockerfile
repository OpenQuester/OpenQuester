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
RUN mkdir -p admin-panel/.server-types/dto \
	&& mkdir -p admin-panel/.server-types/enums/user \
	&& mkdir -p admin-panel/.server-types/types/admin \
	&& mkdir -p admin-panel/.server-types/types/pagination \
	&& cp -r src/domain/types/dto/. admin-panel/.server-types/dto/ \
	&& cp src/domain/enums/user/UserStatus.ts admin-panel/.server-types/enums/user/ \
	&& cp src/domain/types/admin/AdminTypes.ts admin-panel/.server-types/types/admin/ \
	&& cp src/domain/types/pagination/PaginatedResult.ts admin-panel/.server-types/types/pagination/ \
	&& cp src/domain/types/pagination/PaginationOpts.ts admin-panel/.server-types/types/pagination/

# Fix relative import paths in the copied index.ts to match the new structure
RUN sed -i 's|../../enums/user/UserStatus|../enums/user/UserStatus|g' admin-panel/.server-types/dto/index.ts \
	&& sed -i 's|../../types/admin/AdminTypes|../types/admin/AdminTypes|g' admin-panel/.server-types/dto/index.ts \
	&& sed -i 's|../../types/pagination/PaginatedResult|../types/pagination/PaginatedResult|g' admin-panel/.server-types/dto/index.ts \
	&& sed -i 's|../../types/pagination/PaginationOpts|../types/pagination/PaginationOpts|g' admin-panel/.server-types/dto/index.ts

# Exclude admin-panel from server TypeScript compilation to avoid JSX conflicts
RUN sed -i 's|"exclude": \[".history/\*\*/\*", "\*\*/\*.md"\]|"exclude": [".history/**/*", "**/*.md", "admin-panel/**/*"]|g' tsconfig.json

# --- Build admin-panel (static) ---
# Copy only manifests first for caching
COPY admin-panel/package*.json ./admin-panel/
# Force fresh install to avoid cross-platform esbuild binary issues
RUN cd admin-panel && rm -f package-lock.json && npm install --no-audit --no-fund

# Copy admin-panel source and build
COPY admin-panel ./admin-panel
RUN cd admin-panel && npm run build

ENV NODE_ENV=production

# Build the TypeScript files
RUN npm run build


# Production stage
FROM node:24-alpine AS production

WORKDIR /app/server

COPY server/package*.json ./

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
