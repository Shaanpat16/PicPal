// Import necessary modules
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const bcrypt = require('bcrypt');  // Password hashing
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
  bio: { type: String, default: '' },
  profilePic: { type: String, default: '' }, // Profile picture URL
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

// Helper function to check if the user is logged in
const isLoggedIn = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Auth routes

// Signup
app.post('/signup', async (req, res) => {
  const { username, password, bio } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already taken' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password with a salt

    const user = new User({ username, password: hashedPassword, bio });
    await user.save();

    req.session.user = { _id: user._id, username: user.username };  // Store user info in session
    res.json({ message: 'Signed up successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  try {
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Compare passwords
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.user = { _id: user._id, username: user.username }; // Store user info in session
    res.json({ message: 'Logged in successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Logout
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

// Image upload
app.post('/upload', isLoggedIn, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

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
    console.error(err);
    res.status(500).json({ message: 'Upload failed' });
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

// Fetch user images
app.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const images = await Image.find({ userId: user._id });

    res.json({ username: user.username, bio: user.bio, profilePic: user.profilePic, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Update Profile Picture
app.post('/update-profile-picture', isLoggedIn, upload.single('profilePic'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize(200, 200, { fit: sharp.fit.cover })
      .jpeg({ quality: 80 })
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'picpal_profile_pics' },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      streamifier.createReadStream(processedBuffer).pipe(uploadStream);
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { profilePic: result.secure_url },
      { new: true }
    );

    req.session.user.profilePic = updatedUser.profilePic;

    res.json({ message: 'Profile picture updated', profilePic: updatedUser.profilePic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile picture' });
  }
});

// Update Username and Password
app.put('/update-account', isLoggedIn, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash new password

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { username, password: hashedPassword },
      { new: true }
    );

    req.session.user.username = updatedUser.username;

    res.json({ message: 'Account updated', username: updatedUser.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update account' });
  }
});

// Delete Account
app.delete('/delete-account', isLoggedIn, async (req, res) => {
  try {
    // Delete all user images
    await Image.deleteMany({ userId: req.session.user._id });

    // Delete the user account
    await User.findByIdAndDelete(req.session.user._id);

    req.session.destroy(err => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to delete account' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Account and all photos deleted' });
    });
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
