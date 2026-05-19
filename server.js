require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_ENABLE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectTimeout: 10000
});

app.set('db', pool);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/stats', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const userCount = rows[0].count;
    res.json({ trainedProfessionals: 22000 + userCount });
  } catch (err) {
    res.json({ trainedProfessionals: 22000 });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let onlineUsers = 0;
io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('online-count', onlineUsers);
  socket.on('chat-message', (msg) => {
    io.emit('chat-message', { user: msg.user, text: msg.text, time: new Date() });
  });
  socket.on('disconnect', () => {
    onlineUsers--;
    io.emit('online-count', onlineUsers);
  });
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password VARCHAR(255) NOT NULL,
        interest VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        inquiryType VARCHAR(100),
        message TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ MySQL tables ready');
  } finally {
    conn.release();
  }
}

const PORT = process.env.PORT || 5000;
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize DB:', err);
    process.exit(1);
  });
