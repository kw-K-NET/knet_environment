-- Migration: 003_insert_initial_migration_record
-- Description: Insert record for the initial schema migration
-- Created: 2024-01-01

-- Insert the initial schema migration record
INSERT INTO schema_version (version, description) 
VALUES ('001_initial_schema', 'Initial schema creation for temp_sensor_data table')
ON CONFLICT (version) DO NOTHING; 