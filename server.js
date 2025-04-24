const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = 3000;

const uploadsPath = path.join(__dirname, 'uploads');
const tempPath = path.join(__dirname, 'temp');
const dataPath = path.join(__dirname, 'data');
const USERS_FILE = path.join(dataPath, 'users.json');
const IMAGES_FILE = path.join(dataPath, 'images.json');

// Ensure required folders exist
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(IMAGES_FILE)) fs.writeFileSync(IMAGES_FILE, '[]');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsPath));

app.use(session({
  secret: 'picpal-secret',
  resave: false,
  saveUninitialized: true
}));

const storage = multer.diskStorage({
  destination: tempPath,
  filename: (req, file, cb) => {
    cb(null, `${uuid()}-${file.originalname}`);
  }
});

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

app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const file = req.file;
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${uuid()}${ext}`;
  const outputPath = path.join(uploadsPath, filename);

  try {
    await sharp(file.path)
      .resize({ width: 800, height: 800, fit: 'cover' })
      .toFormat('jpeg')
      .toFile(outputPath);

    fs.unlinkSync(file.path);

    const images = loadImages();
    const newImage = {
      id: uuid(),
      filename,
      userId: req.session.user.id,
      likes: 0,
      timestamp: new Date().toISOString()
    };
    images.unshift(newImage);
    saveImages(images);

    res.json({ message: 'Uploaded', image: newImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

app.get('/images', (req, res) => {
  const images = loadImages().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(images);
});

app.get('/my-images', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const images = loadImages().filter(img => img.userId === req.session.user.id);
  res.json(images);
});

app.post('/like/:id', (req, res) => {
  const images = loadImages();
  const image = images.find(img => img.id === req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  image.likes += 1;
  saveImages(images);
  res.json({ message: 'Liked' });
});

app.delete('/delete/:id', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  let images = loadImages();
  const img = images.find(i => i.id === req.params.id);

  if (!img || img.userId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  images = images.filter(i => i.id !== req.params.id);
  saveImages(images);

  try {
    fs.unlinkSync(path.join(uploadsPath, img.filename));
  } catch (err) {
    console.error('Failed to delete image file:', err);
  }

  res.json({ message: 'Deleted' });
});

app.listen(PORT, () => {
  console.log(`PicPal running at http://localhost:${PORT}`);
});
