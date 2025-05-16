const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: String,
  isPrivate: Boolean,
  joinCode: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }]
});

module.exports = mongoose.model('Group', groupSchema);

