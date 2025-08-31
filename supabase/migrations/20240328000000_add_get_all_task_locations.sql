-- Function to get all task locations with task and geofence details
CREATE OR REPLACE FUNCTION get_all_task_locations()
RETURNS TABLE (
  id UUID,
  task_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  due_date TIMESTAMPTZ,
  assigned_to UUID,
  price DECIMAL,
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
    t.id as task_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.assigned_to,
    t.price,
    tl.geofence_id,
    g.name as geofence_name,
    COALESCE(tl.latitude, g.center_latitude) as latitude,
    COALESCE(tl.longitude, g.center_longitude) as longitude,
    COALESCE(tl.radius_meters, g.radius_meters) as radius_meters,
    tl.arrival_required,
    tl.departure_required
  FROM tasks t
  LEFT JOIN task_locations tl ON t.id = tl.task_id
  LEFT JOIN geofences g ON g.id = tl.geofence_id
  WHERE (
    -- Allow users to see their assigned tasks
    auth.uid() = t.assigned_to
    OR
    -- Allow admins to see all tasks
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  ORDER BY t.created_at DESC;
END;
$$;