// server.js (with MongoDB)

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

// Auth routes
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).json({ error: 'Username already exists' });

  const user = new User({ username, password });
  await user.save();
  req.session.user = user;
  res.json({ message: 'Signed up' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = user;
  res.json({ message: 'Logged in' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

// Upload route
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800, height: 800, fit: 'cover' })
      .jpeg()
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'picpal_uploads' },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(processedBuffer).pipe(stream);
    });

    const newImage = new Image({
      url: result.secure_url,
      public_id: result.public_id,
      userId: req.session.user._id,
      username: req.session.user.username,
    });

    await newImage.save();
    res.json({ message: 'Uploaded', image: newImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all images
app.get('/images', async (req, res) => {
  const images = await Image.find({}).sort({ timestamp: -1 });
  res.json(images);
});

// Get my images
app.get('/my-images', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const images = await Image.find({ userId: req.session.user._id });
  res.json(images);
});

// Like an image
app.post('/like/:id', async (req, res) => {
  const image = await Image.findById(req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  image.likes += 1;
  await image.save();
  res.json({ message: 'Liked' });
});

// Delete an image
app.delete('/delete/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const image = await Image.findById(req.params.id);
  if (!image || image.userId !== req.session.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await Image.findByIdAndDelete(req.params.id);

  try {
    await cloudinary.uploader.destroy(image.public_id);
  } catch (err) {
    console.error('Cloudinary deletion error:', err);
  }

  res.json({ message: 'Deleted' });
});

// Comment on image
app.post('/comment/:id', async (req, res) => {
  const { text } = req.body;
  if (!text || !req.session.user) return res.status(400).json({ error: 'Comment text and username are required.' });

  const image = await Image.findById(req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  image.comments.push({ username: req.session.user.username, text });
  await image.save();
  res.json({ message: 'Comment added!' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.listen(PORT, () => {
  console.log(`PicPal running at http://localhost:${PORT}`);
});