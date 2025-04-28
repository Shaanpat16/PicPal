document.addEventListener('DOMContentLoaded', () => {
  // Sections and buttons
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
    document.querySelector('.switchAuth').addEventListener('click', () => {
      isLogin = !isLogin;
      updateAuthText();
    });
  };

  const makeImageCard = (img, isMine) => {
    const card = document.createElement('div');
    card.className = 'imageCard';

    const imageEl = document.createElement('img');
    imageEl.src = img.url;
    imageEl.alt = 'Uploaded photo';
    card.appendChild(imageEl);

    const usernameEl = document.createElement('div');
    usernameEl.className = 'username';
    usernameEl.textContent = img.username || 'Anonymous';
    card.appendChild(usernameEl);

    const commentsContainer = document.createElement('div');
    commentsContainer.className = 'commentsContainer';

    img.comments.forEach(comment => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.textContent = `${comment.username}: ${comment.text}`;
      commentsContainer.appendChild(commentEl);
    });

    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.placeholder = 'Add a comment...';
    commentInput.className = 'commentInput';
    commentsContainer.appendChild(commentInput);

    const commentBtn = document.createElement('button');
    commentBtn.textContent = 'Post Comment';
    commentBtn.className = 'commentBtn';
    commentBtn.onclick = async () => {
      const commentText = commentInput.value.trim();
      if (!commentText) return;

      await fetch(`/comment/${img.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText })
      });
      loadStream();
    };
    commentsContainer.appendChild(commentBtn);

    card.appendChild(commentsContainer);

    const likeDisplay = document.createElement('div');
    likeDisplay.textContent = `❤️ ${img.likes || 0}`;
    likeDisplay.className = 'likeDisplay';
    card.appendChild(likeDisplay);

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
      likeBtn.textContent = likedImages.includes(img.id) ? 'Liked' : 'Like';
      likeBtn.className = 'likeBtn';
      likeBtn.disabled = likedImages.includes(img.id);

      likeBtn.onclick = async () => {
        if (likedImages.includes(img.id)) return;

        const res = await fetch(`/like/${img.id}`, { method: 'POST' });
        if (res.ok) {
          likedImages.push(img.id);
          localStorage.setItem('likedImages', JSON.stringify(likedImages));
          likeBtn.textContent = 'Liked';
          likeBtn.disabled = true;

          const updatedImage = await res.json();
          likeDisplay.textContent = `❤️ ${updatedImage.likes}`;
        }
      };
      card.appendChild(likeBtn);
    }

    return card;
  };

  const loadStream = async () => {
    const res = await fetch('/images');
    const images = await res.json();
    streamImages.innerHTML = '';
    images.forEach(img => streamImages.appendChild(makeImageCard(img, false)));
  };

  const loadMyPhotos = async () => {
    const res = await fetch('/my-images');
    if (!res.ok) return;
    const images = await res.json();
    myImages.innerHTML = '';
    images.forEach(img => myImages.appendChild(makeImageCard(img, true)));
  };

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
      const err = await res.json();
      alert(`Upload failed: ${err.message}`);
    }
  });

  streamTab.addEventListener('click', () => showTab('stream'));
  myPhotosTab.addEventListener('click', () => showTab('myPhotos'));
  accountTab.addEventListener('click', () => showTab('account'));

  loginBtn.addEventListener('click', () => {
    authModal.style.display = 'block';
    updateAuthText();
  });

  closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  authActionBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) return alert('Please fill in all fields.');

    const res = isLogin
      ? await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
      : await fetch('/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

    const result = await res.json();
    if (res.ok) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      authModal.style.display = 'none';
    } else {
      alert(result.message);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
  });

  loadStream();
  loadMyPhotos();
  showTab('stream');
});