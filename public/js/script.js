// public/js/script.js

// Run when page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("📸 PicPal loaded");

  // === DARK MODE TOGGLE ===
  const toggleDark = document.getElementById("toggleDark");
  if (toggleDark) {
    toggleDark.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }

  // === LOAD USER INFO ===
  const profileSection = document.getElementById("profileInfo");
  if (profileSection) {
    fetch("/api/me")
      .then(res => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then(user => {
        profileSection.innerHTML = `
          <p><strong>Username:</strong> ${user.username}</p>
          <p><strong>Bio:</strong> ${user.bio}</p>
          <img src="${user.profilePic}" width="80" />
        `;
      })
      .catch(() => {
        location.href = "/login.html";
      });
  }

  // === FEED LOAD ===
  const feedContainer = document.getElementById("feed");
  if (feedContainer) {
    fetch("/api/posts")
      .then(res => res.json())
      .then(posts => {
        feedContainer.innerHTML = posts.map(post => `
          <div class="post">
            <img src="${post.media}" class="feed-img" />
            <p><strong>${post.user.username}</strong>: ${post.caption}</p>
            <p class="hashtags">#${post.hashtags.join(" #")}</p>
            <button onclick="likePost('${post._id}')">❤️ ${post.likes}</button>
            <input type="text" id="comment-${post._id}" placeholder="Comment..." />
            <button onclick="commentPost('${post._id}')">💬</button>
          </div>
        `).join('');
      });
  }

  // === UPLOAD HANDLING ===
  const uploadForm = document.getElementById("uploadForm");
  const preview = document.getElementById("preview");
  const mediaInput = document.getElementById("media");

  if (mediaInput && preview) {
    mediaInput.addEventListener("change", () => {
      const file = mediaInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => preview.src = e.target.result;
        reader.readAsDataURL(file);
      }
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(uploadForm);

      const res = await fetch("/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      alert("✅ Uploaded: " + data.url);
    });
  }

  // === GROUP CREATION ===
  const createGroupBtn = document.getElementById("createGroupBtn");
  if (createGroupBtn) {
    createGroupBtn.addEventListener("click", async () => {
      const name = prompt("Enter group name:");
      const isPrivate = confirm("Make this group private?");
      const res = await fetch("/api/groups/create", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isPrivate })
      });
      const data = await res.json();
      alert(`Group created with join code: ${data.joinCode}`);
    });
  }

  // === BIO UPDATE ===
  const updateBioBtn = document.getElementById("updateBioBtn");
  if (updateBioBtn) {
    updateBioBtn.addEventListener("click", async () => {
      const bio = prompt("New bio:");
      const userId = updateBioBtn.dataset.userid;
      await fetch("/api/users/update-bio", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bio })
      });
      alert("Bio updated!");
      location.reload();
    });
  }

  // === SCHEDULED POST SIMULATION ===
  const scheduleBtn = document.getElementById("scheduleBtn");
  if (scheduleBtn) {
    scheduleBtn.addEventListener("click", () => {
      alert("Your post will go live in 1 hour...");
      setTimeout(() => alert("✅ Scheduled post published!"), 3600000);
    });
  }
});

// === LIKE POST FUNCTION ===
async function likePost(postId) {
  await fetch(`/api/posts/${postId}/like`, { method: "POST" });
  alert("You liked this post.");
}

// === COMMENT POST FUNCTION ===
async function commentPost(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();
  if (!text) return;

  await fetch(`/api/posts/${postId}/comment`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  input.value = "";
  alert("Comment added.");
}
