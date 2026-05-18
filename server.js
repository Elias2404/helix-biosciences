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

// Socket.IO with dynamic CORS (allows all for now, tighten in production)
const io = socketIo(server, {
  cors: { origin: "*" }
});

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || undefined,
  database: process.env.DB_NAME || 'helix_pro',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Make pool accessible to routes
app.set('db', pool);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' folder (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);

// Health check + live stats
app.get('/api/stats', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const userCount = rows[0].count;
    res.json({ trainedProfessionals: 22000 + userCount });
  } catch (err) {
    console.error('Stats error:', err);
    res.json({ trainedProfessionals: 22000 });
  }
});

// Handle all other routes by serving index.html (for SPA-like behaviour)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO real-time features
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

// Create database tables if they don't exist
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

// Start server after DB initialization
const PORT = process.env.PORT || 5000;
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Open http://localhost:${PORT} to view the app`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });