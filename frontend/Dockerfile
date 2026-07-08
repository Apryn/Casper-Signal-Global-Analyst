# Step 1: Build React frontend
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# We set VITE_API_URL to /api for relative proxying through Nginx
ENV VITE_API_URL=/api
RUN npm run build

# Step 2: Serve using Nginx
FROM nginx:stable-alpine

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx proxy settings
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
