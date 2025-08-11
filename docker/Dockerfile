# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY server/package*.json ./server

# Install app dependencies
RUN npm ci

# Bundle app source
COPY server server
COPY admin-panel admin-panel

ENV NODE_ENV=production

# Build the TypeScript files
RUN cd server && npm run build

# Production stage
FROM node:24-alpine AS production

WORKDIR /app/server

COPY server/package*.json .

# Copy openapi schema
COPY openapi/schema.json /app/openapi/

COPY server/storage/ /app/server/storage/

RUN npm ci --omit=dev

# Copy builded files
COPY --from=build /app/server/dist ./dist

ENV NODE_ENV=production

# Expose port server port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start:prod"]
