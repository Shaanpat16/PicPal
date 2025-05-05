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
  const toggleAuth = document.getElementById('toggleAuth');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const closeModal = document.getElementById('closeModal');
  const mainContent = document.getElementById('mainContent');

  let isLogin = true;
  let likedImages = JSON.parse(localStorage.getItem('likedImages')) || [];

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
      ? "Don't have an account? <span class='switchAuth'>Sign up</span>"
      : "Already have an account? <span class='switchAuth'>Login</span>";
  };

  const checkLogin = async () => {
    try {
      const res = await fetch('/me');
      if (res.ok) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        mainContent.style.display = 'block';
        await loadStream();
        await loadMyPhotos();
        showTab('stream');
      } else {
        throw new Error();
      }
    } catch {
      authModal.style.display = 'block';
      mainContent.style.display = 'none';
    }
  };

  loginBtn.addEventListener('click', () => {
    authModal.style.display = 'block';
    updateAuthText();
    setTimeout(() => {
      const switchAuth = document.querySelector('.switchAuth');
      if (switchAuth) {
        switchAuth.addEventListener('click', () => {
          isLogin = !isLogin;
          updateAuthText();
        });
      }
    }, 0);
  });

  authActionBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) return alert('Please fill in all fields.');

    const res = await fetch(isLogin ? '/login' : '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await res.json();
    if (res.ok) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      authModal.style.display = 'none';
      mainContent.style.display = 'block';
      await loadStream();
      await loadMyPhotos();
      showTab('stream');
    } else {
      alert(result.message || 'Authentication failed.');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    mainContent.style.display = 'none';
    authModal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  streamTab.addEventListener('click', () => showTab('stream'));
  myPhotosTab.addEventListener('click', () => showTab('myPhotos'));
  accountTab.addEventListener('click', () => showTab('account'));

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
      showTab('myPhotos');
    } else {
      const err = await res.json();
      alert(`Upload failed: ${err.message}`);
    }
  });

  const makeImageCard = (img, isMine) => {
    if (!img.url) return console.warn('Missing image URL');

    const card = document.createElement('div');
    card.className = 'imageCard';

    const imageEl = document.createElement('img');
    imageEl.src = img.url;
    imageEl.alt = 'Uploaded photo';
    card.appendChild(imageEl);

    const userEl = document.createElement('div');
    userEl.className = 'username';
    userEl.textContent = img.username || 'Unknown';
    card.appendChild(userEl);

    return card;
  };

  const loadStream = async () => {
    const res = await fetch('/images');
    if (!res.ok) return;
    const images = await res.json();
    streamImages.innerHTML = '';
    if (Array.isArray(images)) {
      images.forEach(img => streamImages.appendChild(makeImageCard(img, false)));
    } else {
      console.error('Error: Expected an array of images');
    }
  };

  const loadMyPhotos = async () => {
    const res = await fetch('/my-images');
    if (!res.ok) return;
    const data = await res.json();
    const images = data.images || [];
    myImages.innerHTML = '';
    if (Array.isArray(images)) {
      images.forEach(img => myImages.appendChild(makeImageCard(img, true)));
    } else {
      console.error('Error: Expected an array of images');
    }
  };

  checkLogin();
});
