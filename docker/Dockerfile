# Build stage
FROM node:24-alpine AS build-server

WORKDIR /app

# Copy package.json and package-lock.json
COPY server/package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY server .

ENV NODE_ENV=production

# Build the TypeScript files
RUN npm run build


# Build stage
FROM node:24-alpine AS build-admin-panel

WORKDIR /app

# Copy package.json and package-lock.json
COPY admin-panel/package*.json ./

# Copy server files
COPY server /app/server

# Install app dependencies
RUN npm ci

# Bundle app source
COPY admin-panel .

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

# Copy builded files
COPY --from=build-server /app/dist ./dist
COPY --from=build-admin-panel /app/dist /app/admin-panel/dist

ENV NODE_ENV=production

# Expose port server port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start:prod"]