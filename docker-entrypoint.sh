#!/bin/sh
set -e

# If USE_LOCAL_DB is not 'true', just run the main command and exit.
# This allows the container to run with an external database.
if [ "$USE_LOCAL_DB" != "true" ]; then
  echo "[INFO] External database mode. Skipping local DB setup."
  exec "$@"
fi

# --- This section only runs if USE_LOCAL_DB is 'true' ---
echo "[INFO] Local database mode. Setting up PostgreSQL..."

# Set default database credentials for the local instance.
# These can be overridden by environment variables if needed.
DB_USER="${DB_USER:-tcs_user}"
DB_PASSWORD="${DB_PASSWORD:-tcs_pass}"
DB_NAME="${DB_NAME:-tcs_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Export these variables so they are available to the Node.js application.
export DB_USER
export DB_PASSWORD
export DB_NAME
export DB_HOST
export DB_PORT

# Define the PostgreSQL data directory.
PGDATA="/var/lib/postgresql/data"
# A flag file to indicate that the database has been initialized.
INIT_FLAG_FILE="$PGDATA/db_initialized.flag"

# Initialize the database only if the flag file does not exist.
# This ensures that the database is not re-initialized on every container start.
if [ ! -f "$INIT_FLAG_FILE" ]; then
  echo "[INFO] Initializing PostgreSQL database for the first time..."

  # Create a temporary file to hold the password for 'initdb'.
  # This is more secure than passing the password on the command line.
  echo "$DB_PASSWORD" > /tmp/pgpass
  chmod 600 /tmp/pgpass
  chown postgres:postgres /tmp/pgpass

  # Initialize the database cluster as the 'postgres' user.
  su postgres -c "initdb -D $PGDATA --username=$DB_USER --pwfile=/tmp/pgpass"
  
  # Securely remove the temporary password file.
  rm /tmp/pgpass

  # Modify pg_hba.conf to allow passwordless local connections.
  # The Node.js app will still use the password, but this simplifies admin tasks.
  echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  echo "host all all ::1/128 trust" >> "$PGDATA/pg_hba.conf"
  
  # Start the PostgreSQL server temporarily to create the database.
  su postgres -c "pg_ctl -D $PGDATA -o \"-c listen_addresses='*'\" start"
  
  # Create the application database, owned by the application user.
  echo "[INFO] Creating database '$DB_NAME'..."
  su postgres -c "createdb $DB_NAME -O $DB_USER"
  
  # Stop the server. It will be started again in the foreground later.
  su postgres -c "pg_ctl -D $PGDATA stop"
  
  # Create the flag file to prevent this block from running again.
  touch "$INIT_FLAG_FILE"
  chown postgres:postgres "$INIT_FLAG_FILE"
  
  echo "[INFO] Database initialization complete."
fi

# Start the PostgreSQL server in the background.
echo "[INFO] Starting PostgreSQL server..."
su postgres -c "postgres -D $PGDATA" &

# Wait for the PostgreSQL server to be ready to accept connections.
echo "[INFO] Waiting for PostgreSQL to accept connections..."
until su postgres -c "pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"; do
  sleep 1
done
echo "[INFO] PostgreSQL is ready."

# Execute the main command passed to the entrypoint script (e.g., 'npm start').
echo "[INFO] Starting application server..."
exec "$@"
