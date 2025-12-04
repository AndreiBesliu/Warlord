# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Install deps (use npm ci for reproducible builds if package-lock.json exists)
COPY package*.json ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

# Production stage (serve built files using nginx)
FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html

# Ensure SPA fallback to index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
