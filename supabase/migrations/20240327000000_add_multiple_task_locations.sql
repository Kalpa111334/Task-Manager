-- Create task_locations table to store multiple locations per task
CREATE TABLE IF NOT EXISTS task_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  arrival_required BOOLEAN NOT NULL DEFAULT true,
  departure_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_task_locations_task_id ON task_locations(task_id);
CREATE INDEX idx_task_locations_geofence_id ON task_locations(geofence_id);

-- Add RLS policies
ALTER TABLE task_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage task locations"
  ON task_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Employees can view assigned task locations"
  ON task_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_locations.task_id
      AND tasks.assigned_to = auth.uid()
    )
  );

-- Function to get task locations with geofence details
CREATE OR REPLACE FUNCTION get_task_locations(p_task_id UUID)
RETURNS TABLE (
  id UUID,
  task_id UUID,
  geofence_id UUID,
  geofence_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER,
  arrival_required BOOLEAN,
  departure_required BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.id,
    tl.task_id,
    tl.geofence_id,
    g.name as geofence_name,
    COALESCE(tl.latitude, g.center_latitude) as latitude,
    COALESCE(tl.longitude, g.center_longitude) as longitude,
    COALESCE(tl.radius_meters, g.radius_meters) as radius_meters,
    tl.arrival_required,
    tl.departure_required
  FROM task_locations tl
  LEFT JOIN geofences g ON g.id = tl.geofence_id
  WHERE tl.task_id = p_task_id;
END;
$$;