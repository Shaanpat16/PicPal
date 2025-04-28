const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // Needed for buffer upload
require('dotenv').config();

const app = express();
const PORT = 3000;
console.log(process.env.CLOUDINARY_CLOUD_NAME); // Should print your cloud name
console.log(process.env.CLOUDINARY_API_KEY); // Should print your API key
console.log(process.env.CLOUDINARY_API_SECRET); // Should print your API secret

// Cloudinary config (replace with your actual credentials)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const tempPath = path.join(__dirname, 'temp');
const dataPath = path.join(__dirname, 'data');
const USERS_FILE = path.join(dataPath, 'users.json');
const IMAGES_FILE = path.join(dataPath, 'images.json');

if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(IMAGES_FILE)) fs.writeFileSync(IMAGES_FILE, '[]');

// Set up static file serving for the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

const storage = multer.memoryStorage(); // store in memory for sharp
const upload = multer({ storage });

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadImages() {
  return JSON.parse(fs.readFileSync(IMAGES_FILE));
}

function saveImages(images) {
  fs.writeFileSync(IMAGES_FILE, JSON.stringify(images, null, 2));
}

// Define your image schema to include comments
const ImageSchema = {
  url: String,
  username: String,
  comments: [{ username: String, text: String }],
  likes: { type: Number, default: 0 }
};

// Auth routes
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const user = { id: uuid(), username, password };
  users.push(user);
  saveUsers(users);
  req.session.user = user;
  res.json({ message: 'Signed up' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = user;
  res.json({ message: 'Logged in' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

// Upload route with Cloudinary

app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  try {
    // Resize image to 800x800 and convert to JPEG
    const processedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800, height: 800, fit: 'cover' })
      .jpeg()
      .toBuffer();

    // Upload to Cloudinary
    const uploadStream = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'picpal_uploads' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(processedBuffer).pipe(stream);
      });
    };

    const result = await uploadStream();

    const images = loadImages();
    const newImage = {
      id: uuid(),
      url: result.secure_url,
      public_id: result.public_id,
      userId: req.session.user.id,
      username: req.session.user.username,
      likes: 0,
      likedBy: [], // NEW: track which users liked it
      comments: [],
      timestamp: new Date().toISOString()
    };

    images.unshift(newImage);
    saveImages(images);

    res.json({ message: 'Uploaded', image: newImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all images
app.get('/images', (req, res) => {
  const images = loadImages().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(images);
});

// Get images uploaded by current user
app.get('/my-images', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const images = loadImages().filter(img => img.userId === req.session.user.id);
  res.json(images);
});

// Like image
app.post('/like/:id', (req, res) => {
  const images = loadImages();
  const image = images.find(img => img.id === req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  image.likes += 1;
  saveImages(images);
  res.json({ message: 'Liked' });
});

// Delete image
app.delete('/delete/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  let images = loadImages();
  const img = images.find(i => i.id === req.params.id);

  if (!img || img.userId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  images = images.filter(i => i.id !== req.params.id);
  saveImages(images);

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(img.public_id);
  } catch (err) {
    console.error('Cloudinary deletion error:', err);
  }

  res.json({ message: 'Deleted' });
});

// Post a comment on an image
app.post('/comment/:id', (req, res) => {
  const { text } = req.body;
  const imageId = req.params.id;
  const username = req.session.user ? req.session.user.username : null;

  if (!text || !username) return res.status(400).json({ message: 'Comment text and username are required.' });

  try {
    const images = loadImages();
    const image = images.find(img => img.id === imageId);

    if (!image) return res.status(404).json({ message: 'Image not found' });

    image.comments.push({ username, text });
    saveImages(images);

    res.status(200).json({ message: 'Comment added!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add comment.' });
  }
});

// Serve index.html from the views folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PicPal running at http://localhost:${PORT}`);
});