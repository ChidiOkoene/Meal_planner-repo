# Use official Node.js 18 LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Build TypeScript code
RUN npm run build

# Expose application port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.js"]