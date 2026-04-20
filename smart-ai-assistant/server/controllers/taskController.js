// ════════════════════════════════════════════════════════════
//  TASK CONTROLLER — CRUD for AI tasks
//  TODO: Replace in-memory map with MongoDB Task model
// ════════════════════════════════════════════════════════════

// Placeholder store (replace with MongoDB Task.find() etc.)
const store = new Map();
let nextId  = 1;

exports.getAll = (req, res) => {
  const userId = req.userId;
  const tasks  = [...store.values()].filter(t => t.userId === userId);
  res.json({ tasks });
};

exports.create = (req, res) => {
  const userId = req.userId;
  const task   = { id: nextId++, userId, createdAt: new Date().toISOString(),
                   status: 'pending', ...req.body };
  store.set(task.id, task);
  res.status(201).json({ task });
};

exports.update = (req, res) => {
  const task = store.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  Object.assign(task, req.body);
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
