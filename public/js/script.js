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
  const bioInput = document.getElementById('bio'); // For bio input
  const profilePicInput = document.getElementById('profilePic'); // For profile picture input
  const accountUsernameInput = document.getElementById('accountUsername'); // For changing username
  const accountPasswordInput = document.getElementById('accountPassword'); // For changing password
  const deleteAccountBtn = document.getElementById('deleteAccountBtn'); // Button to delete account
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

    if (img.comments && img.comments.length) {
      img.comments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.textContent = `${comment.username}: ${comment.text}`;
        commentsContainer.appendChild(commentEl);
      });
    }

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

      const res = await fetch(`/comment/${encodeURIComponent(img._id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText })
      });

      if (res.ok) {
        commentInput.value = '';
        await loadStream();
        await loadMyPhotos();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to post comment.');
      }
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
        const res = await fetch(`/delete/${encodeURIComponent(img._id)}`, { method: 'DELETE' });
        if (res.ok) {
          await loadStream();
          await loadMyPhotos();
        } else {
          alert('Failed to delete image.');
        }
      };
      card.appendChild(delBtn);
    } else {
      const likeBtn = document.createElement('button');
      likeBtn.textContent = likedImages.includes(img._id) ? 'Liked' : 'Like';
      likeBtn.className = 'likeBtn';
      likeBtn.disabled = likedImages.includes(img._id);

      likeBtn.onclick = async () => {
        if (likedImages.includes(img._id)) return;

        const res = await fetch(`/like/${encodeURIComponent(img._id)}`, { method: 'POST' });
        if (res.ok) {
          const updatedImage = await res.json();
          likedImages.push(img._id);
          localStorage.setItem('likedImages', JSON.stringify(likedImages));
          likeBtn.textContent = 'Liked';
          likeBtn.disabled = true;
          likeDisplay.textContent = `❤️ ${updatedImage.likes}`;
        } else {
          const error = await res.json();
          alert(error.message || 'Failed to like the image.');
        }
      };
      card.appendChild(likeBtn);
    }

    return card;
  };

  const loadStream = async () => {
    const res = await fetch('/images');
    if (!res.ok) return;
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
      showTab('myPhotos');
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
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

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
      await loadStream();
      await loadMyPhotos();
    } else {
      alert(result.message || 'Authentication failed.');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    likedImages = [];
    localStorage.removeItem('likedImages');
    await loadStream();
    await loadMyPhotos();
  });

  // Handle profile picture update
  const profilePicInput = document.getElementById('profilePicInput'); // Input for profile picture
  const updateProfilePicBtn = document.getElementById('updateProfilePicBtn'); // Button to update profile picture
  updateProfilePicBtn.addEventListener('click', async () => {
    const file = profilePicInput.files[0];
    if (!file) return alert('Please select a profile picture.');

    const formData = new FormData();
    formData.append('profilePic', file);

    const res = await fetch('/update-profile-picture', {
      method: 'POST',
      body: formData,
    });
    const result = await res.json();
    if (res.ok) {
      alert('Profile picture updated!');
      // Update the UI with the new profile picture URL
      document.getElementById('profilePicDisplay').src = result.profilePic;
    } else {
      alert(result.message || 'Failed to update profile picture');
    }
  });

  // Handle account update (username and password change)
  const updateAccountBtn = document.getElementById('updateAccountBtn');
  updateAccountBtn.addEventListener('click', async () => {
    const username = accountUsernameInput.value.trim();
    const password = accountPasswordInput.value.trim();

    if (!username || !password) return alert('Please fill in all fields.');

    const res = await fetch('/update-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await res.json();
    if (res.ok) {
      alert('Account updated');
      // Update the UI to reflect the new username
      document.getElementById('currentUsername').textContent = result.username;
    } else {
      alert(result.message || 'Failed to update account');
    }
  });

  // Handle account deletion
  deleteAccountBtn.addEventListener('click', async () => {
    const confirmDelete = confirm('Are you sure you want to delete your account? This will also delete all your photos.');
    if (confirmDelete) {
      const res = await fetch('/delete-account', { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        alert('Your account and all photos have been deleted.');
        // Redirect to the login page or logout
        window.location.href = '/';
      } else {
        alert(result.message || 'Failed to delete account');
      }
    }
  });

  loadStream();
  loadMyPhotos();
  showTab('stream');
});
