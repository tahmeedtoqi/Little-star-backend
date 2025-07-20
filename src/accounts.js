const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const VALID_USER_TYPES = ['Admin', 'Teacher', 'Student'];

const ensureDataDirAndFile = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
    }
  } catch (error) {
    throw new Error(`Failed to ensure data directory/file: ${error.message}`);
  }
};

const readUsers = async () => {
  try {
    await ensureDataDirAndFile();
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(data);
    console.log('Read users.json:', users);
    return users;
  } catch (error) {
    console.error('readUsers error:', error);
    throw new Error(`Failed to read users: ${error.message}`);
  }
};

const writeUsers = async (users) => {
  try {
    await ensureDataDirAndFile();
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Wrote to users.json:', users);
  } catch (error) {
    console.error('writeUsers error:', error);
    throw new Error(`Failed to write users: ${error.message}`);
  }
};

router.post('/signup', async (req, res) => {
  try {
    const { email, password, userType, section } = req.body;
    console.log('Signup attempt:', { email, userType });
    if (!email || !password || !userType) {
      console.log('Missing fields:', { email, password, userType });
      return res.status(400).json({ message: 'Email, password, and userType are required' });
    }
    if (userType === 'Student' && !section) {
      console.log('Section missing for Student');
      return res.status(400).json({ message: 'Section is required for Students' });
    }
    if (!VALID_USER_TYPES.includes(userType)) {
      console.log('Invalid userType:', userType);
      return res.status(400).json({ message: 'Invalid userType. Must be Admin, Teacher, or Student' });
    }

    const users = await readUsers();
    if (users.find(user => user.email.toLowerCase() === email.toLowerCase())) {
      console.log('Duplicate email detected:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      userType,
      ...(userType === 'Student' && { section }),
    };
    users.push(newUser);
    await writeUsers(users);

    const tokenPayload = { id: newUser.id, email, userType };
    if (userType === 'Student') {
      tokenPayload.section = section;
    }
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Signin attempt:', { email });
    if (!email || !password) {
      console.log('Missing fields:', { email, password });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const users = await readUsers();
    const user = users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('Invalid credentials for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, userType: user.userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.readUsers = readUsers;