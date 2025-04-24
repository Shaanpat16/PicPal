document.addEventListener('DOMContentLoaded', () => {
  const streamTab = document.getElementById('streamTab');
  const myPhotosTab = document.getElementById('myPhotosTab');
  const accountTab = document.getElementById('accountTab');
  const streamSection = document.getElementById('stream');
  const myPhotosSection = document.getElementById('myPhotos');
  const accountSection = document.getElementById('account');
  const uploadBtn = document.getElementById('uploadBtn');
  const photoInput = document.getElementById('photoInput');
  const streamImages = document.getElementById('streamImages');
  const myImages = document.getElementById('myImages');

  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authModal = document.getElementById('authModal');
  const authTitle = document.getElementById('authTitle');
  const authActionBtn = document.getElementById('authActionBtn');
  const switchAuth = document.getElementById('switchAuth');
  const toggleAuth = document.getElementById('toggleAuth');
  const closeModal = document.getElementById('closeModal');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  let isLogin = true;

  function switchTab(tab) {
    streamSection.style.display = 'none';
    myPhotosSection.style.display = 'none';
    accountSection.style.display = 'none';

    if (tab === 'stream') streamSection.style.display = 'block';
    if (tab === 'myPhotos') myPhotosSection.style.display = 'block';
    if (tab === 'account') accountSection.style.display = 'block';
  }

  streamTab.addEventListener('click', () => switchTab('stream'));
  myPhotosTab.addEventListener('click', () => switchTab('myPhotos'));
  accountTab.addEventListener('click', () => switchTab('account'));

  uploadBtn.addEventListener('click', async () => {
    const file = photoInput.files[0];
    if (!file) return alert('Please select a file.');

    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    if (res.ok) {
      alert('Photo uploaded!');
      photoInput.value = '';
      loadStream();
      loadMyPhotos();
    } else {
      alert('Upload failed');
    }
  });

  async function loadStream() {
    const res = await fetch('/images');
    const images = await res.json();
    streamImages.innerHTML = '';
    images.forEach(img => {
      streamImages.appendChild(makeImageCard(img, false));
    });
  }

  async function loadMyPhotos() {
    const res = await fetch('/my-images');
    if (!res.ok) return;
    const images = await res.json();
    myImages.innerHTML = '';
    images.forEach(img => {
      myImages.appendChild(makeImageCard(img, true));
    });
  }

  function makeImageCard(img, isMine) {
    const card = document.createElement('div');
    card.className = 'imageCard';
    const imageEl = document.createElement('img');
    imageEl.src = `/uploads/${img.filename}`;
    const likes = document.createElement('div');
    likes.textContent = `❤️ ${img.likes || 0}`;
    card.appendChild(imageEl);
    card.appendChild(likes);

    if (!isMine) {
      const likeBtn = document.createElement('button');
      likeBtn.textContent = 'Like';
      likeBtn.className = 'likeBtn';
      likeBtn.onclick = async () => {
        await fetch(`/like/${img.id}`, { method: 'POST' });
        loadStream();
      };
      card.appendChild(likeBtn);
    } else {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'deleteBtn';
      delBtn.onclick = async () => {
        await fetch(`/delete/${img.id}`, { method: 'DELETE' });
        loadMyPhotos();
        loadStream();
      };
      card.appendChild(delBtn);
    }

    return card;
  }

  // Auth logic
  loginBtn.addEventListener('click', () => {
    authModal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  switchAuth.addEventListener('click', () => {
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    authActionBtn.textContent = isLogin ? 'Login' : 'Sign Up';
    toggleAuth.innerHTML = isLogin
      ? "Don't have an account? <span id='switchAuth'>Sign up</span>"
      : "Already have an account? <span id='switchAuth'>Login</span>";
  });

  authActionBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    const path = isLogin ? '/login' : '/signup';

    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      authModal.style.display = 'none';
      usernameInput.value = '';
      passwordInput.value = '';
      logoutBtn.style.display = 'inline';
      loginBtn.style.display = 'none';
      loadMyPhotos();
    } else {
      alert('Authentication failed');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout');
    logoutBtn.style.display = 'none';
    loginBtn.style.display = 'inline';
    myImages.innerHTML = '';
  });

  // Init
  loadStream();
  loadMyPhotos();
});
