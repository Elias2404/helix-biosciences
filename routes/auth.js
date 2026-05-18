const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { fullName, email, phone, password, interest } = req.body;

    // Check if user exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email tayari imesajiliwa' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      'INSERT INTO users (fullName, email, phone, password, interest) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, phone, hashedPassword, interest]
    );

    const token = jwt.sign({ userId: result.insertId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.insertId, name: fullName, email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Hitilafu ya seva' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { email, password } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email au nenosiri si sahihi' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email au nenosiri si sahihi' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.fullName, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Hitilafu ya seva' });
  }
});

module.exports = router;
