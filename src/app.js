import { workspaceApi } from "./api.js";

const state = {
  page: "Dashboard",
  data: null,
  activeProjectId: null,
  filters: { member: "", priority: "", status: "", due: "", sort: "deadline" },
  suggestions: [],
  alertDismissed: false,
  sidebarOpen: false,
  error: "",
};

const icons = {
  Dashboard: "⌂",
  Projects: "▦",
  "My tasks": "✓",
  "AI Organizer": "✧",
  Team: "♧",
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const byId = (items, id) => items.find((item) => item.id === id);
const currentUser = () => state.data.currentUser;
const projectTasks = (projectId) => state.data.tasks.filter((task) => task.projectId === projectId);
const activeTasks = (tasks) => tasks.filter((task) => task.status !== "Done");

function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "No deadline";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "No deadline" : date.toLocaleDateString("en-US", options);
}

function daysUntil(value) {
  if (!value) return Infinity;
  const target = new Date(`${value}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function avatar(member, extra = "") {
  if (!member) return "";
  return `<span class="avatar ${escapeHtml(member.color || "violet")} ${extra}" title="${escapeHtml(member.name)}">${escapeHtml(member.initials || member.name.split(" ").map((part) => part[0]).join("").slice(0, 2))}</span>`;
}

function priorityTag(priority) {
  return `<span class="priority ${String(priority).toLowerCase()}">${escapeHtml(priority)}</span>`;
}

function statusTag(status) {
  const className = status === "Done" ? "done" : status === "In Progress" ? "progress" : "";
  return `<span class="status-pill ${className}">${escapeHtml(status)}</span>`;
}

function progressFor(tasks) {
  return tasks.length ? Math.round((tasks.filter((task) => task.status === "Done").length / tasks.length) * 100) : 0;
}

function getWorkloadAlert() {
  const workloads = state.data.members.map((member) => ({
    member,
    count: activeTasks(state.data.tasks).filter((task) => task.assigneeId === member.id).length,
  })).sort((a, b) => b.count - a.count);
  if (!workloads[0] || workloads[0].count < 5 || workloads[0].count < (workloads[1]?.count || 0) * 2) return null;
  return {
    memberId: workloads[0].member.id,
    activeTasks: workloads[0].count,
    suggestedMoves: Math.max(1, Math.floor((workloads[0].count - (workloads[1]?.count || 0)) / 2)),
  };
}

function projectCard(project) {
  const tasks = projectTasks(project.id);
  const members = project.memberIds.map((id) => byId(state.data.members, id)).filter(Boolean);
  const progress = progressFor(tasks);
  return `<article class="project-card" data-open-project="${escapeHtml(project.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(project.name)}">
    <div class="project-card-head"><span class="project-mark ${escapeHtml(project.color)}">${escapeHtml(project.initials)}</span><button class="btn-ghost" data-project-menu="${escapeHtml(project.id)}" aria-label="Project options">···</button></div>
    <h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p>
    <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    <div class="project-card-bottom"><span class="project-due">Due ${formatDate(project.deadline)}</span><span class="member-avatars">${members.map((member) => avatar(member, "tiny")).join("")}</span></div>
  </article>`;
}

function miniTask(task) {
  const member = byId(state.data.members, task.assigneeId);
  const project = byId(state.data.projects, task.projectId);
  const days = daysUntil(task.dueDate);
  const dueClass = days < 0 && task.status !== "Done" ? "overdue" : "";
  return `<div class="task-row">
    <button class="task-check ${task.status === "Done" ? "done" : ""}" data-toggle-task="${escapeHtml(task.id)}" aria-label="${task.status === "Done" ? "Mark incomplete" : "Mark complete"}">${task.status === "Done" ? "✓" : ""}</button>
    <div class="task-main"><div class="task-name ${task.status === "Done" ? "completed" : ""}">${escapeHtml(task.title)}</div><div class="task-sub">${escapeHtml(project?.name || "Personal task")} · ${escapeHtml(member?.name || "Unassigned")}</div></div>
    ${priorityTag(task.priority)}<span class="due-date ${dueClass}">${formatDate(task.dueDate)}</span>
  </div>`;
}

function topbar() {
  return `<header class="topbar">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="icon-button mobile-menu" data-action="menu" aria-label="Open navigation">☰</button>
      <div class="breadcrumbs">Workspace <span style="padding:0 7px;color:#c5ccd5">/</span> <strong>${escapeHtml(state.page === "Project" ? "Project overview" : state.page)}</strong></div>
    </div>
    <div class="top-actions"><button class="icon-button" data-action="notifications" aria-label="Notifications">♧<span class="notification-dot"></span></button>${avatar(currentUser())}</div>
  </header>`;
}

function sidebar() {
  const activeCount = activeTasks(state.data.tasks).length;
  return `<aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
    <div class="brand"><span class="brand-mark">◒</span> orbit</div>
    <div class="nav-label">WORKSPACE</div>
    <nav class="nav-links" aria-label="Main navigation">
      ${["Dashboard", "Projects", "My tasks", "AI Organizer", "Team"].map((item) => `<button class="nav-item ${state.page === item || (item === "Projects" && state.page === "Project") ? "active" : ""}" data-page="${item}"><span class="nav-icon">${icons[item]}</span>${item}${item === "My tasks" ? `<span class="nav-badge">${activeCount}</span>` : ""}</button>`).join("")}
    </nav>
    <div class="sidebar-bottom">
      <div class="upgrade-card"><span style="color:#a7d1bb">✦</span><strong>A little help goes a long way</strong><p>Let AI turn your project goals into a clear team plan.</p><button class="upgrade-link" data-page="AI Organizer">Try AI organizer&nbsp; →</button></div>
      <div class="user-mini">${avatar(currentUser())}<div class="user-mini-info"><strong>${escapeHtml(currentUser().name)}</strong><span>Student workspace</span></div><button class="btn-ghost" aria-label="Account options">···</button></div>
    </div>
  </aside>`;
}

function pageHeading(title, subtitle, actionLabel, actionName) {
  return `<div class="page-heading"><div><div class="eyebrow">${state.page === "Dashboard" ? "MONDAY, YOUR WAY" : "YOUR WORKSPACE"}</div><h1>${title}</h1><p>${subtitle}</p></div>${actionLabel ? `<button class="btn btn-primary" data-action="${actionName}">＋ ${actionLabel}</button>` : ""}</div>`;
}

function dashboard() {
  const tasks = state.data.tasks;
  const done = tasks.filter((task) => task.status === "Done").length;
  const ongoing = tasks.filter((task) => task.status === "In Progress").length;
  const pending = tasks.filter((task) => task.status === "To Do").length;
  const upcoming = tasks.filter((task) => task.status !== "Done" && daysUntil(task.dueDate) >= 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completion = progressFor(tasks);
  const nextDeadline = [...state.data.projects].sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const alert = getWorkloadAlert();
  const alertMember = alert && byId(state.data.members, alert.memberId);
  return `${pageHeading(`Good morning, ${escapeHtml(currentUser().name.split(" ")[0])} 👋`, "Here’s what’s happening with your projects today.", "New task", "new-task")}
    <section class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">A FRESH START</div><h2>Small steps add up to big things.</h2><p>You’ve got this. Let’s make today count.</p></div><div class="banner-date">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div></section>
    <section class="stats-grid" aria-label="Task summary">
      <article class="stat-card"><div class="stat-head">Total tasks <span class="stat-icon green">▤</span></div><div class="stat-value">${tasks.length}<span class="stat-note">across all projects</span></div></article>
      <article class="stat-card"><div class="stat-head">In progress <span class="stat-icon blue">◷</span></div><div class="stat-value">${ongoing}<span class="stat-note">keep the momentum</span></div></article>
      <article class="stat-card"><div class="stat-head">To do <span class="stat-icon orange">◌</span></div><div class="stat-value">${pending}<span class="stat-note">ready when you are</span></div></article>
      <article class="stat-card"><div class="stat-head">Completed <span class="stat-icon purple">✓</span></div><div class="stat-value">${done}<span class="stat-note">look at you go</span></div></article>
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Coming up</h2><p>Your next tasks, all in one place</p></div><button class="text-link" data-page="My tasks">View all →</button></div>
        <div class="task-list">${upcoming.length ? upcoming.slice(0, 5).map(miniTask).join("") : `<div class="empty-state"><div class="empty-icon">✓</div><h3>All caught up</h3><p>You have no upcoming tasks. Take a breather or add something new.</p><button class="btn btn-secondary btn-sm" data-action="new-task">Create a task</button></div>`}</div>
      </section>
      <section class="panel">
        <div class="panel-heading"><div><h2>Overall progress</h2><p>A little progress every day</p></div><span class="stat-icon green">↗</span></div>
        <div class="progress-overview"><div class="progress-number"><strong>${completion}%</strong><span>of all tasks complete</span></div><div class="progress-track"><div class="progress-fill" style="width:${completion}%"></div></div><div class="progress-caption"><span>${done} completed</span><span>${tasks.length} total</span></div>
          ${state.data.projects.slice(0, 2).map((project) => { const items = projectTasks(project.id); const progress = progressFor(items); return `<div class="project-progress-row"><span class="project-mark ${escapeHtml(project.color)}" style="width:28px;height:28px;font-size:8px">${escapeHtml(project.initials)}</span><div class="project-progress-meta"><strong>${escapeHtml(project.name)}</strong><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div><span>${progress}%</span></div>`; }).join("")}
        </div>
        ${alert && !state.alertDismissed && alertMember ? `<div class="workload-alert"><span class="alert-icon">⚠</span><div class="alert-content"><strong>Workload alert</strong><p>${escapeHtml(alertMember.name)} currently has ${alert.activeTasks} active tasks. AI suggests moving ${alert.suggestedMoves} to other members.</p><div class="alert-actions"><button data-action="review-workload">Review suggestion</button><button data-action="dismiss-alert">Dismiss</button></div></div></div>` : ""}
      </section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Your projects</h2><p>Good work happens together</p></div><button class="text-link" data-page="Projects">All projects →</button></div>
        <div class="project-cards">${state.data.projects.length ? state.data.projects.slice(0, 2).map(projectCard).join("") : emptyProjects()}</div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Team workload</h2><p>Active tasks by member</p></div><button class="text-link" data-page="Team">Team →</button></div>
        <div class="member-list">${state.data.members.slice(0, 4).map((member) => { const count = activeTasks(tasks).filter((task) => task.assigneeId === member.id).length; const ratio = Math.min(100, count * 18); return `<div class="member-row">${avatar(member, "small")}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${count} active task${count === 1 ? "" : "s"}</span></div><div class="member-work"><div class="progress-track"><div class="progress-fill" style="width:${ratio}%"></div></div><span>${count} tasks</span></div></div>`; }).join("")}</div>
      </section>
    </div>`;
}

function emptyProjects() {
  return `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">▦</div><h3>Your next big idea starts here</h3><p>Create a project to bring your team, tasks and deadlines together.</p><button class="btn btn-primary btn-sm" data-action="new-project">Create a project</button></div>`;
}

function projectPage() {
  return `${pageHeading("Projects", "A home for every idea, assignment and team.", "New project", "new-project")}
    ${state.data.projects.length ? `<div class="project-cards">${state.data.projects.map(projectCard).join("")}<button class="project-card" data-action="new-project" style="border-style:dashed;min-height:150px;background:transparent"><div class="empty-icon" style="margin:8px auto 10px">＋</div><h3 style="text-align:center">Start a new project</h3><p style="text-align:center">Bring your next idea to life</p></button></div>` : `<section class="panel">${emptyProjects()}</section>`}`;
}

function filteredTasks(projectId = null) {
  let tasks = projectId ? projectTasks(projectId) : [...state.data.tasks];
  const { member, priority, status, due, sort } = state.filters;
  if (member) tasks = tasks.filter((task) => task.assigneeId === member);
  if (priority) tasks = tasks.filter((task) => task.priority === priority);
  if (status) tasks = tasks.filter((task) => task.status === status);
  if (due === "overdue") tasks = tasks.filter((task) => task.status !== "Done" && daysUntil(task.dueDate) < 0);
  if (due === "week") tasks = tasks.filter((task) => task.status !== "Done" && daysUntil(task.dueDate) >= 0 && daysUntil(task.dueDate) <= 7);
  if (due === "no-date") tasks = tasks.filter((task) => !task.dueDate);
  tasks.sort((a, b) => sort === "priority"
    ? ["High", "Medium", "Low"].indexOf(a.priority) - ["High", "Medium", "Low"].indexOf(b.priority)
    : sort === "status"
      ? ["To Do", "In Progress", "Done"].indexOf(a.status) - ["To Do", "In Progress", "Done"].indexOf(b.status)
      : (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  return tasks;
}

function taskFilters(projectId = null) {
  const tasks = filteredTasks(projectId);
  return `<div class="toolbar"><div class="filters">
    <select class="filter-select" data-filter="member" aria-label="Filter by team member"><option value="">All team members</option>${state.data.members.map((member) => `<option value="${escapeHtml(member.id)}" ${state.filters.member === member.id ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}</select>
    <select class="filter-select" data-filter="priority" aria-label="Filter by priority"><option value="">All priorities</option>${["High", "Medium", "Low"].map((value) => `<option ${state.filters.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select>
    <select class="filter-select" data-filter="status" aria-label="Filter by status"><option value="">All statuses</option>${["To Do", "In Progress", "Done"].map((value) => `<option ${state.filters.status === value ? "selected" : ""}>${value}</option>`).join("")}</select>
    <select class="filter-select" data-filter="due" aria-label="Filter by deadline"><option value="">Any deadline</option><option value="overdue" ${state.filters.due === "overdue" ? "selected" : ""}>Overdue</option><option value="week" ${state.filters.due === "week" ? "selected" : ""}>Next 7 days</option><option value="no-date" ${state.filters.due === "no-date" ? "selected" : ""}>No deadline</option></select>
    <select class="filter-select" data-filter="sort" aria-label="Sort tasks"><option value="deadline" ${state.filters.sort === "deadline" ? "selected" : ""}>Sort: Deadline</option><option value="priority" ${state.filters.sort === "priority" ? "selected" : ""}>Sort: Priority</option><option value="status" ${state.filters.sort === "status" ? "selected" : ""}>Sort: Status</option></select>
  </div><span style="color:#98a3b0;font-size:9px">${tasks.length} tasks</span></div>`;
}

function taskTable(tasks) {
  if (!tasks.length) return `<div class="empty-state"><div class="empty-icon">✓</div><h3>No tasks match just yet</h3><p>Try changing your filters, or create a task to get started.</p><button class="btn btn-primary btn-sm" data-action="new-task">Create a task</button></div>`;
  return `<div class="table-wrap"><table class="task-table"><thead><tr><th>Task</th><th>Project</th><th>Assignee</th><th>Priority</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>${tasks.map((task) => {
    const member = byId(state.data.members, task.assigneeId);
    const project = byId(state.data.projects, task.projectId);
    const days = daysUntil(task.dueDate);
    return `<tr><td><div class="task-name ${task.status === "Done" ? "completed" : ""}">${escapeHtml(task.title)}</div><div class="task-sub">${escapeHtml(task.description || "")}</div></td>
      <td>${escapeHtml(project?.name || "Personal")}</td><td><span class="assignee-cell">${member ? `${avatar(member, "tiny")}${escapeHtml(member.name.split(" ")[0])}` : "Unassigned"}</span></td>
      <td>${priorityTag(task.priority)}</td><td><span class="due-date ${days < 0 && task.status !== "Done" ? "overdue" : ""}">${formatDate(task.dueDate)}</span></td>
      <td><select class="status-select ${task.status === "Done" ? "done" : task.status === "In Progress" ? "progress" : ""}" data-status-task="${escapeHtml(task.id)}" aria-label="Change status for ${escapeHtml(task.title)}">${["To Do", "In Progress", "Done"].map((option) => `<option ${task.status === option ? "selected" : ""}>${option}</option>`).join("")}</select></td>
      <td><div class="row-actions"><button data-edit-task="${escapeHtml(task.id)}" aria-label="Edit task">✎</button><button data-delete-task="${escapeHtml(task.id)}" aria-label="Delete task">×</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function taskView(project = null) {
  const title = project ? escapeHtml(project.name) : "My tasks";
  const subtitle = project ? escapeHtml(project.description) : "Keep track of the little things that move you forward.";
  return `${pageHeading(title, subtitle, "New task", "new-task")}
    ${project ? projectHero(project) : ""}
    <section class="panel" style="padding:15px 16px">
      ${taskFilters(project?.id)}${taskTable(filteredTasks(project?.id))}
    </section>`;
}

function projectHero(project) {
  const members = project.memberIds.map((id) => byId(state.data.members, id)).filter(Boolean);
  const tasks = projectTasks(project.id);
  return `<section class="panel project-hero"><span class="project-mark ${escapeHtml(project.color)}">${escapeHtml(project.initials)}</span><div class="project-hero-copy"><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.description)}</p><div class="project-facts"><span>◷ &nbsp;Due ${formatDate(project.deadline, { month: "long", day: "numeric", year: "numeric" })}</span><span>✓ &nbsp;${progressFor(tasks)}% complete</span><span class="project-members">${members.slice(0, 4).map((member) => avatar(member, "tiny")).join("")}${members.length} members</span></div></div><button class="btn btn-secondary btn-sm" data-action="manage-project">Edit project</button></section>`;
}

function projectDetail(project) {
  const tasks = projectTasks(project.id);
  const completed = tasks.filter((task) => task.status === "Done").length;
  const inProgress = tasks.filter((task) => task.status === "In Progress").length;
  const pending = tasks.filter((task) => task.status === "To Do").length;
  const progress = progressFor(tasks);
  const members = project.memberIds.map((id) => byId(state.data.members, id)).filter(Boolean);
  return `${pageHeading("Project overview", "Your people, progress and next steps.", "New task", "new-task")}${projectHero(project)}
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Team progress</h2><p>Every step gets you closer</p></div><span class="status-pill done">${progress}% complete</span></div>
        <div class="progress-number"><strong>${progress}%</strong><span>of project tasks completed</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:17px 0 0;gap:8px">
          <div class="stat-card" style="min-height:72px;padding:11px"><div class="stat-head">Completed</div><div class="stat-value" style="font-size:18px">${completed}</div></div>
          <div class="stat-card" style="min-height:72px;padding:11px"><div class="stat-head">In progress</div><div class="stat-value" style="font-size:18px">${inProgress}</div></div>
          <div class="stat-card" style="min-height:72px;padding:11px"><div class="stat-head">To do</div><div class="stat-value" style="font-size:18px">${pending}</div></div>
        </div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Project team</h2><p>${members.length} people working together</p></div><button class="text-link" data-action="add-member">＋ Add member</button></div>
        <div class="member-list">${members.length ? members.map((member) => { const assigned = activeTasks(tasks).filter((task) => task.assigneeId === member.id).length; return `<div class="member-row">${avatar(member, "small")}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "Team member")}</span></div><div class="member-work"><span style="text-align:right;font-size:9px">${assigned} active</span></div></div>`; }).join("") : `<div class="empty-state"><h3>No members yet</h3><button class="btn btn-secondary btn-sm" data-action="add-member">Add a teammate</button></div>`}</div>
      </section>
    </div>
    <section class="panel"><div class="panel-heading"><div><h2>Assigned tasks</h2><p>See what everyone is working on</p></div><button class="text-link" data-page="My tasks">Manage tasks →</button></div>${taskFilters(project.id)}${taskTable(filteredTasks(project.id))}</section>`;
}

function teamPage() {
  const project = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
  const members = project ? project.memberIds.map((id) => byId(state.data.members, id)).filter(Boolean) : state.data.members;
  return `${pageHeading("Your team", "Meet your collaborators and see how the work is shared.", "Add member", "add-member")}
    <section class="panel" style="margin-bottom:16px"><div class="panel-heading"><div><h2>${project ? escapeHtml(project.name) : "Your workspace"}</h2><p>${members.length} members · ${project ? "project team" : "all collaborators"}</p></div>${state.data.projects.length > 1 ? `<select class="filter-select" data-team-project aria-label="Choose project team">${state.data.projects.map((item) => `<option value="${item.id}" ${item.id === project?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>` : ""}</div>
      ${members.length ? `<div class="team-grid">${members.map((member) => {
        const assigned = state.data.tasks.filter((task) => task.assigneeId === member.id && (!project || task.projectId === project.id));
        const done = assigned.filter((task) => task.status === "Done").length;
        const active = assigned.length - done;
        const ratio = assigned.length ? Math.round(done / assigned.length * 100) : 0;
        return `<article class="team-card"><div class="team-card-top">${avatar(member)}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "Student collaborator")}</span></div>${member.id !== currentUser().id ? `<button data-remove-member="${escapeHtml(member.id)}" aria-label="Remove ${escapeHtml(member.name)}">×</button>` : ""}</div><div class="team-card-stats"><span><strong>${assigned.length}</strong> assigned</span><span><strong>${active}</strong> active</span><span><strong>${done}</strong> done</span></div><div class="progress-track" style="margin-top:10px;height:5px"><div class="progress-fill" style="width:${ratio}%"></div></div><div class="project-due" style="margin-top:9px">${ratio}% of assigned tasks complete</div></article>`;
      }).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">♧</div><h3>Your team starts with a hello</h3><p>Add teammates to share tasks, ideas and progress.</p><button class="btn btn-primary btn-sm" data-action="add-member">Add a member</button></div>`}
    </section>
    <section class="panel"><div class="panel-heading"><div><h2>Workload distribution</h2><p>Active tasks across your project team</p></div></div><div class="member-list">${members.map((member) => { const count = activeTasks(state.data.tasks.filter((task) => !project || task.projectId === project.id)).filter((task) => task.assigneeId === member.id).length; const max = Math.max(1, ...members.map((person) => activeTasks(state.data.tasks.filter((task) => !project || task.projectId === project.id)).filter((task) => task.assigneeId === person.id).length)); return `<div class="member-row">${avatar(member, "small")}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${count} active task${count === 1 ? "" : "s"}</span></div><div style="width:min(40%,250px)"><div class="progress-track"><div class="progress-fill" style="width:${Math.round(count/max*100)}%"></div></div></div></div>`; }).join("")}</div></section>`;
}

const suggestionTemplates = [
  { title: "Gather background research", description: "Collect the key sources and context the team needs to get started.", priority: "High", offset: 2, reason: "A strong foundation helps the whole team move faster." },
  { title: "Outline the project approach", description: "Turn the goal into a clear plan with milestones and decisions.", priority: "Medium", offset: 5, reason: "Builds on early research and creates a shared direction." },
  { title: "Prepare a first team review", description: "Bring early findings together and gather feedback from the team.", priority: "Low", offset: 9, reason: "A lightweight checkpoint keeps everyone aligned." },
];

function aiOrganizer() {
  return `${pageHeading("AI task organizer", "A thoughtful first draft for your next team project.", "", "")}
    <div class="ai-layout">
      <div class="ai-info"><section class="ai-intro"><span class="ai-spark">✧</span><h2>Plan together, with a little help.</h2><p>Share your project goal and team. Orbit will help shape a draft task plan for you to review. You stay in control of every suggestion.</p></section>
        <section class="panel ai-form"><div class="panel-heading"><div><h2>Project details</h2><p>The more context, the more useful the plan.</p></div></div>
          <form id="ai-form">
            <div class="field"><label for="ai-goal">What are you working on?</label><textarea class="form-control" id="ai-goal" required placeholder="e.g. Research ways to make our campus more sustainable">${escapeHtml(state.aiGoal || "")}</textarea></div>
            <div class="field"><label for="ai-deadline">Project deadline</label><input class="form-control" id="ai-deadline" type="date" required value="${escapeHtml(state.aiDeadline || "")}" /></div>
            <div class="field"><label>Who’s on your team?</label><div class="member-check-list">${state.data.members.map((member, index) => `<label class="member-chip">${avatar(member, "tiny")}<input type="checkbox" name="ai-member" value="${escapeHtml(member.id)}" ${index < 3 ? "checked" : ""}/> ${escapeHtml(member.name.split(" ")[0])}</label>`).join("")}</div></div>
            <div class="field"><label for="ai-context">Existing workload or notes <span style="font-weight:400;color:#99a4b1">(optional)</span></label><textarea class="form-control" id="ai-context" placeholder="Share anything the plan should take into account">${escapeHtml(state.aiContext || "")}</textarea><small>Your notes are only used to prepare this draft.</small></div>
            <button class="btn btn-primary" type="submit" style="width:100%">✧ Build my task plan</button>
          </form>
        </section>
      </div>
      <section class="panel"><div class="panel-heading"><div><h2>Suggested plan</h2><p>${state.suggestions.length ? "Review, edit or accept each task before adding it." : "Your suggestions will appear here for you to review."}</p></div>${state.suggestions.some((item) => !item.accepted && !item.rejected) ? `<button class="text-link" data-action="accept-all">Accept all</button>` : ""}</div>
        <div id="suggestions-area">${state.isGenerating ? `<div class="ai-loading"><span class="spinner"></span> Thinking through your project plan…</div>` : state.suggestions.length ? state.suggestions.map((suggestion) => suggestionCard(suggestion)).join("") : `<div class="empty-state" style="padding-top:60px"><div class="empty-icon">✧</div><h3>A clear plan is a great start</h3><p>Tell us about your project and we’ll draft a few suggestions for your team to shape.</p></div>`}</div>
      </section>
    </div>`;
}

function suggestionCard(item) {
  const member = byId(state.data.members, item.assigneeId);
  const actionText = item.accepted ? (item.taskId ? "Recommendation applied" : "Added to tasks") : item.rejected ? "Suggestion dismissed" : "";
  return `<article class="suggestion-card"><div class="suggestion-top"><span class="stat-icon purple">✧</span><div class="suggestion-content"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)} ${item.reason ? `<span style="color:#839386"> ${escapeHtml(item.reason)}</span>` : ""}</p><div class="suggestion-meta">${priorityTag(item.priority)}<span class="due-date">Due ${formatDate(item.dueDate)}</span>${member ? `<span class="suggestion-member">${avatar(member, "tiny")}${escapeHtml(member.name)}</span>` : ""}</div></div></div>
    ${actionText ? `<div style="text-align:right;color:${item.accepted ? "#638a71" : "#9ba5b2"};font-size:9px;margin-top:10px">${actionText}</div>` : `<div class="suggestion-actions"><button class="btn btn-secondary btn-sm" data-suggestion-edit="${escapeHtml(item.id)}">Edit</button><button class="btn btn-secondary btn-sm" data-suggestion-reject="${escapeHtml(item.id)}">Reject</button><button class="btn btn-primary btn-sm" data-suggestion-accept="${escapeHtml(item.id)}">Accept</button></div>`}
  </article>`;
}

function render() {
  const root = document.querySelector("#app");
  if (state.error) {
    root.innerHTML = `<main class="main" style="max-width:650px;margin:12vh auto"><div class="error-state"><strong>Your workspace couldn’t be loaded.</strong><p style="margin:7px 0 12px">${escapeHtml(state.error)}</p><button class="btn btn-secondary btn-sm" data-action="retry">Try again</button></div></main>`;
    return;
  }
  if (!state.data) {
    root.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;color:#819185;font-size:12px"><span class="spinner" style="margin-right:8px"></span> Loading your workspace…</div>`;
    return;
  }
  let content;
  if (state.page === "Dashboard") content = dashboard();
  else if (state.page === "Projects") content = projectPage();
  else if (state.page === "My tasks") content = taskView();
  else if (state.page === "Project") {
    const project = byId(state.data.projects, state.activeProjectId);
    content = project ? projectDetail(project) : projectPage();
  } else if (state.page === "Team") content = teamPage();
  else content = aiOrganizer();
  root.innerHTML = `<div class="shell">${sidebar()}<main class="main">${topbar()}${content}</main></div>`;
}

function setPage(page) {
  state.page = page;
  state.sidebarOpen = false;
  if (page === "Projects" || page === "Project") state.filters = { member: "", priority: "", status: "", due: "", sort: "deadline" };
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function persist(message) {
  try {
    await workspaceApi.saveWorkspace(state.data);
    render();
    if (message) toast(message);
  } catch (error) {
    toast(error.message, true);
  }
}

function toast(message, isError = false) {
  const root = document.querySelector("#toast-root");
  root.innerHTML = `<div class="toast ${isError ? "error" : ""}" role="status">${escapeHtml(message)}</div>`;
  window.setTimeout(() => { root.innerHTML = ""; }, 3000);
}

function memberOptions(selected = "") {
  return `<option value="">Unassigned</option>${state.data.members.map((member) => `<option value="${escapeHtml(member.id)}" ${selected === member.id ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}`;
}

function projectOptions(selected = "") {
  return state.data.projects.map((project) => `<option value="${escapeHtml(project.id)}" ${selected === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("");
}

function openModal(title, subtitle, contents, onSubmit) {
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="modal-close" data-close-modal aria-label="Close">×</button></div><form id="modal-form">${contents}<div class="modal-footer"><button type="button" class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></div></form></section></div>`;
  root.querySelector("[data-close-modal]").focus();
  root.querySelector("#modal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await onSubmit(form);
    if (result !== false) root.innerHTML = "";
  });
  root.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => { root.innerHTML = ""; }));
  root.querySelector("[data-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) root.innerHTML = "";
  });
  root.querySelector(".modal").addEventListener("keydown", (event) => {
    if (event.key === "Escape") root.innerHTML = "";
  });
}

function taskModal(task = null, initialProjectId = "") {
  const editing = Boolean(task);
  openModal(editing ? "Edit task" : "Create a task", "Make it clear, manageable and yours.", `
    <div class="form-grid">
      <div class="field full"><label for="task-title">Task name</label><input class="form-control" id="task-title" name="title" required maxlength="100" placeholder="e.g. Draft the project outline" value="${escapeHtml(task?.title || "")}"/></div>
      <div class="field full"><label for="task-description">Description</label><textarea class="form-control" id="task-description" name="description" placeholder="What needs to be done?">${escapeHtml(task?.description || "")}</textarea></div>
      <div class="field"><label for="task-project">Project</label><select class="form-control" id="task-project" name="projectId"><option value="">No project</option>${projectOptions(task?.projectId || initialProjectId)}</select></div>
      <div class="field"><label for="task-assignee">Assign to</label><select class="form-control" id="task-assignee" name="assigneeId">${memberOptions(task?.assigneeId || currentUser().id)}</select></div>
      <div class="field"><label for="task-priority">Priority</label><select class="form-control" id="task-priority" name="priority">${["Low", "Medium", "High"].map((value) => `<option ${task?.priority === value || (!task && value === "Medium") ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="field"><label for="task-status">Status</label><select class="form-control" id="task-status" name="status">${["To Do", "In Progress", "Done"].map((value) => `<option ${task?.status === value || (!task && value === "To Do") ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="field full"><label for="task-deadline">Deadline</label><input class="form-control" id="task-deadline" name="dueDate" type="date" value="${escapeHtml(task?.dueDate || "")}"/></div>
    </div>`, async (form) => {
    const projectId = String(form.get("projectId") || "");
    const selectedProject = byId(state.data.projects, projectId);
    const next = {
      id: task?.id || `t${Date.now()}`,
      title: String(form.get("title")).trim(),
      description: String(form.get("description") || "").trim(),
      projectId,
      assigneeId: String(form.get("assigneeId") || ""),
      priority: String(form.get("priority")),
      status: String(form.get("status")),
      dueDate: String(form.get("dueDate") || selectedProject?.deadline || ""),
    };
    if (task) state.data.tasks = state.data.tasks.map((item) => item.id === task.id ? next : item);
    else state.data.tasks.unshift(next);
    if (state.page === "Project" && projectId !== state.activeProjectId) setPage(projectId ? "My tasks" : "Dashboard");
    await persist(editing ? "Task updated" : "Task created");
  });
}

function projectModal(project = null) {
  const selected = project?.memberIds || [currentUser().id];
  openModal(project ? "Edit project" : "Create a project", "Give your team a place to make progress together.", `
    <div class="form-grid">
      <div class="field full"><label for="project-name">Project name</label><input class="form-control" id="project-name" name="name" required maxlength="70" placeholder="e.g. Campus sustainability" value="${escapeHtml(project?.name || "")}"/></div>
      <div class="field full"><label for="project-description">Description</label><textarea class="form-control" id="project-description" name="description" placeholder="What are you hoping to achieve?">${escapeHtml(project?.description || "")}</textarea></div>
      <div class="field full"><label for="project-deadline">Project deadline</label><input class="form-control" id="project-deadline" name="deadline" type="date" value="${escapeHtml(project?.deadline || "")}"/></div>
      <div class="field full"><label>Team members</label><div class="member-check-list">${state.data.members.map((member) => `<label class="member-chip">${avatar(member, "tiny")}<input type="checkbox" name="project-member" value="${escapeHtml(member.id)}" ${selected.includes(member.id) ? "checked" : ""}/> ${escapeHtml(member.name)}</label>`).join("")}</div></div>
    </div>`, async (form) => {
    const name = String(form.get("name")).trim();
    const memberIds = form.getAll("project-member").map(String);
    if (!memberIds.includes(currentUser().id)) memberIds.unshift(currentUser().id);
    const next = { id: project?.id || `p${Date.now()}`, name, description: String(form.get("description") || "").trim(), deadline: String(form.get("deadline") || ""), memberIds, color: project?.color || "green", initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() };
    if (project) state.data.projects = state.data.projects.map((item) => item.id === project.id ? next : item);
    else state.data.projects.push(next);
    state.activeProjectId = next.id;
    await persist(project ? "Project updated" : "Project created");
  });
}

function memberModal() {
  const activeProject = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
  const available = activeProject ? state.data.members.filter((member) => !activeProject.memberIds.includes(member.id)) : [];
  openModal(available.length ? "Add a team member" : "Invite someone new", "Grow your team and share the work.", `
    ${available.length ? `<div class="field"><label for="existing-member">Add someone from your workspace</label><select class="form-control" name="memberId" id="existing-member"><option value="">Choose a teammate</option>${available.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join("")}</select></div>` : ""}
    <div class="field"><label for="member-name">Or add a new collaborator</label><input class="form-control" id="member-name" name="name" ${available.length ? "" : "required"} placeholder="Their name"/></div>
    <div class="field"><label for="member-email">Email <span style="font-weight:400;color:#99a4b1">(optional)</span></label><input class="form-control" id="member-email" name="email" type="email" placeholder="name@campus.edu"/></div>`, async (form) => {
    const project = byId(state.data.projects, state.activeProjectId);
    const memberId = String(form.get("memberId") || "");
    if (memberId) {
      if (project && !project.memberIds.includes(memberId)) project.memberIds.push(memberId);
    } else {
      const name = String(form.get("name") || "").trim();
      if (!name) {
        toast("Enter a name or choose a teammate", true);
        return false;
      }
      const newMember = { id: `u${Date.now()}`, name, email: String(form.get("email") || ""), initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: ["peach", "blue", "mint", "violet"][state.data.members.length % 4] };
      state.data.members.push(newMember);
      if (project) project.memberIds.push(newMember.id);
    }
    await persist("Team updated");
  });
}

function editSuggestion(item) {
  openModal("Edit suggestion", "Make this plan work for your team.", `
    <div class="form-grid">
      <div class="field full"><label for="suggestion-title">Task name</label><input class="form-control" id="suggestion-title" name="title" required value="${escapeHtml(item.title)}"/></div>
      <div class="field full"><label for="suggestion-description">Description</label><textarea class="form-control" id="suggestion-description" name="description">${escapeHtml(item.description)}</textarea></div>
      <div class="field"><label for="suggestion-priority">Priority</label><select class="form-control" id="suggestion-priority" name="priority">${["Low", "Medium", "High"].map((value) => `<option ${item.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="field"><label for="suggestion-assignee">Suggested member</label><select class="form-control" id="suggestion-assignee" name="assigneeId">${memberOptions(item.assigneeId)}</select></div>
      <div class="field full"><label for="suggestion-deadline">Deadline</label><input class="form-control" id="suggestion-deadline" name="dueDate" type="date" value="${escapeHtml(item.dueDate)}"/></div>
    </div>`, async (form) => {
    Object.assign(item, { title: String(form.get("title")).trim(), description: String(form.get("description") || "").trim(), priority: String(form.get("priority")), assigneeId: String(form.get("assigneeId") || ""), dueDate: String(form.get("dueDate") || "") });
    render();
  });
}

function generateSuggestions(form) {
  const goal = String(form.goal || "").trim();
  const deadline = String(form.deadline || "");
  const selectedMembers = form.members.map(String);
  if (!goal || !deadline || !selectedMembers.length) {
    toast("Add a project goal, deadline and at least one team member.", true);
    return;
  }
  state.aiGoal = goal;
  state.aiDeadline = deadline;
  state.aiContext = String(form.context || "");
  state.isGenerating = true;
  state.suggestions = [];
  render();
  window.setTimeout(() => {
    const start = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
    const due = new Date(`${deadline}T00:00:00`);
    const availableDays = Math.max(1, Math.floor((due - start) / 86400000));
    state.suggestions = suggestionTemplates.map((template, index) => {
      const taskDate = new Date(start);
      taskDate.setDate(taskDate.getDate() + Math.min(template.offset, availableDays));
      return { ...template, id: `s${Date.now()}${index}`, title: index === 0 ? `Explore ${goal.split(/\s+/).slice(0, 4).join(" ")}` : template.title, assigneeId: selectedMembers[index % selectedMembers.length], dueDate: taskDate.toISOString().slice(0, 10), accepted: false, rejected: false };
    });
    state.isGenerating = false;
    render();
  }, 550);
}

function acceptSuggestion(item) {
  if (item.accepted || item.rejected) return;
  if (item.taskId) {
    const task = byId(state.data.tasks, item.taskId);
    if (task) task.assigneeId = item.assigneeId;
  } else {
    const project = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
    state.data.tasks.unshift({ id: `t${Date.now()}`, title: item.title, description: item.description, projectId: project?.id || "", assigneeId: item.assigneeId, priority: item.priority, status: "To Do", dueDate: item.dueDate });
  }
  item.accepted = true;
  persist(item.taskId ? "Workload recommendation applied" : "Suggestion added to your tasks");
}

function acceptAllSuggestions() {
  state.suggestions.filter((item) => !item.accepted && !item.rejected).forEach((item) => {
    if (item.taskId) {
      const task = byId(state.data.tasks, item.taskId);
      if (task) task.assigneeId = item.assigneeId;
    } else {
      const project = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
      state.data.tasks.unshift({ id: `t${Date.now()}${Math.random().toString(16).slice(2, 5)}`, title: item.title, description: item.description, projectId: project?.id || "", assigneeId: item.assigneeId, priority: item.priority, status: "To Do", dueDate: item.dueDate });
    }
    item.accepted = true;
  });
  persist("Recommendations added to your tasks");
}

function reviewWorkload() {
  const alert = getWorkloadAlert();
  if (!alert) {
    toast("Your team workload looks balanced.");
    return;
  }
  const overloadedMember = byId(state.data.members, alert.memberId);
  const candidates = state.data.members.filter((member) => member.id !== alert.memberId).map((member) => ({
    member,
    count: activeTasks(state.data.tasks).filter((task) => task.assigneeId === member.id).length,
  })).sort((a, b) => a.count - b.count);
  if (!candidates.length) {
    toast("Add another team member before reassigning tasks.", true);
    return;
  }
  const tasksToMove = activeTasks(state.data.tasks).filter((task) => task.assigneeId === alert.memberId).sort((a, b) =>
    ["Low", "Medium", "High"].indexOf(a.priority) - ["Low", "Medium", "High"].indexOf(b.priority),
  ).slice(0, alert.suggestedMoves);
  state.suggestions = tasksToMove.map((task, index) => {
    const recipient = candidates[index % candidates.length];
    return {
      id: `w${Date.now()}${index}`,
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      assigneeId: recipient?.member.id || "",
      reason: `Helps balance the workload: ${overloadedMember.name} has ${alert.activeTasks} active tasks; ${recipient?.member.name || "a teammate"} has ${recipient?.count || 0}.`,
      accepted: false,
      rejected: false,
    };
  });
  state.aiGoal = `Review workload for ${overloadedMember?.name || "your team"}`;
  state.aiDeadline = byId(state.data.projects, state.activeProjectId)?.deadline || "";
  state.page = "AI Organizer";
  state.sidebarOpen = false;
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button,[data-open-project]");
  if (!target) return;
  if (target.dataset.page) { setPage(target.dataset.page); return; }
  if (target.dataset.openProject) { state.activeProjectId = target.dataset.openProject; setPage("Project"); return; }
  if (target.dataset.projectMenu) {
    const project = byId(state.data.projects, target.dataset.projectMenu);
    if (project) projectModal(project);
    return;
  }
  if (target.dataset.action === "menu") { state.sidebarOpen = !state.sidebarOpen; render(); return; }
  if (target.dataset.action === "new-task") { taskModal(null, state.activeProjectId || ""); return; }
  if (target.dataset.action === "new-project") { projectModal(); return; }
  if (target.dataset.action === "manage-project") { projectModal(byId(state.data.projects, state.activeProjectId)); return; }
  if (target.dataset.action === "add-member") { memberModal(); return; }
  if (target.dataset.action === "dismiss-alert") { state.alertDismissed = true; render(); return; }
  if (target.dataset.action === "review-workload") { reviewWorkload(); return; }
  if (target.dataset.action === "accept-all") { acceptAllSuggestions(); return; }
  if (target.dataset.action === "retry") { state.error = ""; initialize(); return; }
  if (target.dataset.action === "notifications") { toast("You’re all caught up."); return; }
  if (target.dataset.editTask) { taskModal(byId(state.data.tasks, target.dataset.editTask)); return; }
  if (target.dataset.deleteTask) {
    const task = byId(state.data.tasks, target.dataset.deleteTask);
    if (task && window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
      state.data.tasks = state.data.tasks.filter((item) => item.id !== task.id);
      persist("Task deleted");
    }
    return;
  }
  if (target.dataset.toggleTask) {
    const task = byId(state.data.tasks, target.dataset.toggleTask);
    if (task) {
      task.status = task.status === "Done" ? "To Do" : "Done";
      persist(task.status === "Done" ? "Nice work — task completed" : "Task moved to To Do");
    }
    return;
  }
  if (target.dataset.removeMember) {
    const project = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
    const member = byId(state.data.members, target.dataset.removeMember);
    if (project && member && window.confirm(`Remove ${member.name} from ${project.name}? Their task assignments will remain.`)) {
      project.memberIds = project.memberIds.filter((id) => id !== member.id);
      persist("Member removed from project");
    }
    return;
  }
  if (target.dataset.suggestionAccept) { acceptSuggestion(state.suggestions.find((item) => item.id === target.dataset.suggestionAccept)); return; }
  if (target.dataset.suggestionReject) {
    const item = state.suggestions.find((suggestion) => suggestion.id === target.dataset.suggestionReject);
    if (item) { item.rejected = true; render(); }
    return;
  }
  if (target.dataset.suggestionEdit) {
    const item = state.suggestions.find((suggestion) => suggestion.id === target.dataset.suggestionEdit);
    if (item) editSuggestion(item);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[data-open-project]")) {
    state.activeProjectId = event.target.dataset.openProject;
    setPage("Project");
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.filter) {
    state.filters[target.dataset.filter] = target.value;
    render();
    return;
  }
  if (target.dataset.statusTask) {
    const task = byId(state.data.tasks, target.dataset.statusTask);
    if (task) { task.status = target.value; persist("Task status updated"); }
    return;
  }
  if (target.hasAttribute("data-team-project")) {
    state.activeProjectId = target.value;
    render();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "ai-form") return;
  event.preventDefault();
  generateSuggestions({
    goal: document.querySelector("#ai-goal").value,
    deadline: document.querySelector("#ai-deadline").value,
    context: document.querySelector("#ai-context").value,
    members: new FormData(event.target).getAll("ai-member"),
  });
});

async function initialize() {
  render();
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    state.data = await workspaceApi.getWorkspace();
    if (!state.activeProjectId) state.activeProjectId = state.data.projects[0]?.id || "";
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

initialize();
