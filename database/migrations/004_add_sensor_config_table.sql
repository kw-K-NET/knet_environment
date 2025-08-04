-- Migration: 004_add_aircon_sensor_table
-- Description: airconditioner sensor value column
-- Created: 2024-01-01

ALTER TABLE temp_sensor_data
ADD COLUMN ac_outlet_temperature FLOAT,
ADD COLUMN ac_outlet_humidity FLOAT;