const express = require('express');
const router = express.Router();
const Group = require('../models/Group');

router.post('/create', async (req, res) => {
  const { name, isPrivate } = req.body;
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const group = new Group({ name, isPrivate, joinCode });
  await group.save();
  res.status(201).json(group);
});

module.exports = router;

