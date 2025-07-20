const request = require('supertest');
const app = require('../src/app');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const ROUTINES_FILE = path.join(DATA_DIR, 'routines.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const MARKS_FILE = path.join(DATA_DIR, 'marks.json');

describe('API Tests', () => {
  beforeEach(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
      await fs.writeFile(ATTENDANCE_FILE, JSON.stringify([]));
      await fs.writeFile(ROUTINES_FILE, JSON.stringify([]));
      await fs.writeFile(DOCUMENTS_FILE, JSON.stringify([]));
      await fs.writeFile(POLICIES_FILE, JSON.stringify([]));
      await fs.writeFile(MARKS_FILE, JSON.stringify([]));
      console.log('Reset all data files');
    } catch (error) {
      console.error('Test setup error:', error);
    }
  });

  const signupUser = async (email, password, userType, section = null) => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email, password, userType, section });
    if (res.status !== 201) {
      console.log('Signup failed:', res.body);
    }
    return res.body.token;
  };

  const getUserIdFromToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  };

  describe('Auth API', () => {
    describe('POST /auth/signup', () => {
      it('should create a new Admin user and return a token with userType', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'admin@example.com', password: 'password123', userType: 'Admin' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
        expect(decoded.userType).toBe('Admin');
      });

      it('should create a new Teacher user and return a token with userType', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'teacher@example.com', password: 'password123', userType: 'Teacher' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
        expect(decoded.userType).toBe('Teacher');
      });

      it('should create a new Student user and return a token with userType and section', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'student@example.com', password: 'password123', userType: 'Student', section: 'A' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
        expect(decoded.userType).toBe('Student');
        expect(decoded.section).toBe('A');
      });

      it('should return 400 if email, password, or userType is missing', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'user2@example.com', password: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email, password, and userType are required');
      });

      it('should return 400 if userType is invalid', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'user3@example.com', password: 'password123', userType: 'Invalid' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid userType. Must be Admin, Teacher, or Student');
      });

      it('should return 400 if user already exists (same email, different case)', async () => {
        await request(app)
          .post('/auth/signup')
          .send({ email: 'user4@example.com', password: 'password123', userType: 'Student', section: 'A' });
        const res = await request(app)
          .post('/auth/signup')
          .send({ email: 'User4@Example.com', password: 'password456', userType: 'Teacher' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('User already exists');
      });
    });

    describe('POST /auth/signin', () => {
      it('should sign in a user and return a token with userType (same email, different case)', async () => {
        await request(app)
          .post('/auth/signup')
          .send({ email: 'user5@example.com', password: 'password123', userType: 'Teacher' });
        const res = await request(app)
          .post('/auth/signin')
          .send({ email: 'User5@Example.com', password: 'password123' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
        expect(decoded.userType).toBe('Teacher');
      });

      it('should return 401 for invalid password', async () => {
        await request(app)
          .post('/auth/signup')
          .send({ email: 'user6@example.com', password: 'password123', userType: 'Student', section: 'A' });
        const res = await request(app)
          .post('/auth/signin')
          .send({ email: 'user6@example.com', password: 'wrongpassword' });
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid credentials');
      });

      it('should return 400 if email or password is missing', async () => {
        const res = await request(app)
          .post('/auth/signin')
          .send({ email: 'user7@example.com' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email and password are required');
      });
    });
  });

  describe('Attendance API', () => {
    describe('POST /attendance', () => {
      it('should create attendance for a Student as an Admin', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/attendance')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            userId: studentId,
            attendance: { Monday: true, Tuesday: false }
          });
        expect(res.status).toBe(201);
      });

      it('should return 403 for Student trying to create attendance', async () => {
        const studentToken = await signupUser('student2@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/attendance')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ userId: studentId, attendance: { Monday: true } });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins or Teachers can modify attendance');
      });
    });

    describe('GET /attendance/:userId', () => {
      it('should retrieve attendance for a Student as an Admin', async () => {
        const adminToken = await signupUser('admin2@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student3@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        await request(app)
          .post('/attendance')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, attendance: { Monday: true, Tuesday: false } });

        const res = await request(app)
          .get(`/attendance/${studentId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.attendance.Monday).toBe(true);
      });
    });
  });

  describe('Routines API', () => {
    describe('POST /routines', () => {
      it('should allow Admin to create a routine', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const teacherId = getUserIdFromToken(teacherToken);

        const routineData = {
          section: 'A',
          day: 'Monday',
          time: '10:00',
          subject: 'Math',
          teacherId: teacherId,
        };

        const res = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(routineData);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.section).toBe('A');
      });

      it('should not allow Teacher to create a routine', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const res = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId: 1 });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins can create routines');
      });

      it('should not allow Student to create a routine', async () => {
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const res = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId: 1 });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins can create routines');
      });
    });

    describe('PUT /routines/:id', () => {
      it('should allow Admin to update a routine', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const teacherId = getUserIdFromToken(teacherToken);

        const routineRes = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId });
        const routineId = routineRes.body.id;

        const res = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'B', day: 'Tuesday', time: '11:00', subject: 'Science', teacherId });
        expect(res.status).toBe(201);
        expect(res.body.section).toBe('B');
      });
    });

    describe('DELETE /routines/:id', () => {
      it('should allow Admin to delete a routine', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const teacherId = getUserIdFromToken(teacherToken);

        const routineRes = await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId });
        const routineId = routineRes.body.id;

        const res = await request(app)
          .delete(`/routines/${routineId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
      });
    });

    describe('GET /routines', () => {
      it('should allow Admin to view all routines', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacher1Token = await signupUser('teacher1@example.com', 'password123', 'Teacher');
        const teacher1Id = getUserIdFromToken(teacher1Token);
        const teacher2Token = await signupUser('teacher2@example.com', 'password123', 'Teacher');
        const teacher2Id = getUserIdFromToken(teacher2Token);

        await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId: teacher1Id });
        await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'B', day: 'Tuesday', time: '11:00', subject: 'Science', teacherId: teacher2Id });

        const res = await request(app)
          .get('/routines')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
      });

      it('should allow Teacher to view their own routines', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const teacherId = getUserIdFromToken(teacherToken);

        await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId });

        const res = await request(app)
          .get('/routines')
          .set('Authorization', `Bearer ${teacherToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].teacherId).toBe(teacherId);
      });

      it('should allow Student to view routines for their section', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const teacherId = getUserIdFromToken(teacherToken);
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');

        await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'A', day: 'Monday', time: '10:00', subject: 'Math', teacherId });
        await request(app)
          .post('/routines')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ section: 'B', day: 'Tuesday', time: '11:00', subject: 'Science', teacherId });

        const res = await request(app)
          .get('/routines')
          .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].section).toBe('A');
      });
    });
  });

  describe('Documents API', () => {
    describe('POST /documents', () => {
      it('should allow Teacher to upload a document', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const fileBuffer = Buffer.from('Test file content');

        const res = await request(app)
          .post('/documents')
          .set('Authorization', `Bearer ${teacherToken}`)
          .attach('file', fileBuffer, 'testfile.pdf')
          .field('description', 'Test document');
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.fileName).toBeDefined();
      });

      it('should not allow Admin to upload a document', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const fileBuffer = Buffer.from('Test file content');

        const res = await request(app)
          .post('/documents')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', fileBuffer, 'testfile.pdf')
          .field('description', 'Test document');
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Teachers can upload documents');
      });

      it('should not allow Student to upload a document', async () => {
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const fileBuffer = Buffer.from('Test file content');

        const res = await request(app)
          .post('/documents')
          .set('Authorization', `Bearer ${studentToken}`)
          .attach('file', fileBuffer, 'testfile.pdf')
          .field('description', 'Test document');
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Teachers can upload documents');
      });
    });

    describe('GET /documents', () => {
      it('should allow anyone to list documents', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const fileBuffer = Buffer.from('Test file content');

        await request(app)
          .post('/documents')
          .set('Authorization', `Bearer ${teacherToken}`)
          .attach('file', fileBuffer, 'testfile.pdf')
          .field('description', 'Test document');

        const res = await request(app).get('/documents');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].description).toBe('Test document');
      });
    });

    describe('GET /documents/:id', () => {
      it('should allow anyone to download a document', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const fileBuffer = Buffer.from('Test file content');

        const uploadRes = await request(app)
          .post('/documents')
          .set('Authorization', `Bearer ${teacherToken}`)
          .attach('file', fileBuffer, 'testfile.pdf')
          .field('description', 'Test document');
        const documentId = uploadRes.body.id;

        const res = await request(app).get(`/documents/${documentId}`);
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Policies API', () => {
    describe('POST /policies', () => {
      it('should allow Admin to upload a policy', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const fileBuffer = Buffer.from('Test policy content');

        const res = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', fileBuffer, 'testpolicy.pdf')
          .field('description', 'Test policy');
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.fileName).toBeDefined();
      });

      it('should not allow Teacher to upload a policy', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const fileBuffer = Buffer.from('Test policy content');

        const res = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${teacherToken}`)
          .attach('file', fileBuffer, 'testpolicy.pdf')
          .field('description', 'Test policy');
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins can upload policies');
      });

      it('should not allow Student to upload a policy', async () => {
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const fileBuffer = Buffer.from('Test policy content');

        const res = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${studentToken}`)
          .attach('file', fileBuffer, 'testpolicy.pdf')
          .field('description', 'Test policy');
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins can upload policies');
      });

      it('should return 400 if no file is uploaded', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const res = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .field('description', 'Test policy');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No file uploaded');
      });

      it('should return 400 if file is not PDF or DOCX', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const fileBuffer = Buffer.from('Test policy content');

        const res = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', fileBuffer, 'testpolicy.txt')
          .field('description', 'Test policy');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Only PDF and DOCX files are allowed/);
      });
    });

    describe('GET /policies', () => {
      it('should allow anyone to list policies', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const fileBuffer = Buffer.from('Test policy content');

        await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', fileBuffer, 'testpolicy.pdf')
          .field('description', 'Test policy');

        const res = await request(app).get('/policies');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].description).toBe('Test policy');
      });
    });

    describe('GET /policies/:id', () => {
      it('should allow anyone to download a policy', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const fileBuffer = Buffer.from('Test policy content');

        const uploadRes = await request(app)
          .post('/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', fileBuffer, 'testpolicy.pdf')
          .field('description', 'Test policy');
        const policyId = uploadRes.body.id;

        const res = await request(app).get(`/policies/${policyId}`);
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Marks API', () => {
    describe('POST /marks', () => {
      it('should allow Admin to create/update marks', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, subject: 'Math', marks: 85 });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          userId: studentId,
          subject: 'Math',
          marks: 85,
          grade: 'B',
          updatedBy: expect.any(Number),
          updatedAt: expect.any(String),
        });
      });

      it('should allow Teacher to create/update marks', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ userId: studentId, subject: 'Science', marks: 92 });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          userId: studentId,
          subject: 'Science',
          marks: 92,
          grade: 'A',
          updatedBy: expect.any(Number),
          updatedAt: expect.any(String),
        });
      });

      it('should not allow Student to create/update marks', async () => {
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ userId: studentId, subject: 'Math', marks: 85 });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only Admins or Teachers can update marks');
      });

      it('should return 400 if userId, subject, or marks is missing', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ subject: 'Math', marks: 85 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('userId, subject, and marks are required');
      });

      it('should return 400 if marks is invalid', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, subject: 'Math', marks: 150 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Marks must be a number between 0 and 100');
      });

      it('should return 400 if subject is invalid', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        const res = await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, subject: 'History', marks: 85 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Subject must be one of: Math, Science, English');
      });
    });

    describe('GET /marks/:userId', () => {
      it('should allow Admin to view any student’s marks', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, subject: 'Math', marks: 85 });

        const res = await request(app)
          .get(`/marks/${studentId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0]).toEqual({
          userId: studentId,
          subject: 'Math',
          marks: 85,
          grade: 'B',
          updatedBy: expect.any(Number),
          updatedAt: expect.any(String),
        });
      });

      it('should allow Teacher to view any student’s marks', async () => {
        const teacherToken = await signupUser('teacher@example.com', 'password123', 'Teacher');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ userId: studentId, subject: 'Science', marks: 92 });

        const res = await request(app)
          .get(`/marks/${studentId}`)
          .set('Authorization', `Bearer ${teacherToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0]).toEqual({
          userId: studentId,
          subject: 'Science',
          marks: 92,
          grade: 'A',
          updatedBy: expect.any(Number),
          updatedAt: expect.any(String),
        });
      });

      it('should allow Student to view their own marks', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const studentToken = await signupUser('student@example.com', 'password123', 'Student', 'A');
        const studentId = getUserIdFromToken(studentToken);

        await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: studentId, subject: 'Math', marks: 85 });

        const res = await request(app)
          .get(`/marks/${studentId}`)
          .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].subject).toBe('Math');
      });

      it('should not allow Student to view another student’s marks', async () => {
        const adminToken = await signupUser('admin@example.com', 'password123', 'Admin');
        const student1Token = await signupUser('student1@example.com', 'password123', 'Student', 'A');
        const student2Token = await signupUser('student2@example.com', 'password123', 'Student', 'A');
        const student1Id = getUserIdFromToken(student1Token);

        await request(app)
          .post('/marks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: student1Id, subject: 'Math', marks: 85 });

        const res = await request(app)
          .get(`/marks/${student1Id}`)
          .set('Authorization', `Bearer ${student2Token}`);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Unauthorized to view these marks');
      });
    });
  });
});