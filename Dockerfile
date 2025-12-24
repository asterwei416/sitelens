# Use official Playwright image to ensure browsers are installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port (Render sets PORT env var)
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
