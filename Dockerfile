# --- Stage 1: Build the React Frontend ---
# Use an official Node.js image for the build environment
FROM node:18-alpine AS build-stage

# Set the working directory for the frontend build
WORKDIR /app/frontend

# Copy package.json and install dependencies first to leverage Docker caching
COPY frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/ ./

# The API URL is now relative because the backend serves the frontend
# from the same origin inside the container.
ENV REACT_APP_API_URL=/

# Build the static files for production
RUN npm run build

# --- Stage 2: Create the Final Node.js Server Image ---
# Use the same Node.js version for the final production image
FROM node:18-alpine

# Set the working directory for the final application
WORKDIR /app

# Copy package.json from the backend and install only production dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy the rest of the backend source code
COPY backend/ ./

# --- Combine Frontend and Backend ---
# Copy the built static files from the 'build-stage' into a 'build' folder
# that the Express server will use to serve the frontend.
COPY --from=build-stage /app/frontend/build ./build

# The server will run on port 5000 inside the container
EXPOSE 5000

# The command to start the Node.js server
CMD ["node", "server.js"]