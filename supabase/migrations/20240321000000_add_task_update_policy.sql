-- Drop existing policy if it exists
drop policy if exists "Employees can update their assigned tasks" on public.tasks;

-- Create policy for employees to update their assigned tasks
create policy "Employees can update their assigned tasks"
    on public.tasks for update
    to authenticated
    using (
        auth.uid() = assigned_to
    )
    with check (
        auth.uid() = assigned_to
        and status in ('Not Started', 'In Progress', 'Paused', 'Completed')
    ); 