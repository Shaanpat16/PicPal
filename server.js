const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = 3000;

app.use(express.static('.'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'picpal-secret',
  resave: false,
  saveUninitialized: true
}));

const upload = multer({ dest: 'temp/' });

const USERS_FILE = 'data/users.json';
const IMAGES_FILE = 'data/images.json';

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(IMAGES_FILE)) fs.writeFileSync(IMAGES_FILE, '[]');

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
  const filename = `${uuid()}.jpg`;
  const outputPath = `uploads/${filename}`;

  await sharp(file.path)
    .resize(800, 800, { fit: sharp.fit.cover })
    .toFormat('jpeg')
    .toFile(outputPath);

  fs.unlinkSync(file.path);

  const images = loadImages();
  images.push({
    id: uuid(),
    filename,
    userId: req.session.user.id,
    likes: 0
  });
  saveImages(images);

  res.json({ message: 'Uploaded' });
});

app.get('/images', (req, res) => {
  const images = loadImages();
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

  fs.unlinkSync(`uploads/${img.filename}`);
  res.json({ message: 'Deleted' });
});

app.listen(PORT, () => {
  console.log(`PicPal running at http://localhost:${PORT}`);
});
