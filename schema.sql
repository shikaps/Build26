create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text unique,
  profile_info jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  deadline date,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  deadline date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_assignee_idx on public.tasks (assigned_to);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_priority_idx on public.tasks (priority);
create index if not exists tasks_deadline_idx on public.tasks (deadline);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;

create policy if not exists "profiles_are_viewable_by_owner" on public.profiles
  for select using (auth.uid() = id);

create policy if not exists "profiles_can_update_own_profile" on public.profiles
  for update using (auth.uid() = id);

create policy if not exists "projects_visible_to_members" on public.projects
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.projects.id and pm.user_id = auth.uid()
    ) or owner_id = auth.uid()
  );

create policy if not exists "projects_manageable_by_owner" on public.projects
  for update using (owner_id = auth.uid());

create policy if not exists "projects_createable_by_authenticated_users" on public.projects
  for insert with check (owner_id = auth.uid());

create policy if not exists "projects_deletable_by_owner" on public.projects
  for delete using (owner_id = auth.uid());

create policy if not exists "project_members_visible_to_project_members" on public.project_members
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.project_members.project_id and pm.user_id = auth.uid()
    )
  );

create policy if not exists "project_members_manageable_by_owner" on public.project_members
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy if not exists "project_members_deletable_by_owner" on public.project_members
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy if not exists "tasks_visible_to_project_members" on public.tasks
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.tasks.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = public.tasks.project_id and p.owner_id = auth.uid()
    )
  );

create policy if not exists "tasks_manageable_by_project_members" on public.tasks
  for insert with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.tasks.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = public.tasks.project_id and p.owner_id = auth.uid()
    )
  );

create policy if not exists "tasks_updateable_by_access" on public.tasks
  for update using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.tasks.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = public.tasks.project_id and p.owner_id = auth.uid()
    )
  );

create policy if not exists "tasks_deletable_by_access" on public.tasks
  for delete using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = public.tasks.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = public.tasks.project_id and p.owner_id = auth.uid()
    )
  );
