require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const Canvas = require('./models/Canvas');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const memoryDb = new Map();
const userMemoryDb = new Map(); // fallback for users
global.useMemoryDb = false;

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_sddraw';

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection failed. Using in-memory fallback.');
    global.useMemoryDb = true;
  });

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (global.useMemoryDb) {
      if (Array.from(userMemoryDb.values()).find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      const userId = Date.now().toString();
      const hashedPassword = await bcrypt.hash(password, 10);
      userMemoryDb.set(userId, { id: userId, username, password: hashedPassword });
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, username });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (global.useMemoryDb) {
      const user = Array.from(userMemoryDb.values()).find(u => u.username === username);
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, username });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load Canvas State
app.get('/api/canvas', authMiddleware, async (req, res) => {
  try {
    if (global.useMemoryDb) {
      const elements = memoryDb.get(req.userId) || [];
      return res.json(elements);
    }
    const canvas = await Canvas.findOne({ userId: req.userId });
    if (!canvas) {
      return res.status(404).json({ message: 'Canvas not found' });
    }
    res.json(canvas.elements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save Canvas State
app.put('/api/canvas', authMiddleware, async (req, res) => {
  try {
    const { elements } = req.body;
    if (global.useMemoryDb) {
      memoryDb.set(req.userId, elements);
      return res.json({ message: 'Saved to in-memory db (MongoDB offline)' });
    }
    const canvas = await Canvas.findOneAndUpdate(
      { userId: req.userId },
      { elements, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    res.json({ message: 'Canvas saved successfully', canvas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for React Router - serve index.html for all non-API routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
