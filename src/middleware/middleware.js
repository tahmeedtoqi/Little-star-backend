const jwt = require('jsonwebtoken');
const { readUsers } = require('../accounts');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { authenticate };