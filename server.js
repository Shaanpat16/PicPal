const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

let images = [];
let idCounter = 1;
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.sendStatus(400);

  const id = idCounter++;
  const filename = `${id}.jpg`;
  const filepath = path.join(uploadsDir, filename);

  try {
    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();
    const size = Math.min(metadata.width, metadata.height, 800);
    await image.resize(size, size).toFile(filepath);
    images.push({ id: String(id), filename, likes: 0, owner: 'user1' });
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get('/images', (req, res) => {
  res.json(images);
});

app.get('/my-images', (req, res) => {
  const myImages = images.filter(img => img.owner === 'user1');
  res.json(myImages);
});

app.post('/like/:id', (req, res) => {
  const img = images.find(i => i.id === req.params.id);
  if (img) img.likes++;
  res.sendStatus(200);
});

app.delete('/delete/:id', (req, res) => {
  const index = images.findIndex(i => i.id === req.params.id && i.owner === 'user1');
  if (index !== -1) {
    const [img] = images.splice(index, 1);
    fs.unlinkSync(path.join(uploadsDir, img.filename));
  }
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`PicPal server running at http://localhost:${PORT}`));
