const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id).populate('followers following', 'username profilePic');
  res.json(user);
});

router.post('/update-bio', async (req, res) => {
  const { userId, bio } = req.body;
  await User.findByIdAndUpdate(userId, { bio });
  res.sendStatus(200);
});

module.exports = router;

