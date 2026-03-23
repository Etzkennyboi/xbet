# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy backend source
COPY src ./src

# Copy frontend source and build it
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm install
# Ensure we build the frontend - we need the dist folder
RUN npm run build

# Go back to root
WORKDIR /app

# Ensure we have the .env variables or set them in the environment
# ENV PORT=3001

# Expose the API port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
