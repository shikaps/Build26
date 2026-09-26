const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const { WebSocket } = require('ws');
const { createClient } = require('@supabase/supabase-js');

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const app = express();
const PORT = Number(process.env.PORT || 3001);
const rootDir = __dirname;
const legacyEnvPath = path.join(rootDir, 'Task Manager.env');

dotenv.config({ path: path.join(rootDir, '.env') });
if (fs.existsSync(legacyEnvPath)) {
  dotenv.config({ path: legacyEnvPath });
}

if (fs.existsSync(legacyEnvPath)) {
  const legacyLines = fs
    .readFileSync(legacyEnvPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!process.env.SUPABASE_URL) {
    const urlMatch = legacyLines.find((line) => line.startsWith('http'));
    if (urlMatch) {
      process.env.SUPABASE_URL = urlMatch.replace(/\/rest\/v1\/?$/, '');
    }
  }

  if (!process.env.SUPABASE_ANON_KEY) {
    const keyMatch = legacyLines.find((line) => line.startsWith('sb_') || line.includes('anon') || line.includes('key'));
    if (keyMatch) {
      process.env.SUPABASE_ANON_KEY = keyMatch;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const state = {
  users: [
    { id: 'user-1', email: 'alice@studenthub.test', name: 'Alice Johnson', role: 'Project Lead' },
    { id: 'user-2', email: 'ben@studenthub.test', name: 'Ben Lee', role: 'Frontend' },
    { id: 'user-3', email: 'cora@studenthub.test', name: 'Cora Patel', role: 'Backend' },
    { id: 'user-4', email: 'dylan@studenthub.test', name: 'Dylan Chen', role: 'Design' },
  ],
  sessions: {},
  projects: [
    {
      id: 'project-1',
      name: 'Campus Event Planner',
      description: 'Plan the student festival and coordinate the event launch tasks.',
      deadline: '2026-10-15',
      owner_id: 'user-1',
      created_at: '2026-09-20T09:00:00.000Z',
    },
  ],
  projectMembers: {
    'project-1': ['user-1', 'user-2', 'user-3', 'user-4'],
  },
  tasks: [
    {
      id: 'task-1',
      project_id: 'project-1',
      title: 'Finalize event itinerary',
      description: 'Coordinate venue bookings, speaker flow, and student volunteer schedule.',
      assigned_to: 'user-1',
      priority: 'high',
      status: 'in_progress',
      deadline: '2026-10-05',
      created_at: '2026-09-22T08:00:00.000Z',
      updated_at: '2026-09-22T08:00:00.000Z',
    },
    {
      id: 'task-2',
      project_id: 'project-1',
      title: 'Build sign-up page',
      description: 'Create the landing page for event registration and ticket workflow.',
      assigned_to: 'user-2',
      priority: 'medium',
      status: 'todo',
      deadline: '2026-10-04',
      created_at: '2026-09-21T10:00:00.000Z',
      updated_at: '2026-09-21T10:00:00.000Z',
    },
    {
      id: 'task-3',
      project_id: 'project-1',
      title: 'Set up student check-in app',
      description: 'Prepare the QR scanning flow for volunteers and guest registration.',
      assigned_to: 'user-3',
      priority: 'high',
      status: 'done',
      deadline: '2026-09-30',
      created_at: '2026-09-19T15:00:00.000Z',
      updated_at: '2026-09-23T11:30:00.000Z',
    },
  ],
};

app.use(cors());
app.use(express.json());

function normalizeStatus(status) {
  return ['todo', 'in_progress', 'done'].includes(status) ? status : 'todo';
}

function normalizePriority(priority) {
  return ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';
}

function normalizeProjectStatus(status) {
  return ['todo', 'in_progress', 'done'].includes(status) ? status : 'todo';
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getUserById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getUserByEmail(email) {
  return state.users.find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function forProject(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function projectMembers(projectId) {
  return (state.projectMembers[projectId] || []).map((userId) => getUserById(userId)).filter(Boolean);
}

function getProjectTasks(projectId) {
  return state.tasks.filter((task) => task.project_id === projectId);
}

function projectProgress(projectId) {
  const tasks = getProjectTasks(projectId);
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === 'done').length;
  const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
  const pending = tasks.filter((task) => task.status === 'todo').length;
  const overallProgress = total === 0 ? 0 : Math.round((done / total) * 100);

  const workload = {};
  for (const task of tasks) {
    if (!task.assigned_to) continue;
    workload[task.assigned_to] = (workload[task.assigned_to] || 0) + 1;
  }

  return {
    total_tasks: total,
    completed_tasks: done,
    in_progress_tasks: inProgress,
    pending_tasks: pending,
    overall_progress: overallProgress,
    workload_per_member: workload,
  };
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader) return null;
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

function requireAuth(req) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  return state.sessions[token] || null;
}

function normalizeProfilePayload(user, profileRow = null, overrides = {}) {
  const storedProfile = profileRow && typeof profileRow.profile_info === 'object' ? profileRow.profile_info : {};
  const existingSettings = storedProfile.settings && typeof storedProfile.settings === 'object'
    ? storedProfile.settings
    : {};
  const nextName = overrides.name || profileRow?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const email = overrides.email || profileRow?.email || user?.email || '';
  const settings = {
    ...existingSettings,
    ...((overrides.settings && typeof overrides.settings === 'object') ? overrides.settings : {}),
  };

  return {
    id: user?.id || profileRow?.id || overrides.id || null,
    email,
    name: nextName,
    role: overrides.role || storedProfile.role || 'Student',
    profile_info: {
      ...storedProfile,
      ...((overrides.profile_info && typeof overrides.profile_info === 'object') ? overrides.profile_info : {}),
      settings,
    },
    created_at: profileRow?.created_at || new Date().toISOString(),
    updated_at: profileRow?.updated_at || new Date().toISOString(),
  };
}

async function getSupabaseClientWithToken(token) {
  if (!supabase || !token) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function getAuthenticatedProfile(req) {
  const fallbackUser = requireAuth(req);
  if (fallbackUser) {
    return { user: fallbackUser, profile: fallbackUser };
  }

  if (!supabase) {
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const client = await getSupabaseClientWithToken(token);
    if (!client) {
      return null;
    }

    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user) {
      return null;
    }

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    const normalized = normalizeProfilePayload(userData.user, profileRow);
    return { user: normalized, profile: normalized };
  } catch (error) {
    return null;
  }
}

async function upsertProfileRow(token, user, profileInput = {}) {
  if (!supabase || !token || !user?.id) {
    return null;
  }

  const client = await getSupabaseClientWithToken(token);
  if (!client) {
    return null;
  }

  const { data: existingRow, error: lookupError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError && lookupError.code !== 'PGRST116') {
    throw lookupError;
  }

  const mergedProfile = normalizeProfilePayload(user, existingRow, profileInput);
  const payload = {
    id: user.id,
    email: mergedProfile.email,
    name: mergedProfile.name,
    profile_info: mergedProfile.profile_info,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeProfilePayload(user, data, profileInput);
}

async function resolveAuthUser(req) {
  const authenticated = await getAuthenticatedProfile(req);
  if (!authenticated) {
    return null;
  }

  return authenticated.user;
}

async function ensureProjectAccess(projectId, userId) {
  if (!projectId || !userId) return null;

  const project = forProject(projectId);
  if (!project) return null;

  const members = state.projectMembers[projectId] || [];
  if (project.owner_id === userId || members.includes(userId)) {
    return project;
  }

  return null;
}

async function listProjectTasks(projectId, filters = {}) {
  const tasks = getProjectTasks(projectId);
  const statusFilter = filters.status;
  const memberFilter = filters.member;
  const priorityFilter = filters.priority;
  const sortBy = filters.sort || 'deadline';
  const direction = filters.direction === 'asc' ? 'asc' : 'desc';

  const filtered = tasks.filter((task) => {
    if (statusFilter && task.status !== normalizeProjectStatus(statusFilter)) {
      return false;
    }
    if (memberFilter && task.assigned_to !== memberFilter) {
      return false;
    }
    if (priorityFilter && task.priority !== normalizePriority(priorityFilter)) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const aValue = a[sortBy] || '';
    const bValue = b[sortBy] || '';
    if (sortBy === 'deadline') {
      return direction === 'asc'
        ? new Date(aValue) - new Date(bValue)
        : new Date(bValue) - new Date(aValue);
    }
    return direction === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  return filtered;
}

async function getOpenAIJson(payload) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior academic project planner. Return JSON only with structured planning recommendations.',
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '{}';

  try {
    return JSON.parse(content);
  } catch (error) {
    return {
      raw: content,
    };
  }
}

function buildHeuristicTaskPlan(projectGoal, projectDeadline, teamMembers, existingTasks, currentWorkload) {
  const teamList = Array.isArray(teamMembers) && teamMembers.length > 0 ? teamMembers : ['Team member'];
  const tasks = Array.isArray(existingTasks) && existingTasks.length > 0 ? existingTasks : [];
  const suggested = [
    {
      title: 'Define deliverables',
      priority: 'high',
      suggested_deadline: new Date(projectDeadline).toISOString().slice(0, 10),
      assignee: teamList[0],
      rationale: 'Set the scope and milestones early so the team can align to the same outcome.',
    },
    {
      title: 'Create the first milestone build',
      priority: 'high',
      suggested_deadline: new Date(new Date(projectDeadline).getTime() - 1000 * 60 * 60 * 24 * 4).toISOString().slice(0, 10),
      assignee: teamList[1] || teamList[0],
      rationale: 'This gives the team an early prototype or draft to validate progress against the goal.',
    },
    {
      title: 'Review and refine final submission',
      priority: 'medium',
      suggested_deadline: new Date(new Date(projectDeadline).getTime() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
      assignee: teamList[2] || teamList[0],
      rationale: 'Use the final stretch window for quality checks, fixes, and polishing.',
    },
  ];

  const workloadSummary = Array.isArray(currentWorkload) ? currentWorkload : [];

  return {
    project_goal: projectGoal,
    project_deadline: projectDeadline,
    task_breakdown: suggested.map((task, index) => ({
      id: `suggested-${index + 1}`,
      title: task.title,
      priority: task.priority,
      suggested_deadline: task.suggested_deadline,
      assignee: task.assignee,
      rationale: task.rationale,
    })),
    team_members: teamList,
    workload_snapshot: workloadSummary,
    notes: 'Tasks are distributed to keep the workload balanced and create visible progress milestones.',
  };
}

function buildHeuristicWorkloadAlert(tasks, teamMembers) {
  const memberNames = Array.isArray(teamMembers) && teamMembers.length > 0 ? teamMembers : [];
  const workload = {};

  for (const task of tasks || []) {
    const assignee = task.assigned_to || 'unassigned';
    workload[assignee] = (workload[assignee] || 0) + 1;
  }

  const sorted = Object.entries(workload).sort(([, a], [, b]) => b - a);
  const highest = sorted[0] || ['unassigned', 0];
  const [memberId, activeTasks] = highest;
  const member = memberNames.find((teamMember) => String(teamMember.id || teamMember) === String(memberId)) || { id: memberId, name: memberId };
  const suggestedReassignment = memberNames.find((teamMember) => String(teamMember.id || teamMember) !== String(memberId));

  return {
    alert: activeTasks > 2 ? 'High workload risk detected.' : 'No critical imbalance detected.',
    member_with_high_workload: {
      id: member.id || memberId,
      name: member.name || memberId,
      active_tasks: activeTasks,
    },
    number_of_active_tasks: activeTasks,
    suggested_redistribution: [
      {
        from: member.id || memberId,
        to: suggestedReassignment?.id || suggestedReassignment || 'unassigned',
        action: 'Reassign a lower-priority task or split the next task into a smaller subtask.',
      },
    ],
    suggested_member_for_reassignment: suggestedReassignment?.id || suggestedReassignment || null,
  };
}

async function handleAIOrganizer(req, res) {
  try {
    const payload = {
      project_goal: req.body.project_goal || '',
      project_deadline: req.body.project_deadline || '',
      team_members: req.body.team_members || [],
      existing_tasks: req.body.existing_tasks || [],
      current_workload: req.body.current_workload || [],
    };

    const response = await getOpenAIJson({
      ...payload,
      instruction: 'Provide a structured breakdown of suggested tasks, priorities, deadlines, and assignees for a student project team.',
    });

    const result = response || buildHeuristicTaskPlan(
      payload.project_goal,
      payload.project_deadline,
      payload.team_members,
      payload.existing_tasks,
      payload.current_workload,
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI task organizer failed.',
      error: error.message,
      fallback: buildHeuristicTaskPlan(
        req.body.project_goal || '',
        req.body.project_deadline || '',
        req.body.team_members || [],
        req.body.existing_tasks || [],
        req.body.current_workload || [],
      ),
    });
  }
}

async function handleAIWorkloadAlert(req, res) {
  try {
    const payload = {
      project_id: req.body.project_id || '',
      team_members: req.body.team_members || [],
      tasks: req.body.tasks || [],
    };

    const response = await getOpenAIJson({
      ...payload,
      instruction: 'Identify uneven workload among students, detect overloaded member(s), and suggest balanced task reassignments.',
    });

    const result = response || buildHeuristicWorkloadAlert(payload.tasks, payload.team_members);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI workload alert failed.',
      error: error.message,
      fallback: buildHeuristicWorkloadAlert(
        req.body.tasks || [],
        req.body.team_members || [],
      ),
    });
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    supabaseConfigured: Boolean(supabase),
    openaiConfigured: Boolean(OPENAI_API_KEY),
    message: 'Student task manager backend is running.',
  });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || '',
          },
        },
      });

      if (error) {
        if (String(error.message).toLowerCase().includes('already') || String(error.message).toLowerCase().includes('registered')) {
          return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        if (String(error.message).toLowerCase().includes('rate limit')) {
          return res.status(429).json({ message: 'Too many signup attempts. Please try again later.' });
        }
        return res.status(400).json({ message: error.message || 'Signup failed.' });
      }

      const token = data?.session?.access_token;
      const sessionUser = data?.user || null;
      const profile = token && sessionUser
        ? await upsertProfileRow(token, sessionUser, {
            name: name || sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || '',
            email: sessionUser.email,
            role: 'Student',
            settings: {
              emailNotifications: true,
              darkMode: false,
            },
          })
        : null;

      return res.status(201).json({
        user: profile || sessionUser || null,
        session: data?.session || null,
        profile: profile || null,
      });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const newUser = {
      id: generateId('user'),
      email,
      name: name || email.split('@')[0],
      role: 'Student',
      profile_info: {
        settings: {
          emailNotifications: true,
          darkMode: false,
        },
      },
    };
    state.users.push(newUser);

    const sessionToken = generateId('session');
    state.sessions[sessionToken] = newUser;
    return res.status(201).json({
      user: newUser,
      session: { access_token: sessionToken },
      profile: newUser,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Signup failed.',
      error: error.message,
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  return app._router.stack.some((layer) => layer.route && layer.route.path === '/api/auth/signup')
    ? app._router.handle(req, res)
    : res.status(404).json({ message: 'Not found.' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (String(error.message).toLowerCase().includes('invalid') || String(error.message).toLowerCase().includes('credentials')) {
          return res.status(401).json({ message: 'Invalid email or password.' });
        }
        return res.status(400).json({ message: error.message || 'Login failed.' });
      }

      const token = data?.session?.access_token;
      const user = data?.user || null;
      const profile = token && user
        ? await upsertProfileRow(token, user, {
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
            email: user.email,
            role: 'Student',
            settings: {
              emailNotifications: true,
              darkMode: false,
            },
          })
        : null;

      return res.json({
        user: profile || user || null,
        session: data?.session || null,
        profile: profile || null,
      });
    }

    const user = getUserByEmail(email);
    if (!user || password.length < 4) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const sessionToken = generateId('session');
    state.sessions[sessionToken] = user;
    return res.json({
      user,
      session: { access_token: sessionToken },
      profile: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Login failed.',
      error: error.message,
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (supabase && token) {
      const client = await getSupabaseClientWithToken(token);
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) {
          throw error;
        }
      }
    }

    if (token && state.sessions[token]) {
      delete state.sessions[token];
    }

    res.json({ success: true, message: 'Logged out.' });
  } catch (error) {
    res.status(500).json({
      message: 'Logout failed.',
      error: error.message,
    });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const authenticated = await getAuthenticatedProfile(req);
    if (!authenticated) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    res.json({ user: authenticated.user, profile: authenticated.profile, session: { access_token: getBearerToken(req) || null } });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to identify current session.',
      error: error.message,
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    res.json({ user, profile: user });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to identify current user.',
      error: error.message,
    });
  }
});

async function getProfileResponse(req) {
  const authenticated = await getAuthenticatedProfile(req);
  if (!authenticated) return null;

  const { user, profile } = authenticated;
  return {
    user,
    profile,
    settings: profile?.profile_info?.settings || {},
  };
}

app.get('/api/auth/profile', async (req, res) => {
  try {
    const profileResponse = await getProfileResponse(req);
    if (!profileResponse) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    res.json(profileResponse);
  } catch (error) {
    res.status(500).json({
      message: 'Unable to load profile.',
      error: error.message,
    });
  }
});

app.put('/api/auth/profile', async (req, res) => {
  try {
    const authenticated = await getAuthenticatedProfile(req);
    if (!authenticated) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const token = getBearerToken(req);
    const payload = req.body || {};
    const nextName = String(payload.name || authenticated.user.name || '').trim() || authenticated.user.email?.split('@')[0] || 'Student';
    const nextEmail = String(payload.email || authenticated.user.email || '').trim();
    const settings = {
      ...((authenticated.user.profile_info && authenticated.user.profile_info.settings) || {}),
      ...((payload.settings && typeof payload.settings === 'object') ? payload.settings : {}),
    };

    let profile = authenticated.profile;
    if (supabase && token) {
      profile = await upsertProfileRow(token, { id: authenticated.user.id, email: nextEmail }, {
        name: nextName,
        email: nextEmail,
        role: payload.role || authenticated.user.role || 'Student',
        profile_info: {
          ...(authenticated.user.profile_info || {}),
          ...(payload.profile_info && typeof payload.profile_info === 'object' ? payload.profile_info : {}),
          settings,
        },
      });
    } else {
      const existing = getUserByEmail(authenticated.user.email || nextEmail);
      const userIndex = state.users.findIndex((user) => user.id === authenticated.user.id);
      const updatedUser = {
        ...authenticated.user,
        name: nextName,
        email: nextEmail,
        role: payload.role || authenticated.user.role || 'Student',
        profile_info: {
          ...(authenticated.user.profile_info || {}),
          ...(payload.profile_info && typeof payload.profile_info === 'object' ? payload.profile_info : {}),
          settings,
        },
      };
      if (userIndex >= 0) {
        state.users[userIndex] = updatedUser;
      }
      if (existing && existing.id !== authenticated.user.id) {
        return res.status(409).json({ message: 'Email already in use.' });
      }
      profile = updatedUser;
    }

    res.json({ user: profile, profile, settings: profile.profile_info?.settings || {} });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to update profile.',
      error: error.message,
    });
  }
});

app.get('/api/auth/settings', async (req, res) => {
  try {
    const profileResponse = await getProfileResponse(req);
    if (!profileResponse) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    res.json({
      settings: profileResponse.settings,
      profile: profileResponse.profile,
      user: profileResponse.user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to load settings.',
      error: error.message,
    });
  }
});

app.put('/api/auth/settings', async (req, res) => {
  try {
    const authenticated = await getAuthenticatedProfile(req);
    if (!authenticated) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const token = getBearerToken(req);
    const nextSettings = {
      ...((authenticated.user.profile_info && authenticated.user.profile_info.settings) || {}),
      ...((req.body && typeof req.body === 'object') ? req.body : {}),
    };

    let profile = authenticated.profile;
    if (supabase && token) {
      profile = await upsertProfileRow(token, { id: authenticated.user.id, email: authenticated.user.email }, {
        name: authenticated.user.name,
        email: authenticated.user.email,
        role: authenticated.user.role || 'Student',
        profile_info: {
          ...(authenticated.user.profile_info || {}),
          settings: nextSettings,
        },
      });
    } else {
      const userIndex = state.users.findIndex((user) => user.id === authenticated.user.id);
      const updatedUser = {
        ...authenticated.user,
        profile_info: {
          ...(authenticated.user.profile_info || {}),
          settings: nextSettings,
        },
      };
      if (userIndex >= 0) {
        state.users[userIndex] = updatedUser;
      }
      profile = updatedUser;
    }

    res.json({
      settings: profile.profile_info?.settings || {},
      profile,
      user: profile,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to update settings.',
      error: error.message,
    });
  }
});

app.get('/api/account/profile', async (req, res) => {
  return app._router.stack.some((layer) => layer.route && layer.route.path === '/api/auth/profile')
    ? app._router.handle(req, res)
    : res.status(404).json({ message: 'Not found.' });
});

app.get('/api/account/settings', async (req, res) => {
  return app._router.stack.some((layer) => layer.route && layer.route.path === '/api/auth/settings')
    ? app._router.handle(req, res)
    : res.status(404).json({ message: 'Not found.' });
});

app.get('/api/projects', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const projects = state.projects.filter((project) => {
      const members = state.projectMembers[project.id] || [];
      return project.owner_id === user.id || members.includes(user.id);
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load projects.', error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { name, description, deadline } = req.body || {};
    if (!name || !deadline) {
      return res.status(400).json({ message: 'Project title and deadline are required.' });
    }

    const project = {
      id: generateId('project'),
      name,
      description: description || '',
      deadline,
      owner_id: user.id,
      created_at: new Date().toISOString(),
    };

    state.projects.push(project);
    state.projectMembers[project.id] = [user.id];
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create project.', error: error.message });
  }
});

app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    res.json({
      project,
      members: projectMembers(req.params.projectId),
      progress: projectProgress(req.params.projectId),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load project.', error: error.message });
  }
});

app.patch('/api/projects/:projectId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const updates = req.body || {};
    const nextProject = {
      ...project,
      name: updates.name || project.name,
      description: updates.description ?? project.description,
      deadline: updates.deadline || project.deadline,
      owner_id: project.owner_id,
      updated_at: new Date().toISOString(),
    };

    const index = state.projects.findIndex((item) => item.id === req.params.projectId);
    state.projects[index] = nextProject;
    res.json(nextProject);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update project.', error: error.message });
  }
});

app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    if (project.owner_id !== user.id) {
      return res.status(403).json({ message: 'Only the project owner can delete the project.' });
    }

    state.projects = state.projects.filter((item) => item.id !== req.params.projectId);
    delete state.projectMembers[req.params.projectId];
    state.tasks = state.tasks.filter((task) => task.project_id !== req.params.projectId);

    res.json({ success: true, message: 'Project deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete project.', error: error.message });
  }
});

app.get('/api/projects/:projectId/members', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    res.json(projectMembers(req.params.projectId));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load project members.', error: error.message });
  }
});

app.post('/api/projects/:projectId/members', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project || project.owner_id !== user.id) {
      return res.status(403).json({ message: 'Only the project owner can manage members.' });
    }

    const memberId = req.body.user_id || req.body.member_id;
    if (!memberId) {
      return res.status(400).json({ message: 'user_id is required.' });
    }

    const memberList = state.projectMembers[req.params.projectId] || [];
    if (!memberList.includes(memberId)) {
      memberList.push(memberId);
      state.projectMembers[req.params.projectId] = memberList;
    }

    res.status(201).json(projectMembers(req.params.projectId));
  } catch (error) {
    res.status(500).json({ message: 'Failed to add team member.', error: error.message });
  }
});

app.delete('/api/projects/:projectId/members/:userId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project || project.owner_id !== user.id) {
      return res.status(403).json({ message: 'Only the project owner can manage members.' });
    }

    const memberList = (state.projectMembers[req.params.projectId] || []).filter((memberId) => memberId !== req.params.userId);
    state.projectMembers[req.params.projectId] = memberList;

    res.json({ success: true, members: projectMembers(req.params.projectId) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove team member.', error: error.message });
  }
});

app.get('/api/projects/:projectId/progress', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    res.json({
      project_id: req.params.projectId,
      ...projectProgress(req.params.projectId),
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load project progress.', error: error.message });
  }
});

app.get('/api/projects/:projectId/tasks', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const tasks = await listProjectTasks(req.params.projectId, req.query);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load tasks.', error: error.message });
  }
});

app.post('/api/projects/:projectId/tasks', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const { title, description, assigned_to, priority, status, deadline } = req.body || {};
    if (!title) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    const task = {
      id: generateId('task'),
      project_id: req.params.projectId,
      title,
      description: description || '',
      assigned_to: assigned_to || user.id,
      priority: normalizePriority(priority || 'medium'),
      status: normalizeStatus(status || 'todo'),
      deadline: deadline || project.deadline,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    state.tasks.push(task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create task.', error: error.message });
  }
});

app.patch('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const taskIndex = state.tasks.findIndex(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );

    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const currentTask = state.tasks[taskIndex];
    const updates = req.body || {};
    const nextTask = {
      ...currentTask,
      title: updates.title || currentTask.title,
      description: updates.description ?? currentTask.description,
      assigned_to: updates.assigned_to || currentTask.assigned_to,
      priority: normalizePriority(updates.priority || currentTask.priority),
      status: normalizeStatus(updates.status || currentTask.status),
      deadline: updates.deadline || currentTask.deadline,
      updated_at: new Date().toISOString(),
    };

    state.tasks[taskIndex] = nextTask;
    res.json(nextTask);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update task.', error: error.message });
  }
});

app.delete('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const exists = state.tasks.some(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );
    if (!exists) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    state.tasks = state.tasks.filter(
      (task) => !(task.project_id === req.params.projectId && task.id === req.params.taskId),
    );

    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete task.', error: error.message });
  }
});

app.post('/api/projects/:projectId/tasks/:taskId/assign', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const taskIndex = state.tasks.findIndex(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    state.tasks[taskIndex].assigned_to = req.body.assigned_to || user.id;
    state.tasks[taskIndex].updated_at = new Date().toISOString();
    res.json(state.tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign task.', error: error.message });
  }
});

app.post('/api/projects/:projectId/tasks/:taskId/status', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const taskIndex = state.tasks.findIndex(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    state.tasks[taskIndex].status = normalizeStatus(req.body.status || state.tasks[taskIndex].status);
    state.tasks[taskIndex].updated_at = new Date().toISOString();
    res.json(state.tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Unable to change task status.', error: error.message });
  }
});

app.post('/api/projects/:projectId/tasks/:taskId/priority', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const taskIndex = state.tasks.findIndex(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    state.tasks[taskIndex].priority = normalizePriority(req.body.priority || state.tasks[taskIndex].priority);
    state.tasks[taskIndex].updated_at = new Date().toISOString();
    res.json(state.tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Unable to change task priority.', error: error.message });
  }
});

app.post('/api/projects/:projectId/tasks/:taskId/deadline', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const taskIndex = state.tasks.findIndex(
      (task) => task.project_id === req.params.projectId && task.id === req.params.taskId,
    );
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    state.tasks[taskIndex].deadline = req.body.deadline || state.tasks[taskIndex].deadline;
    state.tasks[taskIndex].updated_at = new Date().toISOString();
    res.json(state.tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Unable to change task deadline.', error: error.message });
  }
});

app.post('/api/projects/:projectId/ai/task-organizer', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const members = projectMembers(req.params.projectId).map((member) => ({ id: member.id, name: member.name, email: member.email }));
    const tasks = getProjectTasks(req.params.projectId);
    const workload = Object.entries(
      tasks.reduce((acc, task) => {
        if (!task.assigned_to) return acc;
        acc[task.assigned_to] = (acc[task.assigned_to] || 0) + 1;
        return acc;
      }, {}),
    ).map(([memberId, count]) => ({ member_id: memberId, active_tasks: count }));

    await handleAIOrganizer(
      {
        body: {
          project_goal: req.body.project_goal || project.description || project.name,
          project_deadline: req.body.project_deadline || project.deadline,
          team_members: req.body.team_members || members,
          existing_tasks: req.body.existing_tasks || tasks,
          current_workload: req.body.current_workload || workload,
        },
      },
      res,
    );
  } catch (error) {
    res.status(500).json({ message: 'AI task organizer unavailable.', error: error.message });
  }
});

app.post('/api/projects/:projectId/ai/workload-alert', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    const members = projectMembers(req.params.projectId).map((member) => ({ id: member.id, name: member.name, email: member.email }));
    const tasks = getProjectTasks(req.params.projectId);

    await handleAIWorkloadAlert(
      {
        body: {
          project_id: req.params.projectId,
          team_members: req.body.team_members || members,
          tasks: req.body.tasks || tasks,
        },
      },
      res,
    );
  } catch (error) {
    res.status(500).json({ message: 'AI workload alert unavailable.', error: error.message });
  }
});

app.post('/api/ai/priority', (req, res) => {
  const description = req.body?.description || '';
  const suggestion = {
    suggestedPriority: ['urgent', 'high', 'medium', 'low'][
      /deadline|urgent|demo|final|launch|critical|submission|bug/.test(description.toLowerCase())
        ? 0
        : /presentation|report|research|review|plan|feedback/.test(description.toLowerCase())
          ? 1
          : /draft|outline|brainstorm|documentation/.test(description.toLowerCase())
            ? 2
            : 3
    ],
    confidence: 'high',
    message: 'This task priority was inferred from the work description.',
  };

  res.json(suggestion);
});

app.get('/api/projects/:projectId/realtime', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const project = await ensureProjectAccess(req.params.projectId, user.id);
    if (!project) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (eventName, payload) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent('project-update', {
      type: 'connected',
      project_id: req.params.projectId,
      timestamp: new Date().toISOString(),
      progress: projectProgress(req.params.projectId),
    });

    if (supabase) {
      const channel = supabase.channel(`project-${req.params.projectId}`);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${req.params.projectId}` },
        (payload) => {
          sendEvent('project-update', { type: 'task-change', payload });
        },
      );

      channel.subscribe((status) => {
        sendEvent('project-update', { type: 'subscription-status', status });
      });

      req.on('close', () => {
        supabase.removeChannel(channel);
      });
    } else {
      const interval = setInterval(() => {
        sendEvent('project-update', {
          type: 'heartbeat',
          project_id: req.params.projectId,
          timestamp: new Date().toISOString(),
          progress: projectProgress(req.params.projectId),
        });
      }, 15000);

      req.on('close', () => {
        clearInterval(interval);
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Realtime connection failed.', error: error.message });
  }
});

app.use(express.static(path.join(rootDir, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found.' });
  }
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Student task manager running on http://localhost:${PORT}`);
  console.log(
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? `Connected to Supabase: ${SUPABASE_URL}`
      : 'Supabase not configured. Using local fallback data.'
  );
  console.log(
    OPENAI_API_KEY
      ? 'OpenAI integration ready via OPENAI_API_KEY.'
      : 'OpenAI key not configured. Heuristic AI fallback is active.'
  );
});
