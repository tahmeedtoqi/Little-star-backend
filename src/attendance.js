const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const router = express.Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

// Helper to ensure data directory and attendance file exist
const ensureDataDirAndFile = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(ATTENDANCE_FILE);
    } catch {
      await fs.writeFile(ATTENDANCE_FILE, JSON.stringify([]));
    }
  } catch (error) {
    console.error('ensureDataDirAndFile error:', error);
    throw new Error(`Failed to ensure data directory/file: ${error.message}`);
  }
};

// Helper to read attendance from JSON file
const readAttendance = async () => {
  try {
    await ensureDataDirAndFile();
    const data = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const attendance = JSON.parse(data);
    console.log('Read attendance.json:', attendance);
    return attendance;
  } catch (error) {
    console.error('readAttendance error:', error);
    throw new Error(`Failed to read attendance: ${error.message}`);
  }
};

// Helper to write attendance to JSON file
const writeAttendance = async (attendance) => {
  try {
    await ensureDataDirAndFile();
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(attendance, null, 2));
    console.log('Wrote to attendance.json:', attendance);
  } catch (error) {
    console.error('writeAttendance error:', error);
    throw new Error(`Failed to write attendance: ${error.message}`);
  }
};

// JWT middleware to authenticate and verify userType
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains id, email, userType
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// POST /attendance - Create or update attendance and export to Excel (Admin or Teacher only)
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId, attendance } = req.body;
    if (req.user.userType !== 'Admin' && req.user.userType !== 'Teacher') {
      return res.status(403).json({ message: 'Only Admins or Teachers can modify attendance' });
    }
    if (!userId || !attendance || typeof attendance !== 'object') {
      return res.status(400).json({ message: 'userId and attendance object are required' });
    }

    // Validate attendance object
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of Object.keys(attendance)) {
      if (!validDays.includes(day) || typeof attendance[day] !== 'boolean') {
        return res.status(400).json({ message: 'Attendance must contain valid days with boolean values' });
      }
    }

    const accounts = require('./accounts');
    if (!accounts.readUsers) {
      throw new Error('readUsers function not found in accounts module');
    }
    const users = await accounts.readUsers();
    const user = users.find(u => u.id === userId);
    if (!user || (user.userType !== 'Teacher' && user.userType !== 'Student')) {
      return res.status(400).json({ message: 'Invalid userId or user is not a Teacher/Student' });
    }

    const attendanceRecords = await readAttendance();
    const existingRecord = attendanceRecords.find(record => record.userId === userId);
    if (existingRecord) {
      existingRecord.attendance = attendance;
    } else {
      attendanceRecords.push({
        userId,
        name: user.email, // Use email as name
        userType: user.userType,
        attendance
      });
    }

    await writeAttendance(attendanceRecords);

    // Generate Excel file for export
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');

    // Define columns
    worksheet.columns = [
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'User Type', key: 'userType', width: 15 },
      { header: 'Monday', key: 'Monday', width: 10 },
      { header: 'Tuesday', key: 'Tuesday', width: 10 },
      { header: 'Wednesday', key: 'Wednesday', width: 10 },
      { header: 'Thursday', key: 'Thursday', width: 10 },
      { header: 'Friday', key: 'Friday', width: 10 },
      { header: 'Saturday', key: 'Saturday', width: 10 },
      { header: 'Sunday', key: 'Sunday', width: 10 },
    ];

    // Add rows
    attendanceRecords.forEach(record => {
      worksheet.addRow({
        userId: record.userId,
        name: record.name,
        userType: record.userType,
        ...record.attendance
      });
    });

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for download
    res.status(201);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Attendance POST error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /attendance/:userId - Retrieve attendance for a user
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.userType !== 'Admin' && req.user.userType !== 'Teacher' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const attendanceRecords = await readAttendance();
    const record = attendanceRecords.find(r => r.userId === parseInt(userId));
    if (!record) {
      return res.status(404).json({ message: 'Attendance not found' });
    }

    res.json(record);
  } catch (error) {
    console.error('Attendance GET error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;