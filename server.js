// server.js

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  profilePic: String,  // New field for profile picture URL
  bio: String,         // New field for user bio
});

const imageSchema = new mongoose.Schema({
  url: String,
  public_id: String,
  userId: String,
  username: String,
  likes: { type: Number, default: 0 },
  likedBy: [String],
  comments: [{ username: String, text: String }],
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Image = mongoose.model('Image', imageSchema);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middlewares
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    crypto: { secret: process.env.SESSION_SECRET },
  }),
}));

// Auth routes
app.post('/signup', async (req, res) => {
  const { username, password, bio } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already taken' });

    const user = new User({ username, password, bio });
    await user.save();
    req.session.user = { _id: user._id, username: user.username };
    res.json({ message: 'Signed up' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.user = { _id: user._id, username: user.username };
    res.json({ message: 'Logged in' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Upload profile picture
app.post('/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize(200, 200, { fit: sharp.fit.cover })
      .jpeg({ quality: 80 })
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'picpal_profiles' },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      streamifier.createReadStream(processedBuffer).pipe(uploadStream);
    });

    const user = await User.findById(req.session.user._id);
    user.profilePic = result.secure_url;
    await user.save();

    res.json({ message: 'Profile picture updated', profilePic: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Update bio
app.post('/update-bio', async (req, res) => {
  const { bio } = req.body;
  if (!bio) return res.status(400).json({ message: 'Bio required' });

  try {
    const user = await User.findById(req.session.user._id);
    user.bio = bio;
    await user.save();

    res.json({ message: 'Bio updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update bio' });
  }
});

// Fetch images
app.get('/images', async (req, res) => {
  try {
    const images = await Image.find({}).sort({ timestamp: -1 });
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch images' });
  }
});

app.get('/my-images', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const images = await Image.find({ userId: req.session.user._id }).sort({ timestamp: -1 });
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch my images' });
  }
});

// Fetch user profile
app.get('/user/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const images = await Image.find({ userId: user._id }).sort({ timestamp: -1 });
    res.json({ user, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Delete account
app.delete('/delete-account', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = await User.findById(req.session.user._id);
    await user.deleteOne();
    req.session.destroy();
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.listen(PORT, () => {
  console.log(`🚀 PicPal running at http://localhost:${PORT}`);
});