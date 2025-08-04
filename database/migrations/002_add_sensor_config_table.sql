-- Migration: 002_add_sensor_config_table
-- Description: Add airconditioner sensor value columns to temp_sensor_data table
-- Created: 2024-01-01

ALTER TABLE temp_sensor_data
ADD COLUMN ac_outlet_temperature FLOAT,
ADD COLUMN ac_outlet_humidity FLOAT;