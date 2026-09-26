const API_URL = '/api';

const state = {
  tasks: [],
};

const form = document.getElementById('taskForm');
const backendStatus = document.getElementById('backendStatus');
const aiSuggestion = document.getElementById('aiSuggestion');
const suggestPriorityButton = document.getElementById('suggestPriorityButton');

const columns = {
  todo: document.getElementById('todoList'),
  in_progress: document.getElementById('inProgressList'),
  done: document.getElementById('doneList'),
};

const countEls = {
  todo: document.getElementById('todoCount'),
  in_progress: document.getElementById('inProgressCount'),
  done: document.getElementById('doneCount'),
};

function setStatusLabel(isOnline) {
  backendStatus.textContent = isOnline ? 'Backend online' : 'Using local fallback';
  backendStatus.classList.toggle('offline', !isOnline);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

async function loadTasks() {
  try {
    const tasks = await fetchJson(`${API_URL}/tasks`);
    state.tasks = tasks || [];
    setStatusLabel(true);
    renderTasks();
  } catch (error) {
    console.error(error);
    setStatusLabel(false);
    state.tasks = [];
    renderTasks();
  }
}

function renderTasks() {
  Object.entries(columns).forEach(([status, listEl]) => {
    listEl.innerHTML = '';

    const tasksForStatus = state.tasks.filter((task) => task.status === status);
    countEls[status].textContent = String(tasksForStatus.length);

    if (!tasksForStatus.length) {
      listEl.innerHTML = '<div class="empty-state">No tasks here yet.</div>';
      return;
    }

    tasksForStatus.forEach((task) => {
      const card = document.createElement('article');
      card.className = 'task-card';
      card.innerHTML = `
        <h4>${escapeHtml(task.title || 'Untitled task')}</h4>
        <p>${escapeHtml(task.description || 'No description provided.')}</p>
        <div class="meta-row">
          <span class="priority-badge priority-${task.priority || 'medium'}">${capitalize(task.priority || 'medium')}</span>
          <span class="member-badge">${escapeHtml(task.assignee || 'Unassigned')}</span>
          <span class="team-badge">${escapeHtml(task.team || 'Student Team')}</span>
        </div>
        <div class="task-actions">
          <select data-action="status" data-id="${task.id}" aria-label="Change status">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To do</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In progress</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
          </select>
          <button type="button" data-action="delete" data-id="${task.id}">Move</button>
        </div>
      `;

      const statusSelect = card.querySelector('[data-action="status"]');
      statusSelect.addEventListener('change', async (event) => {
        const id = event.target.dataset.id;
        const statusValue = event.target.value;
        await updateTask(id, { status: statusValue });
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const nextPriority = getNextPriority(task.priority || 'medium');
        await updateTask(task.id, { priority: nextPriority });
      });

      listEl.appendChild(card);
    });
  });
}

function getNextPriority(currentPriority) {
  const order = ['low', 'medium', 'high', 'urgent'];
  const currentIndex = order.indexOf(currentPriority);
  return order[(currentIndex + 1) % order.length];
}

async function updateTask(taskId, updates) {
  try {
    const updated = await fetchJson(`${API_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    await loadTasks();
    return updated;
  } catch (error) {
    console.error('Update failed', error);
  }
}

async function createTask(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    title: formData.get('title').trim(),
    description: formData.get('description').trim(),
    assignee: formData.get('assignee').trim() || 'Unassigned',
    team: formData.get('team').trim() || 'Student Team',
    status: formData.get('status'),
    priority: formData.get('priority'),
  };

  if (!payload.title || !payload.description) {
    return;
  }

  try {
    await fetchJson(`${API_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    form.reset();
    document.getElementById('priority').value = 'medium';
    aiSuggestion.classList.add('hidden');
    aiSuggestion.textContent = '';
    await loadTasks();
  } catch (error) {
    console.error('Create failed', error);
  }
}

async function suggestPriority() {
  const description = document.getElementById('description').value.trim();
  if (!description) {
    aiSuggestion.textContent = 'Add a task description first so the AI can suggest a priority level.';
    aiSuggestion.classList.remove('hidden');
    return;
  }

  try {
    const result = await fetchJson(`${API_URL}/ai/priority`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
    const priority = result.suggestedPriority || 'medium';
    document.getElementById('priority').value = priority;
    aiSuggestion.textContent = `Suggested priority: ${capitalize(priority)}. ${result.message}`;
    aiSuggestion.classList.remove('hidden');
  } catch (error) {
    aiSuggestion.textContent = 'The AI suggestion could not be calculated right now.';
    aiSuggestion.classList.remove('hidden');
    console.error(error);
  }
}

function capitalize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

form.addEventListener('submit', createTask);
suggestPriorityButton.addEventListener('click', suggestPriority);

loadTasks();
