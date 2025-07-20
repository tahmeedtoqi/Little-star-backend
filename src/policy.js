const express = require('express');
const router = express.Router();
const { authenticate } = require('../src/middleware/middleware');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');

// Ensure uploads directory exists
fs.mkdir(UPLOADS_DIR, { recursive: true });

// Configure Multer storage with file filter for PDF and DOCX
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// File filter to allow only PDF and DOCX
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf' || ext === '.docx') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Ensure policies.json exists
const ensurePoliciesFile = async () => {
  try {
    await fs.access(POLICIES_FILE);
  } catch {
    await fs.writeFile(POLICIES_FILE, JSON.stringify([]));
  }
};

// Read policies from JSON file
const readPolicies = async () => {
  try {
    await ensurePoliciesFile();
    const data = await fs.readFile(POLICIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('readPolicies error:', error);
    throw new Error(`Failed to read policies: ${error.message}`);
  }
};

// Write policies to JSON file
const writePolicies = async (policies) => {
  try {
    await ensurePoliciesFile();
    await fs.writeFile(POLICIES_FILE, JSON.stringify(policies, null, 2));
  } catch (error) {
    console.error('writePolicies error:', error);
    throw new Error(`Failed to write policies: ${error.message}`);
  }
};

// POST /policies: Upload a new policy/notice (Admin-only)
router.post('/', authenticate, upload.single('file'), handleMulterError, async (req, res) => {
  if (req.user.userType !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can upload policies' });
  }
  const { description } = req.body;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const policies = await readPolicies();
  const newPolicy = {
    id: policies.length + 1,
    fileName: file.filename,
    uploadedBy: req.user.id,
    uploadDate: new Date().toISOString(),
    description: description || '',
  };
  policies.push(newPolicy);
  await writePolicies(policies);
  res.status(201).json(newPolicy);
});

// GET /policies: List all policies
router.get('/', async (req, res) => {
  const policies = await readPolicies();
  res.json(policies);
});

// GET /policies/:id: Download a specific policy
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const policies = await readPolicies();
  const policy = policies.find(p => p.id === parseInt(id));
  if (!policy) {
    return res.status(404).json({ message: 'Policy not found' });
  }
  const filePath = path.join(UPLOADS_DIR, policy.fileName);
  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ message: 'File not found' });
  }
  res.download(filePath);
});

module.exports = router;