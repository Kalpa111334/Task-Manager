-- Add approval status to task_proofs table
alter table public.task_proofs
add column status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
add column reviewed_by uuid references auth.users(id) on delete set null,
add column reviewed_at timestamp with time zone,
add column rejection_reason text;

-- Update policies
drop policy if exists "Admins can update proof status" on public.task_proofs;

create policy "Admins can update proof status"
    on public.task_proofs for update
    to authenticated
    using (
        exists (
            select 1 from public.users
            where users.id = auth.uid()
            and users.role = 'admin'
        )
    ); 