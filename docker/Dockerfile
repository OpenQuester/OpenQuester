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

# Browser client (web/), served by the API from the same origin
# Static output, so build it once on the runner instead of under emulation
FROM --platform=$BUILDPLATFORM node:24-alpine AS build-web

WORKDIR /app/web

COPY web/package*.json ./

RUN npm ci

COPY web .

# Public Discord application id; empty builds the app without Discord sign-in
ARG VITE_DISCORD_CLIENT_ID=""
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

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

# Web app, served for every non-API path (see WebAppController)
COPY --from=build-web /app/web/dist /app/web
ENV WEB_APP_DIR=/app/web

ENV NODE_ENV=production

# Expose port server port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start:prod"]