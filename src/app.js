require('dotenv').config(); // Add this at the top
const express = require('express');
const authRoutes = require('./accounts');
const attendanceRoutes = require('./attendance');
const routinesRoutes = require('./routine');
const documentsRoutes = require('./docs');
const policiesRoutes = require('./policy');
const marksRoutes = require('./marks');
const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For form-data (needed for multer)
app.use('/auth', authRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/documents', documentsRoutes);
app.use('/routines', routinesRoutes);
app.use('/policies', policiesRoutes);
app.use('/marks', marksRoutes);

app.get('/', (req, res) => res.send('API is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;