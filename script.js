document.addEventListener('DOMContentLoaded', () => {
  // Tabs & Sections
  const streamTab = document.getElementById('streamTab');
  const myPhotosTab = document.getElementById('myPhotosTab');
  const accountTab = document.getElementById('accountTab');
  const streamSection = document.getElementById('stream');
  const myPhotosSection = document.getElementById('myPhotos');
  const accountSection = document.getElementById('account');

  // Auth & UI
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authModal = document.getElementById('authModal');
  const authTitle = document.getElementById('authTitle');
  const authActionBtn = document.getElementById('authActionBtn');
  const toggleAuth = document.getElementById('toggleAuth');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const closeModal = document.getElementById('closeModal');

  // Upload
  const uploadBtn = document.getElementById('uploadBtn');
  const photoInput = document.getElementById('photoInput');
  const streamImages = document.getElementById('streamImages');
  const myImages = document.getElementById('myImages');

  let isLogin = true;

  // Utility
  const showTab = (tabId) => {
    streamSection.style.display = 'none';
    myPhotosSection.style.display = 'none';
    accountSection.style.display = 'none';

    if (tabId === 'stream') streamSection.style.display = 'block';
    if (tabId === 'myPhotos') myPhotosSection.style.display = 'block';
    if (tabId === 'account') accountSection.style.display = 'block';
  };

  const updateAuthText = () => {
    authTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    authActionBtn.textContent = isLogin ? 'Login' : 'Sign Up';
    toggleAuth.innerHTML = isLogin
      ? `Don't have an account? <span class="switchAuth">Sign up</span>`
      : `Already have an account? <span class="switchAuth">Login</span>`;
    document.querySelector('.switchAuth').addEventListener('click', () => {
      isLogin = !isLogin;
      updateAuthText();
    });
  };

  const makeImageCard = (img, isMine) => {
    const card = document.createElement('div');
    card.className = 'imageCard';

    const imageEl = document.createElement('img');
    imageEl.src = `/uploads/${img.filename}`;

    const likes = document.createElement('div');
    likes.textContent = `❤️ ${img.likes || 0}`;

    card.appendChild(imageEl);
    card.appendChild(likes);

    if (isMine) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'deleteBtn';
      delBtn.onclick = async () => {
        await fetch(`/delete/${img.id}`, { method: 'DELETE' });
        loadStream();
        loadMyPhotos();
      };
      card.appendChild(delBtn);
    } else {
      const likeBtn = document.createElement('button');
      likeBtn.textContent = 'Like';
      likeBtn.className = 'likeBtn';
      likeBtn.onclick = async () => {
        await fetch(`/like/${img.id}`, { method: 'POST' });
        loadStream();
      };
      card.appendChild(likeBtn);
    }

    return card;
  };

  // Load functions
  const loadStream = async () => {
    const res = await fetch('/images');
    const images = await res.json();
    streamImages.innerHTML = '';
    images.forEach(img => {
      streamImages.appendChild(makeImageCard(img, false));
    });
  };

  const loadMyPhotos = async () => {
    const res = await fetch('/my-images');
    if (!res.ok) return;
    const images = await res.json();
    myImages.innerHTML = '';
    images.forEach(img => {
      myImages.appendChild(makeImageCard(img, true));
    });
  };

  // Upload handler
  uploadBtn.addEventListener('click', async () => {
    const file = photoInput.files[0];
    if (!file) return alert('Please select a file.');

    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    if (res.ok) {
      alert('Photo uploaded!');
      photoInput.value = '';
      await loadStream();
      await loadMyPhotos();
    } else {
      alert('Upload failed');
    }
  });

  // Tab switching
  streamTab.addEventListener('click', () => showTab('stream'));
  myPhotosTab.addEventListener('click', () => showTab('myPhotos'));
  accountTab.addEventListener('click', () => showTab('account'));

  // Auth modal
  loginBtn.addEventListener('click', () => {
    authModal.style.display = 'block';
    updateAuthText();
  });

  closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  authActionBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) return alert('Enter both fields');

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
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline';
      showTab('myPhotos');
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
    showTab('stream');
    loadStream();
  });

  // Start app
  showTab('stream');
  loadStream();
  loadMyPhotos();
});
