// ════════════════════════════════════════════════════════════
//  TASK CONTROLLER — CRUD for AI tasks
//  Hardened with input validation, duplicate prevention,
//  clean schema enforcement, and proper error responses.
//  TODO: Replace in-memory map with MongoDB Task model
// ════════════════════════════════════════════════════════════
const { requireFields, sanitize } = require('../utils/validate');

// Placeholder store (replace with MongoDB Task.find() etc.)
const store = new Map();
let nextId  = 1;

// ── Validation helper ─────────────────────────────────────
function validateTaskBody(body) {
  const errors = [];

  if (!body.title?.trim() && !body.prompt?.trim()) {
    errors.push('At least title or prompt is required.');
  }

  if (body.title && body.title.trim().length > 200) {
    errors.push('Title must be under 200 characters.');
  }

  if (body.prompt && body.prompt.trim().length > 10000) {
    errors.push('Prompt must be under 10,000 characters.');
  }

  return errors;
}

// ── Duplicate check ───────────────────────────────────────
function isDuplicate(userId, prompt) {
  if (!prompt?.trim()) return false;
  const norm = prompt.trim().toLowerCase();
  for (const task of store.values()) {
    if (task.userId === userId && task.prompt?.trim().toLowerCase() === norm) {
      return true;
    }
  }
  return false;
}

// ── CRUD operations ───────────────────────────────────────

exports.getAll = (req, res) => {
  const userId = req.userId;
  const tasks  = [...store.values()].filter(t => t.userId === userId);
  res.json({ tasks });
};

exports.create = (req, res) => {
  const userId = req.userId;

  // Validate required fields
  const validationErrors = validateTaskBody(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' ') });
  }

  // Check for duplicates
  if (isDuplicate(userId, req.body.prompt)) {
    return res.status(409).json({ error: 'A task with this prompt already exists.' });
  }

  // Build clean task object with sanitized inputs
  const task = {
    id:        nextId++,
    userId,
    title:     sanitize(req.body.title || req.body.prompt?.slice(0, 80), 200),
    prompt:    sanitize(req.body.prompt || '', 10000),
    aiOutput:  sanitize(req.body.aiOutput || '', 50000),
    taskType:  sanitize(req.body.taskType || 'general', 30),
    priority:  sanitize(req.body.priority || '', 10),
    dueDate:   sanitize(req.body.dueDate || '', 20),
    status:    'pending',
    provider:  sanitize(req.body.provider || '', 50),
    createdAt: new Date().toISOString()
  };

  store.set(task.id, task);
  res.status(201).json({ task });
};

exports.update = (req, res) => {
  const task = store.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Only allow updating specific fields
  const allowedFields = ['title', 'prompt', 'aiOutput', 'priority', 'dueDate', 'status', 'taskType'];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = sanitize(req.body[field], field === 'aiOutput' ? 50000 : 200);
    }
  }

  Object.assign(task, updates);
  store.set(task.id, task);
  res.json({ task });
};

exports.toggle = (req, res) => {
  const task = store.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.status = task.status === 'completed' ? 'pending' : 'completed';
  store.set(task.id, task);
  res.json({ task });
};

exports.remove = (req, res) => {
  const id = Number(req.params.id);
  if (!store.has(id)) return res.status(404).json({ error: 'Task not found' });
  store.delete(id);
  res.json({ deleted: true, id });
};
