document.addEventListener("DOMContentLoaded", () => {
  console.log("PicPal Loaded");

  const toggleBtn = document.getElementById("toggleDark");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }
});
