const express = require('express');
const router = express.Router();
const { authenticate } = require('../src/middleware/middleware');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

fs.mkdir(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

const ensureDocumentsFile = async () => {
  try {
    await fs.access(DOCUMENTS_FILE);
  } catch {
    await fs.writeFile(DOCUMENTS_FILE, JSON.stringify([]));
  }
};

const readDocuments = async () => {
  try {
    await ensureDocumentsFile();
    const data = await fs.readFile(DOCUMENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('readDocuments error:', error);
    throw new Error(`Failed to read documents: ${error.message}`);
  }
};

const writeDocuments = async (documents) => {
  try {
    await ensureDocumentsFile();
    await fs.writeFile(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));
  } catch (error) {
    console.error('writeDocuments error:', error);
    throw new Error(`Failed to write documents: ${error.message}`);
  }
};

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (req.user.userType !== 'Teacher') {
    return res.status(403).json({ message: 'Only Teachers can upload documents' });
  }
  const { description } = req.body;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const documents = await readDocuments();
  const newDocument = {
    id: documents.length + 1,
    fileName: file.filename,
    uploadedBy: req.user.id,
    uploadDate: new Date().toISOString(),
    description: description || '',
  };
  documents.push(newDocument);
  await writeDocuments(documents);
  res.status(201).json(newDocument);
});

router.get('/', async (req, res) => {
  const documents = await readDocuments();
  res.json(documents);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const documents = await readDocuments();
  const document = documents.find(d => d.id === parseInt(id));
  if (!document) {
    return res.status(404).json({ message: 'Document not found' });
  }
  const filePath = path.join(UPLOADS_DIR, document.fileName);
  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ message: 'File not found' });
  }
  res.download(filePath);
});

module.exports = router;