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

// Check required environment variables
['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SESSION_SECRET'].forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
});

// MongoDB connection with retry
const connectWithRetry = () => {
  console.log('🔄 Attempting MongoDB connection...');
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⏳ Retrying in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};
connectWithRetry();

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
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
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native',
  }),
}));

// Routes

// Sign Up
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already taken' });

    const user = new User({ username, password });
    await user.save();
    req.session.user = { _id: user._id, username: user.username };
    res.json({ message: 'Signed up' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.user = { _id: user._id, username: user.username };
    res.json({ message: 'Logged in' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Upload Image
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, { fit: sharp.fit.cover })
      .jpeg({ quality: 80 })
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'picpal_uploads' },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      streamifier.createReadStream(processedBuffer).pipe(uploadStream);
    });

    const newImage = new Image({
      url: result.secure_url,
      public_id: result.public_id,
      userId: req.session.user._id,
      username: req.session.user.username,
    });

    await newImage.save();
    res.json({ message: 'Image uploaded', image: newImage });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all images
app.get('/images', async (req, res) => {
  try {
    const images = await Image.find({}).sort({ timestamp: -1 });
    res.json(images);
  } catch (err) {
    console.error('Fetch images error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get my images
app.get('/my-images', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const images = await Image.find({ userId: req.session.user._id });
    res.json(images);
  } catch (err) {
    console.error('Fetch my-images error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Like an image
app.post('/like/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    if (image.likedBy.includes(req.session.user._id)) {
      return res.status(400).json({ error: 'Already liked' });
    }

    image.likes += 1;
    image.likedBy.push(req.session.user._id);
    await image.save();

    res.json({ message: 'Liked' });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like image' });
  }
});

// Delete an image
app.delete('/delete/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const image = await Image.findById(req.params.id);
    if (!image || image.userId !== req.session.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await cloudinary.uploader.destroy(image.public_id);
    await image.deleteOne();

    res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Comment on image
app.post('/comment/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });

  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    image.comments.push({ username: req.session.user.username, text });
    await image.save();

    res.json({ message: 'Comment added' });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to comment' });
  }
});

// Frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PicPal running at http://localhost:${PORT}`);
});