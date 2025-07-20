const express = require('express');
const router = express.Router();
const { authenticate } = require('../src/middleware/middleware');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const MARKS_FILE = path.join(DATA_DIR, 'marks.json');

// Ensure marks.json exists
const ensureMarksFile = async () => {
  try {
    await fs.access(MARKS_FILE);
  } catch {
    await fs.writeFile(MARKS_FILE, JSON.stringify([]));
  }
};

// Read marks from JSON file
const readMarks = async () => {
  try {
    await ensureMarksFile();
    const data = await fs.readFile(MARKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('readMarks error:', error);
    throw new Error(`Failed to read marks: ${error.message}`);
  }
};

// Write marks to JSON file
const writeMarks = async (marks) => {
  try {
    await ensureMarksFile();
    await fs.writeFile(MARKS_FILE, JSON.stringify(marks, null, 2));
  } catch (error) {
    console.error('writeMarks error:', error);
    throw new Error(`Failed to write marks: ${error.message}`);
  }
};

// Calculate grade based on marks
const calculateGrade = (marks) => {
  if (marks >= 90) return 'A';
  if (marks >= 80) return 'B';
  if (marks >= 70) return 'C';
  if (marks >= 60) return 'D';
  return 'F';
};

// POST /marks: Create or update marks for a student (Admin/Teacher only)
router.post('/', authenticate, async (req, res) => {
  const { userId, subject, marks } = req.body;

  if (req.user.userType !== 'Admin' && req.user.userType !== 'Teacher') {
    return res.status(403).json({ message: 'Only Admins or Teachers can update marks' });
  }

  if (!userId || !subject || marks === undefined) {
    return res.status(400).json({ message: 'userId, subject, and marks are required' });
  }

  if (typeof marks !== 'number' || marks < 0 || marks > 100) {
    return res.status(400).json({ message: 'Marks must be a number between 0 and 100' });
  }

  const validSubjects = ['Math', 'Science', 'English'];
  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ message: `Subject must be one of: ${validSubjects.join(', ')}` });
  }

  try {
    const allMarks = await readMarks();
    const existingMarkIndex = allMarks.findIndex(
      (m) => m.userId === parseInt(userId) && m.subject === subject
    );

    const markEntry = {
      userId: parseInt(userId),
      subject,
      marks,
      grade: calculateGrade(marks),
      updatedBy: req.user.id,
      updatedAt: new Date().toISOString(),
    };

    if (existingMarkIndex >= 0) {
      allMarks[existingMarkIndex] = markEntry;
    } else {
      allMarks.push(markEntry);
    }

    await writeMarks(allMarks);
    res.status(201).json(markEntry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /marks/:userId: Retrieve marks for a student
router.get('/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;

  if (
    req.user.userType !== 'Admin' &&
    req.user.userType !== 'Teacher' &&
    req.user.id !== parseInt(userId)
  ) {
    return res.status(403).json({ message: 'Unauthorized to view these marks' });
  }

  try {
    const allMarks = await readMarks();
    const userMarks = allMarks.filter((m) => m.userId === parseInt(userId));
    res.json(userMarks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;