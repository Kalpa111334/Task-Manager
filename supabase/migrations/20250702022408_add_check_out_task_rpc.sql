-- Create a function to handle task check-out atomically
CREATE OR REPLACE FUNCTION check_out_task(
  p_task_id UUID, 
  p_user_id UUID, 
  p_timestamp TIMESTAMPTZ
) RETURNS VOID AS $$
DECLARE
  v_current_status TEXT;
  v_assigned_to UUID;
BEGIN
  -- Fetch current task status and assigned user
  SELECT status, assigned_to INTO v_current_status, v_assigned_to
  FROM tasks 
  WHERE id = p_task_id;

  -- Validate task status and user assignment
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_current_status != 'In Progress' THEN
    RAISE EXCEPTION 'Only tasks in progress can be checked out';
  END IF;

  IF v_assigned_to != p_user_id THEN
    RAISE EXCEPTION 'You are not authorized to check out this task';
  END IF;

  -- Insert task event
  INSERT INTO task_events (
    task_id, 
    user_id, 
    event_type, 
    timestamp
  ) VALUES (
    p_task_id, 
    p_user_id, 
    'check_out', 
    p_timestamp
  );

  -- Update task status
  UPDATE tasks 
  SET 
    status = 'Paused', 
    updated_at = p_timestamp,
    last_pause_at = p_timestamp
  WHERE 
    id = p_task_id 
    AND assigned_to = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 