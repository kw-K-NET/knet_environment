-- PostgreSQL initialization script for knet_management
-- This script will run when the PostgreSQL container starts for the first time

-- PostgreSQL does not support "CREATE DATABASE IF NOT EXISTS"
-- Instead, use conditional creation or rely on POSTGRES_DB environment variable
-- The database is already created by Docker's POSTGRES_DB environment variable

-- Connect to the created database (this script runs in the context of the database)
-- No need to CREATE DATABASE here as Docker already handles it

-- Create schema if needed (optional)
-- CREATE SCHEMA IF NOT EXISTS knet_schema;

-- Grant comprehensive permissions to postgres user
-- Note: GRANT ALL ON DATABASE only grants connection, create schema, and temp table privileges
GRANT ALL PRIVILEGES ON DATABASE knet_env_db TO postgres;

-- For more comprehensive permissions on future tables and sequences
-- (Uncomment if you want to grant permissions on all future objects)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

-- Grant usage and create permissions on public schema
GRANT USAGE, CREATE ON SCHEMA public TO postgres;

-- Grant all privileges on existing tables in public schema (if any exist)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Note: Table creation is handled by the Go application
-- This file exists to satisfy the docker-compose volume mapping
-- and can be extended with additional initialization logic if needed

-- Confirmation message
SELECT 'PostgreSQL initialization script executed successfully' AS message;
