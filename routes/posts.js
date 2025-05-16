const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');

router.get('/', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }).populate('user', 'username profilePic');
  res.json(posts);
});

router.post('/', async (req, res) => {
  const { userId, media, caption, hashtags } = req.body;
  const newPost = new Post({ user: userId, media, caption, hashtags });
  await newPost.save();
  res.status(201).json(newPost);
});

module.exports = router;

