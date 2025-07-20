const express = require('express');
const router = express.Router();
const { authenticate } = require('../src/middleware/middleware');
const fs = require('fs').promises;
const path = require('path');
const { readUsers } = require('./accounts');

const DATA_DIR = path.join(process.cwd(), 'data');
const ROUTINES_FILE = path.join(DATA_DIR, 'routines.json');

const ensureRoutinesFile = async () => {
  try {
    await fs.access(ROUTINES_FILE);
  } catch {
    await fs.writeFile(ROUTINES_FILE, JSON.stringify([]));
  }
};

const readRoutines = async () => {
  try {
    await ensureRoutinesFile();
    const data = await fs.readFile(ROUTINES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('readRoutines error:', error);
    throw new Error(`Failed to read routines: ${error.message}`);
  }
};

const writeRoutines = async (routines) => {
  try {
    await ensureRoutinesFile();
    await fs.writeFile(ROUTINES_FILE, JSON.stringify(routines, null, 2));
  } catch (error) {
    console.error('writeRoutines error:', error);
    throw new Error(`Failed to write routines: ${error.message}`);
  }
};

router.post('/', authenticate, async (req, res) => {
  if (req.user.userType !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can create routines' });
  }
  const { section, day, time, subject, teacherId } = req.body;
  if (!section || !day || !time || !subject || !teacherId) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const users = await readUsers();
  const teacher = users.find(u => u.id === teacherId && u.userType === 'Teacher');
  if (!teacher) {
    return res.status(400).json({ message: 'Invalid teacherId' });
  }
  const routines = await readRoutines();
  const newRoutine = {
    id: routines.length + 1,
    section,
    day,
    time,
    subject,
    teacherId,
  };
  routines.push(newRoutine);
  await writeRoutines(routines);
  res.status(201).json(newRoutine);
});

router.put('/:id', authenticate, async (req, res) => {
  if (req.user.userType !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can update routines' });
  }
  const { id } = req.params;
  const { section, day, time, subject, teacherId } = req.body;
  if (!section || !day || !time || !subject || !teacherId) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const users = await readUsers();
  const teacher = users.find(u => u.id === teacherId && u.userType === 'Teacher');
  if (!teacher) {
    return res.status(400).json({ message: 'Invalid teacherId' });
  }
  const routines = await readRoutines();
  const index = routines.findIndex(r => r.id === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ message: 'Routine not found' });
  }
  routines[index] = { id: parseInt(id), section, day, time, subject, teacherId };
  await writeRoutines(routines);
  res.json(routines[index]);
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.userType !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can delete routines' });
  }
  const { id } = req.params;
  const routines = await readRoutines();
  const index = routines.findIndex(r => r.id === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ message: 'Routine not found' });
  }
  routines.splice(index, 1);
  await writeRoutines(routines);
  res.json({ message: 'Routine deleted' });
});

router.get('/', authenticate, async (req, res) => {
  const routines = await readRoutines();
  let filteredRoutines;
  if (req.user.userType === 'Admin') {
    filteredRoutines = routines;
  } else if (req.user.userType === 'Teacher') {
    filteredRoutines = routines.filter(r => r.teacherId === req.user.id);
  } else if (req.user.userType === 'Student') {
    if (!req.user.section) {
      return res.status(400).json({ message: 'Student section not found' });
    }
    filteredRoutines = routines.filter(r => r.section === req.user.section);
  } else {
    return res.status(403).json({ message: 'Invalid user type' });
  }
  res.json(filteredRoutines);
});

module.exports = router;