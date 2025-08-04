-- Migration: 001_initial_schema
-- Description: Initial schema creation for temp_sensor_data table
-- Created: 2024-01-01

-- Create temp_sensor_data table
CREATE TABLE IF NOT EXISTS temp_sensor_data (
    id SERIAL PRIMARY KEY,
    temperature FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for timestamp
CREATE INDEX IF NOT EXISTS idx_temp_sensor_data_timestamp ON temp_sensor_data(timestamp); 