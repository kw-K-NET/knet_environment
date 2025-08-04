-- Migration: 002_add_schema_version_table
-- Description: Create schema_version table to track migration versions
-- Created: 2024-01-01

-- Create schema_version table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_version (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 