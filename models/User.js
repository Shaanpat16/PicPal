const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  username: { type: String, required: true },
  email: String,
  password: String,
  bio: { type: String, default: "" },
  profilePic: String,
  private: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  theme: { type: String, default: 'light' }
});

module.exports = mongoose.model('User', userSchema);

