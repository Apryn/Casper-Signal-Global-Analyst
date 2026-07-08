FROM node:18-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy rest of the application files
COPY . .

EXPOSE 5000

# Start server
CMD ["npm", "start"]
