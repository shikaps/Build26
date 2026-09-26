import { workspaceApi } from "./api.js";
import { mockAiService } from "./ai.js";
import { mockAuth } from "./auth.js";

const state = {
  page: "Dashboard",
  data: null,
  activeProjectId: null,
  filters: { member: "", priority: "", status: "", due: "", sort: "deadline" },
  suggestions: [],
  alertDismissed: false,
  sidebarOpen: false,
  accountMenuOpen: false,
  authenticated: true,
  sessionUser: null,
  authError: "",
  authValues: {},
  assignmentDraft: null,
  assignmentRecommendations: [],
  assignmentRecommendationIndex: 0,
  assignmentLoading: false,
  assignmentAccepted: false,
  error: "",
};

const icons = {
  Dashboard: "⌂",
  Projects: "▦",
  "My tasks": "✓",
  "AI Organizer": "✧",
  "AI Task Assignment": "↳",
  "AI Workload Alert": "↳",
  Team: "♧",
};
const appPages = ["Dashboard", "Projects", "My tasks", "AI Organizer", "AI Task Assignment", "AI Workload Alert", "Team", "Profile", "Project", "Login", "Register"];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const byId = (items, id) => items.find((item) => item.id === id);
const currentUser = () => state.sessionUser || state.data.currentUser;
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
    <div class="top-actions"><button class="header-profile-button" data-page="Profile" aria-label="Open profile">${avatar(currentUser())}</button></div>
  </header>`;
}

function sidebar() {
  const activeCount = activeTasks(state.data.tasks).length;
  const active = (page) => state.page === page || (page === "Projects" && state.page === "Project") ? 'aria-current="page"' : "";
  return `<aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
    <button class="brand" data-page="Dashboard" aria-label="Orbit dashboard"><span class="brand-mark">◒</span> orbit</button>
    <div class="nav-label">WORKSPACE</div>
    <nav class="nav-links" aria-label="Main navigation">
      <button class="nav-item ${state.page === "Dashboard" ? "active" : ""}" data-page="Dashboard" ${active("Dashboard")}><span class="nav-icon">${icons.Dashboard}</span>Dashboard</button>
      <button class="nav-item ${state.page === "Projects" || state.page === "Project" ? "active" : ""}" data-page="Projects" ${active("Projects")}><span class="nav-icon">${icons.Projects}</span>Projects</button>
      <button class="nav-item ${state.page === "My tasks" ? "active" : ""}" data-page="My tasks" ${active("My tasks")}><span class="nav-icon">${icons["My tasks"]}</span>My tasks<span class="nav-badge">${activeCount}</span></button>
      <div class="nav-group">
        <button class="nav-item ${state.page === "AI Organizer" ? "active" : ""}" data-page="AI Organizer" ${active("AI Organizer")}><span class="nav-icon">${icons["AI Organizer"]}</span>AI Organizer</button>
        <div class="ai-subnav" aria-label="AI tools">
          <button class="nav-sub-item ${state.page === "AI Task Assignment" ? "active" : ""}" data-page="AI Task Assignment" ${active("AI Task Assignment")}><span class="nav-icon">${icons["AI Task Assignment"]}</span>Task Assignment</button>
          <button class="nav-sub-item ${state.page === "AI Workload Alert" ? "active" : ""}" data-page="AI Workload Alert" ${active("AI Workload Alert")}><span class="nav-icon">${icons["AI Workload Alert"]}</span>Workload Alert</button>
        </div>
      </div>
      <button class="nav-item ${state.page === "Team" ? "active" : ""}" data-page="Team" ${active("Team")}><span class="nav-icon">${icons.Team}</span>Team</button>
    </nav>
    <div class="sidebar-bottom">
      <div class="upgrade-card"><span style="color:#a7d1bb">✦</span><strong>A little help goes a long way</strong><p>Let AI turn your project goals into a clear team plan.</p><button class="upgrade-link" data-page="AI Organizer">Try AI organizer&nbsp; →</button></div>
      <div class="user-mini"><button class="user-profile-link" data-page="Profile" aria-label="Open profile">${avatar(currentUser())}<span class="user-mini-info"><strong>${escapeHtml(currentUser().name)}</strong><span>Student workspace</span></span></button><button class="btn-ghost account-menu-toggle" data-account-menu-toggle aria-label="Account options" aria-haspopup="menu" aria-expanded="${state.accountMenuOpen}" aria-controls="account-menu">···</button>
        <div class="account-menu" id="account-menu" role="menu" aria-label="Account options" ${state.accountMenuOpen ? "" : "hidden"}>
          <button type="button" role="menuitem" data-account-action="profile">Profile</button>
          <button type="button" role="menuitem" data-account-action="logout">Log out</button>
        </div>
      </div>
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
    </div>
    <section class="panel ai-tools-panel"><div class="panel-heading"><div><h2>More AI tools</h2><p>Get a thoughtful second opinion on assignments and workload.</p></div></div><div class="ai-tool-links">
      <button class="ai-tool-link" data-page="AI Task Assignment"><span class="stat-icon purple">↳</span><span><strong>AI Task Assignment</strong><small>Find a teammate for a task</small></span><span aria-hidden="true">→</span></button>
      <button class="ai-tool-link" data-page="AI Workload Alert"><span class="stat-icon orange">⚠</span><span><strong>AI Workload Alert</strong><small>See how work is shared</small></span><span aria-hidden="true">→</span></button>
    </div></section>`;
}

function assignmentDefaults() {
  const project = byId(state.data.projects, state.activeProjectId) || state.data.projects[0];
  return {
    taskId: "",
    title: "Prepare project presentation",
    description: "Organize the team's final presentation and rehearse the key points.",
    priority: "Medium",
    dueDate: project?.deadline || "",
    projectId: project?.id || "",
    memberIds: project?.memberIds?.length ? [...project.memberIds] : state.data.members.map((member) => member.id),
  };
}

function aiTaskAssignment() {
  const draft = state.assignmentDraft || assignmentDefaults();
  const chosen = state.assignmentRecommendations[state.assignmentRecommendationIndex];
  const member = chosen && byId(state.data.members, chosen.memberId);
  const tasks = [...state.data.tasks].sort((first, second) => first.title.localeCompare(second.title));
  return `${pageHeading("AI task assignment", "Find a teammate with the time and skills to take the next step.", "", "")}
    <div class="assignment-layout">
      <section class="panel"><div class="panel-heading"><div><h2>Task details</h2><p>Choose an existing task or add a new one.</p></div><span class="stat-icon purple">✧</span></div>
        <form id="assignment-form">
          <div class="field"><label for="assignment-existing-task">Start with a task</label><select class="form-control" id="assignment-existing-task" name="taskId"><option value="">Create a new task</option>${tasks.map((task) => `<option value="${escapeHtml(task.id)}" ${draft.taskId === task.id ? "selected" : ""}>${escapeHtml(task.title)}</option>`).join("")}</select></div>
          <div class="field"><label for="assignment-title">Task name</label><input class="form-control" id="assignment-title" name="title" required maxlength="100" value="${escapeHtml(draft.title)}" placeholder="e.g. Prepare project presentation"/></div>
          <div class="field"><label for="assignment-description">Description</label><textarea class="form-control" id="assignment-description" name="description" placeholder="Add a little context for your teammate">${escapeHtml(draft.description)}</textarea></div>
          <div class="form-grid">
            <div class="field"><label for="assignment-project">Project</label><select class="form-control" id="assignment-project" name="projectId"><option value="">No project</option>${projectOptions(draft.projectId)}</select></div>
            <div class="field"><label for="assignment-priority">Priority</label><select class="form-control" id="assignment-priority" name="priority">${["Low", "Medium", "High"].map((value) => `<option ${draft.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
            <div class="field full"><label for="assignment-deadline">Deadline</label><input class="form-control" id="assignment-deadline" name="dueDate" type="date" value="${escapeHtml(draft.dueDate)}" required/></div>
          </div>
          <div class="field"><label>Team members to consider</label><div class="member-check-list">${state.data.members.map((person) => `<label class="member-chip">${avatar(person, "tiny")}<input type="checkbox" name="assignment-member" value="${escapeHtml(person.id)}" ${draft.memberIds.includes(person.id) ? "checked" : ""}/> ${escapeHtml(person.name.split(" ")[0])}</label>`).join("")}</div></div>
          <button class="btn btn-primary" type="submit" style="width:100%" ${state.assignmentLoading ? "disabled" : ""}>✧ Get assignment recommendation</button>
        </form>
      </section>
      <section class="panel assignment-result" aria-live="polite"><div class="panel-heading"><div><h2>AI recommendation</h2><p>Mock recommendation based on your team's current task list.</p></div><span class="stat-icon green">✧</span></div>
        ${state.assignmentLoading ? `<div class="ai-loading"><span class="spinner"></span> Looking at current team workload…</div>` : chosen ? `<div class="assignment-summary"><span class="eyebrow">TASK TO ASSIGN</span><h3>${escapeHtml(state.assignmentDraft.title)}</h3><p>${escapeHtml(state.assignmentDraft.description || "No description provided.")}</p><div class="suggestion-meta">${priorityTag(state.assignmentDraft.priority)}<span class="due-date">Due ${formatDate(state.assignmentDraft.dueDate)}</span></div></div>
          <div class="assignment-person">${member ? avatar(member, "small") : ""}<div><span class="eyebrow">SUGGESTED MEMBER</span><strong>${escapeHtml(member?.name || "Team member")}</strong><span>${chosen.activeTasks} active task${chosen.activeTasks === 1 ? "" : "s"}</span></div><span class="status-pill done">Best fit</span></div>
          <div class="assignment-reason"><strong>Why this match</strong><p>${escapeHtml(chosen.reason)}</p></div>
          <div class="assignment-actions"><button class="btn btn-secondary" data-action="assignment-next">Choose another member</button><button class="btn btn-primary" data-action="assignment-accept" ${state.assignmentAccepted ? "disabled" : ""}>${state.assignmentAccepted ? "Assignment accepted" : "Accept assignment"}</button></div>
          ${state.assignmentAccepted ? `<div class="inline-success" role="status">Task assignment updated in your workspace.</div>` : ""}` : `<div class="empty-state"><div class="empty-icon">✧</div><h3>A better-balanced team starts with a good fit</h3><p>Fill in the task details and we’ll suggest a teammate using the active tasks already in your workspace.</p></div>`}
        ${state.assignmentError ? `<div class="error-state" role="alert">${escapeHtml(state.assignmentError)}</div>` : ""}
      </section>
    </div>`;
}

function aiWorkloadAlert() {
  const counts = state.data.members.map((member) => ({
    member,
    count: activeTasks(state.data.tasks).filter((task) => task.assigneeId === member.id).length,
  }));
  const maxCount = Math.max(1, ...counts.map((item) => item.count));
  const alert = getWorkloadAlert();
  const mostLoaded = alert && byId(state.data.members, alert.memberId);
  const recipients = counts.filter((item) => item.member.id !== alert?.memberId).sort((first, second) => first.count - second.count).slice(0, 2);
  return `${pageHeading("AI workload alert", "A shared view of how tasks are distributed across your team.", "", "")}
    <section class="panel workload-panel"><div class="panel-heading"><div><h2>Current team workload</h2><p>Active task counts are calculated from your shared workspace tasks.</p></div><span class="stat-icon blue">♧</span></div>
      ${counts.length ? `<div class="workload-list">${counts.map(({ member, count }) => `<div class="workload-row"><div class="workload-person">${avatar(member, "small")}<strong>${escapeHtml(member.name)}</strong></div><div class="workload-track"><div class="progress-track"><div class="progress-fill" style="width:${Math.round(count / maxCount * 100)}%"></div></div></div><span class="workload-count">${count} active task${count === 1 ? "" : "s"}</span><button class="text-link" data-workload-member="${escapeHtml(member.id)}">Review tasks</button></div>`).join("")}</div>` : `<div class="empty-state"><h3>No team members yet</h3><p>Add members to see how work is shared.</p><button class="btn btn-secondary btn-sm" data-page="Team">Open team</button></div>`}
    </section>
    ${alert && !state.alertDismissed ? `<section class="workload-feature-alert"><span class="alert-icon">⚠</span><div class="workload-feature-copy"><div class="eyebrow">WORKLOAD ALERT</div><h2>Workload imbalance detected</h2><p><strong>${escapeHtml(mostLoaded?.name || "A team member")}</strong> currently has significantly more active tasks than other team members.</p><div class="ai-suggestion-copy"><strong>AI suggestion</strong><p>Consider moving ${alert.suggestedMoves} task${alert.suggestedMoves === 1 ? "" : "s"} from ${escapeHtml(mostLoaded?.name || "this teammate")} to ${recipients.map((item) => escapeHtml(item.member.name.split(" ")[0])).join(" or ") || "another team member"}.</p></div><div class="alert-actions-large"><button class="btn btn-primary btn-sm" data-action="workload-review">Review tasks</button><button class="btn btn-secondary btn-sm" data-action="workload-dismiss">Dismiss alert</button></div></div></section>` : `<section class="panel workload-balanced"><span class="stat-icon green">✓</span><div><h2>${state.alertDismissed ? "Alert dismissed" : "Workload looks balanced"}</h2><p>${state.alertDismissed ? "Your team's workload alert has been dismissed." : "There is no significant workload imbalance in the current task data."}</p></div></section>`}`;
}

function profilePage() {
  const user = currentUser();
  const workspaceMember = state.data.members.find((member) => member.id === user.id);
  const assignedTasks = state.data.tasks.filter((task) => task.assigneeId === user.id);
  const activeCount = activeTasks(assignedTasks).length;
  const completedCount = assignedTasks.filter((task) => task.status === "Done").length;
  const projectCount = state.data.projects.filter((project) => project.memberIds.includes(user.id)).length;
  return `${pageHeading("Profile", "Your account information and workspace details.", "", "")}
    <section class="panel profile-card">
      <div class="profile-identity">${avatar(user, "profile-avatar")}<div><div class="eyebrow">STUDENT PROFILE</div><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.email || "Email not provided")}</p></div></div>
      <div class="profile-details">
        <div class="profile-detail"><span>Full name</span><strong>${escapeHtml(user.name)}</strong></div>
        <div class="profile-detail"><span>Email</span><strong>${escapeHtml(user.email || "Email not provided")}</strong></div>
        <div class="profile-detail"><span>Role</span><strong>Student</strong></div>
        <div class="profile-detail"><span>Member status</span><strong>${workspaceMember ? "Workspace member" : "Signed-in student"}</strong></div>
        <div class="profile-detail"><span>Account ID</span><strong>${escapeHtml(user.id || "Frontend profile")}</strong></div>
      </div>
    </section>
    <section class="panel profile-workspace"><div class="panel-heading"><div><h2>Account information</h2><p>Your current activity across the Orbit workspace.</p></div></div>
      <div class="profile-stats">
        <div class="stat-card"><div class="stat-head">Projects <span class="stat-icon green">▦</span></div><div class="stat-value">${projectCount}</div></div>
        <div class="stat-card"><div class="stat-head">Active tasks <span class="stat-icon blue">◷</span></div><div class="stat-value">${activeCount}</div></div>
        <div class="stat-card"><div class="stat-head">Completed tasks <span class="stat-icon purple">✓</span></div><div class="stat-value">${completedCount}</div></div>
      </div>
    </section>`;
}

function authPage() {
  const registering = state.page === "Register";
  return `<main class="auth-shell">
    <section class="auth-welcome">
      <button class="auth-brand" data-page="Dashboard" aria-label="Orbit dashboard"><span class="brand-mark">◒</span> orbit</button>
      <div class="auth-welcome-copy"><div class="eyebrow">YOUR STUDENT WORKSPACE</div><h1>Make room for the work that matters.</h1><p>Keep projects moving, stay in sync with your team, and celebrate every small win.</p></div>
      <div class="auth-welcome-note"><span>✦</span> Thoughtful planning for student teams.</div>
    </section>
    <section class="auth-form-area"><div class="auth-form-card">
      <div class="eyebrow">${registering ? "GET STARTED" : "WELCOME BACK"}</div>
      <h2>${registering ? "Create your account" : "Sign in to Orbit"}</h2>
      <p class="auth-subtitle">${registering ? "Your next project starts here." : "Pick up right where your team left off."}</p>
      ${state.authError ? `<div class="auth-error" role="alert">${escapeHtml(state.authError)}</div>` : ""}
      <form data-auth-form="${registering ? "register" : "login"}">
        ${registering ? `<div class="field"><label for="auth-name">Name</label><input class="form-control" id="auth-name" name="name" autocomplete="name" required value="${escapeHtml(state.authValues.name || "")}" placeholder="Your name"/></div>` : ""}
        <div class="field"><label for="auth-email">Email</label><input class="form-control" id="auth-email" name="email" type="email" autocomplete="email" required value="${escapeHtml(state.authValues.email || "")}" placeholder="you@campus.edu"/></div>
        <div class="field"><label for="auth-password">Password</label><input class="form-control" id="auth-password" name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" minlength="${registering ? 8 : 1}" required placeholder="${registering ? "At least 8 characters" : "Enter your password"}"/></div>
        ${registering ? `<div class="field"><label for="auth-confirm-password">Confirm password</label><input class="form-control" id="auth-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Enter your password again"/></div>` : ""}
        <button class="btn btn-primary auth-submit" type="submit">${registering ? "Create account" : "Log in"}</button>
      </form>
      <p class="auth-switch">${registering ? "Already have an account?" : "New to Orbit?"} <button class="text-link" data-page="${registering ? "Login" : "Register"}">${registering ? "Log in" : "Create an account"}</button></p>
      <p class="auth-demo-note">Frontend preview only. Sign-in details are not saved.</p>
    </div></section>
  </main>`;
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
  if (!state.authenticated || state.page === "Login" || state.page === "Register") {
    root.innerHTML = authPage();
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
  else if (state.page === "AI Task Assignment") content = aiTaskAssignment();
  else if (state.page === "AI Workload Alert") content = aiWorkloadAlert();
  else if (state.page === "Profile") content = profilePage();
  else content = aiOrganizer();
  root.innerHTML = `<div class="shell">${sidebar()}<main class="main">${topbar()}${content}</main></div>`;
}

const routeSlugs = {
  Dashboard: "dashboard",
  Projects: "projects",
  "My tasks": "my-tasks",
  "AI Organizer": "ai-organizer",
  "AI Task Assignment": "ai-task-assignment",
  "AI Workload Alert": "ai-workload-alert",
  Team: "team",
  Profile: "profile",
  Login: "login",
  Register: "register",
};

function routeUrl(page, projectId = state.activeProjectId) {
  return page === "Project" && projectId
    ? `#project/${encodeURIComponent(projectId)}`
    : `#${routeSlugs[page] || "dashboard"}`;
}

function routeFromLocation() {
  const route = window.location.hash.slice(1);
  const projectMatch = route.match(/^project\/([^/]+)$/);
  if (projectMatch) {
    return { page: "Project", projectId: decodeURIComponent(projectMatch[1]) };
  }
  const page = Object.keys(routeSlugs).find((candidate) => routeSlugs[candidate] === route);
  return { page: page || "Dashboard", projectId: null };
}

function setPage(page, { pushHistory = true, projectId = state.activeProjectId, scroll = true } = {}) {
  if (!appPages.includes(page)) page = "Dashboard";
  if (page === "Project" && projectId) state.activeProjectId = projectId;
  state.page = page;
  state.authenticated = page !== "Login" && page !== "Register";
  state.sidebarOpen = false;
  state.accountMenuOpen = false;
  state.authError = "";
  if (page === "Projects" || page === "Project") state.filters = { member: "", priority: "", status: "", due: "", sort: "deadline" };
  if (pushHistory) {
    window.history.pushState({ orbit: true, page, projectId: state.activeProjectId }, "", routeUrl(page));
  }
  render();
  if (scroll) {
    document.querySelector(".main")?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

window.addEventListener("popstate", (event) => {
  const route = event.state?.orbit ? event.state : routeFromLocation();
  setPage(route.page, { pushHistory: false, projectId: route.projectId, scroll: false });
});

async function persist(message) {
  try {
    await workspaceApi.saveWorkspace(state.data);
    render();
    if (message) toast(message);
  } catch (error) {
    toast(error.message, true);
  }
}

async function requestAssignment(values) {
  const memberIds = [...new Set(values.memberIds)];
  if (!memberIds.length) {
    toast("Choose at least one team member to consider.", true);
    return;
  }
  state.assignmentDraft = { ...values, memberIds };
  state.assignmentRecommendations = [];
  state.assignmentRecommendationIndex = 0;
  state.assignmentAccepted = false;
  state.assignmentError = "";
  state.assignmentLoading = true;
  render();
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    state.assignmentRecommendations = await mockAiService.getAssignmentRecommendations({
      tasks: state.data.tasks,
      members: state.data.members,
      memberIds,
      deadline: values.dueDate,
    });
  } catch (error) {
    state.assignmentError = error.message;
  } finally {
    state.assignmentLoading = false;
    render();
  }
}

async function acceptAssignment() {
  const recommendation = state.assignmentRecommendations[state.assignmentRecommendationIndex];
  const draft = state.assignmentDraft;
  if (!recommendation || !draft) {
    toast("Get an assignment recommendation first.", true);
    return;
  }
  if (draft.taskId) {
    const task = byId(state.data.tasks, draft.taskId);
    if (!task) {
      toast("That task is no longer available. Choose another task.", true);
      return;
    }
    Object.assign(task, {
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      dueDate: draft.dueDate,
      projectId: draft.projectId,
      assigneeId: recommendation.memberId,
    });
  } else {
    state.data.tasks.unshift({
      id: `t${Date.now()}`,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      dueDate: draft.dueDate,
      projectId: draft.projectId,
      assigneeId: recommendation.memberId,
      status: "To Do",
    });
    state.assignmentDraft.taskId = state.data.tasks[0].id;
  }
  state.assignmentAccepted = true;
  await persist("Task assignment updated");
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
  if (!event.target.closest(".user-mini")) {
    state.accountMenuOpen = false;
    const menu = document.querySelector("#account-menu");
    const toggle = document.querySelector("[data-account-menu-toggle]");
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
  const target = event.target.closest("button,[data-open-project]");
  if (!target) return;
  if (target.dataset.accountMenuToggle !== undefined) {
    state.accountMenuOpen = !state.accountMenuOpen;
    render();
    if (state.accountMenuOpen) document.querySelector("#account-menu [role='menuitem']")?.focus();
    else document.querySelector("[data-account-menu-toggle]")?.focus();
    return;
  }
  if (target.dataset.accountAction) {
    const action = target.dataset.accountAction;
    state.accountMenuOpen = false;
    if (action === "logout") {
      state.sessionUser = null;
      setPage("Login");
      toast("Signed out of this frontend preview.");
      return;
    }
    if (action === "profile") setPage("Profile");
    return;
  }
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
  if (target.dataset.action === "assignment-next") {
    if (state.assignmentRecommendations.length > 1) {
      state.assignmentRecommendationIndex = (state.assignmentRecommendationIndex + 1) % state.assignmentRecommendations.length;
      state.assignmentAccepted = false;
      render();
    } else toast("There are no other selected members to suggest.", true);
    return;
  }
  if (target.dataset.action === "assignment-accept") { acceptAssignment(); return; }
  if (target.dataset.action === "workload-review") {
    const alert = getWorkloadAlert();
    if (alert) {
      state.filters = { ...state.filters, member: alert.memberId, status: "" };
      setPage("My tasks");
    } else toast("Your team workload looks balanced.");
    return;
  }
  if (target.dataset.action === "workload-dismiss") {
    state.alertDismissed = true;
    render();
    toast("Workload alert dismissed");
    return;
  }
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
  if (target.dataset.workloadMember) {
    state.filters = { ...state.filters, member: target.dataset.workloadMember, status: "" };
    setPage("My tasks");
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
  if (event.key === "Escape" && state.accountMenuOpen) {
    state.accountMenuOpen = false;
    render();
    document.querySelector("[data-account-menu-toggle]")?.focus();
    return;
  }
  if (state.accountMenuOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
    const items = [...document.querySelectorAll("#account-menu [role='menuitem']")];
    const currentIndex = items.indexOf(document.activeElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    items[(currentIndex + direction + items.length) % items.length]?.focus();
    event.preventDefault();
    return;
  }
  if (event.key === "ArrowDown" && event.target.matches("[data-account-menu-toggle]")) {
    state.accountMenuOpen = true;
    render();
    document.querySelector("#account-menu [role='menuitem']")?.focus();
    event.preventDefault();
    return;
  }
  if (event.key === "Enter" && event.target.matches("[data-open-project]")) {
    state.activeProjectId = event.target.dataset.openProject;
    setPage("Project");
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "assignment-existing-task") {
    const task = byId(state.data.tasks, target.value);
    const project = task && byId(state.data.projects, task.projectId);
    state.assignmentDraft = task ? {
      taskId: task.id,
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: task.dueDate || "",
      projectId: task.projectId || "",
      memberIds: project?.memberIds?.length ? [...project.memberIds] : state.data.members.map((member) => member.id),
    } : null;
    state.assignmentRecommendations = [];
    state.assignmentRecommendationIndex = 0;
    state.assignmentAccepted = false;
    render();
    return;
  }
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
  const formElement = event.target;
  if (formElement.matches("[data-auth-form]")) {
    event.preventDefault();
    const values = new FormData(formElement);
    state.authValues = {
      name: String(values.get("name") || ""),
      email: String(values.get("email") || ""),
    };
    state.authError = "";
    const submit = async () => {
      try {
        if (formElement.dataset.authForm === "register") {
          state.sessionUser = await mockAuth.register({
            name: String(values.get("name") || ""),
            email: String(values.get("email") || ""),
            password: String(values.get("password") || ""),
            confirmPassword: String(values.get("confirmPassword") || ""),
          });
        } else {
          state.sessionUser = await mockAuth.login({
            email: String(values.get("email") || ""),
            password: String(values.get("password") || ""),
            users: [...state.data.members, state.data.currentUser],
          });
        }
        state.authValues = {};
        setPage("Dashboard");
        toast("Welcome to your student workspace.");
      } catch (error) {
        state.authError = error.message;
        render();
      }
    };
    submit();
    return;
  }
  if (formElement.id === "assignment-form") {
    event.preventDefault();
    const values = new FormData(formElement);
    requestAssignment({
      taskId: String(values.get("taskId") || ""),
      title: String(values.get("title") || "").trim(),
      description: String(values.get("description") || "").trim(),
      projectId: String(values.get("projectId") || ""),
      priority: String(values.get("priority")),
      dueDate: String(values.get("dueDate") || ""),
      memberIds: values.getAll("assignment-member").map(String),
    });
    return;
  }
  if (formElement.id !== "ai-form") return;
  event.preventDefault();
  generateSuggestions({
    goal: document.querySelector("#ai-goal").value,
    deadline: document.querySelector("#ai-deadline").value,
    context: document.querySelector("#ai-context").value,
    members: new FormData(formElement).getAll("ai-member"),
  });
});

async function initialize() {
  render();
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    state.data = await workspaceApi.getWorkspace();
    const route = routeFromLocation();
    state.page = route.page;
    state.authenticated = route.page !== "Login" && route.page !== "Register";
    state.activeProjectId = route.projectId || state.data.projects[0]?.id || "";
    window.history.replaceState({ orbit: true, page: state.page, projectId: state.activeProjectId }, "", routeUrl(state.page));
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

initialize();
