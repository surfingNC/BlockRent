const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const User = require('../models/User.js');

// Register route
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Basic input validation
  if (!username || !password) {
    return res.status(400).json({ msg: 'Username and password are required' });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the new user
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ msg: 'User created successfully' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
