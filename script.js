function showTab(tabId) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.style.display = tab.id === tabId ? 'flex' : 'none';
  });
}

// Handle image upload
const imageUpload = document.getElementById('imageUpload');
imageUpload.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  if (response.ok) {
    loadImages();
    loadMyImages();
  }
});

async function loadImages() {
  const res = await fetch('/images');
  const images = await res.json();
  const stream = document.getElementById('stream');
  stream.innerHTML = '';
  images.forEach(img => {
    stream.innerHTML += `
      <div class="image-card">
        <img src="/uploads/${img.filename}" alt="Image" />
        <button class="like-btn" onclick="likeImage('${img.id}')">❤️ ${img.likes}</button>
      </div>`;
  });
}

async function loadMyImages() {
  const res = await fetch('/my-images');
  const images = await res.json();
  const myPhotos = document.getElementById('my-photos');
  myPhotos.innerHTML = '';
  images.forEach(img => {
    myPhotos.innerHTML += `
      <div class="image-card">
        <img src="/uploads/${img.filename}" alt="My Image" />
        <button class="delete-btn" onclick="deleteImage('${img.id}')">Delete</button>
      </div>`;
  });
}

async function likeImage(id) {
  await fetch(`/like/${id}`, { method: 'POST' });
  loadImages();
}

async function deleteImage(id) {
  await fetch(`/delete/${id}`, { method: 'DELETE' });
  loadMyImages();
}

// Initial load
loadImages();
loadMyImages();
