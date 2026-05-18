const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { name, email, phone, inquiryType, message } = req.body;
    await db.query(
      'INSERT INTO contacts (name, email, phone, inquiryType, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, inquiryType, message]
    );
    res.status(201).json({ message: 'Ujumbe wako umepokelewa, tutawasiliana haraka!' });
  } catch (err) {
    res.status(500).json({ message: 'Hitilafu ya kuhifadhi ujumbe' });
  }
});

module.exports = router;