# --- Stage 0: Source Cloner ---
# Use a lightweight image that includes Git to clone the repository.
# This stage's only purpose is to fetch the latest source code.
FROM alpine/git AS source-cloner

# Set a working directory inside this stage.
WORKDIR /app

# Add a build argument that can be changed to invalidate the Docker cache.
# This ensures that a fresh 'git clone' is performed when needed.
ARG CACHE_BUSTER=1

# Clone the entire GitHub repository into the current working directory (/app).
RUN git clone https://github.com/bodybuildingfly/trello-card-scheduler.git .

# --- Stage 1: Build the React Frontend ---
# Use a Node.js image for building the React frontend.
FROM node:18-alpine AS build-stage

# Set the working directory for the frontend build.
WORKDIR /app/frontend

# Copy only the package files from the source-cloner stage first.
# This leverages Docker's layer caching for faster subsequent builds if dependencies haven't changed.
COPY --from=source-cloner /app/frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend source code from the cloner stage.
COPY --from=source-cloner /app/frontend/ ./

# Build the static files for production. The output will be in /app/frontend/build.
RUN npm run build


# --- Stage 2: Create the Final Node.js Server Image ---
# Start from a fresh, clean Node.js image for the final production environment.
FROM node:18-alpine

# Set the working directory for the final application.
WORKDIR /app

# Set the environment to production. This tells Express to run in an optimized mode.
ENV NODE_ENV=production

# Add a build argument to control database setup.
# Default to 'false' to use an external database.
ARG USE_LOCAL_DB=false

# Set an environment variable from the build argument.
# This makes it accessible to scripts and applications inside the container.
ENV USE_LOCAL_DB=${USE_LOCAL_DB}

# Conditionally install PostgreSQL if USE_LOCAL_DB is true.
# This block is only executed if the build argument is passed as --build-arg USE_LOCAL_DB=true
RUN if [ "${USE_LOCAL_DB}" = "true" ]; then \
    apk add --no-cache postgresql postgresql-contrib shadow; \
    mkdir -p /var/run/postgresql; \
    chown -R postgres:postgres /var/run/postgresql; \
    mkdir -p /var/lib/postgresql/data; \
    chown -R postgres:postgres /var/lib/postgresql/data; \
  fi

# Copy the backend's package files from the cloner stage.
COPY --from=source-cloner /app/backend/package*.json ./backend/

# Install only production dependencies to keep the final image small and secure.
RUN npm install --prefix backend --production

# Copy the rest of the backend source code from the cloner stage.
COPY --from=source-cloner /app/backend/ ./backend/

# Copy the built static files from the 'build-stage' into a 'build' folder
# that the Express server will use to serve the frontend.
COPY --from=build-stage /app/frontend/build ./build

# Copy the entrypoint script into the container.
# This script will handle starting PostgreSQL and then the main application.
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The server will run on port 5000 inside the container.
EXPOSE 5000

# Use the entrypoint script to start the container.
# This allows for custom startup logic, like initializing the database.
ENTRYPOINT ["docker-entrypoint.sh"]

# The default command if the entrypoint script is used.
# This will be executed by the entrypoint script after it's done.
CMD ["npm", "start", "--prefix", "backend"]