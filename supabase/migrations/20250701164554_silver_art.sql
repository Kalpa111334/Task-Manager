/*
# Employee Location Tracking Schema

1. New Tables
  - `employee_locations`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to public.users)
    - `latitude` (double precision)
    - `longitude` (double precision)
    - `timestamp` (timestamptz)
    - `battery_level` (integer)
    - `connection_status` (text)
    - `task_id` (uuid, foreign key to tasks)
    - `location_accuracy` (double precision)
    - `created_at` (timestamptz)

2. Security
  - Enable RLS on `employee_locations` table
  - Add policy for admins to view all locations
  - Add policy for employees to insert their own location

3. Cleanup Functions
  - Function to clean old location data (keep last 24 hours)
  - Trigger for automatic cleanup after each insert
*/

-- Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create employee_locations table
CREATE TABLE IF NOT EXISTS employee_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    battery_level INTEGER,
    connection_status TEXT,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    location_accuracy DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;

-- Admins can view all locations
CREATE POLICY "Admins can view all locations"
ON employee_locations FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'admin'
);

-- Employees can only insert their own location
CREATE POLICY "Employees can insert their own location"
ON employee_locations FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- Create function to clean old location data (keep last 24 hours)
CREATE OR REPLACE FUNCTION clean_old_locations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM employee_locations
    WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create a trigger function for automatic cleanup
CREATE OR REPLACE FUNCTION clean_old_locations_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM employee_locations
    WHERE timestamp < NOW() - INTERVAL '24 hours';
    RETURN NULL;
END;
$$;

-- Create a trigger that runs after each insert
DROP TRIGGER IF EXISTS clean_old_locations_trigger ON employee_locations;
CREATE TRIGGER clean_old_locations_trigger
    AFTER INSERT ON employee_locations
    EXECUTE FUNCTION clean_old_locations_trigger();