/* ============================================================
   shared-avatar.js — ImpulseCheck
   Drop this into every page that has a topbar avatar.
   Automatically syncs the user's initial and profile photo.
   ============================================================ */

(function () {
  function syncAvatar() {
    const ta = document.getElementById('topbar-avatar');
    if (!ta) return;

    // Get user initial
    const user = JSON.parse(localStorage.getItem('ic_user') || 'null');
    const initial = user && user.full_name
      ? user.full_name.charAt(0).toUpperCase()
      : 'M';

    // Check for saved photo
    const savedPhoto = localStorage.getItem('ic_profile_photo');
    const isValidPhoto = savedPhoto
      && savedPhoto.startsWith('data:image/')
      && savedPhoto.length > 100;

    if (isValidPhoto) {
      // Show photo in topbar
      ta.innerHTML = '';
      ta.style.cssText = 'padding:0;overflow:hidden;background:#4a5568;width:36px;height:36px;border-radius:50%;';
      const img = document.createElement('img');
      img.src = savedPhoto;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
      img.onerror = function () {
        // Photo failed — fall back to initial
        localStorage.removeItem('ic_profile_photo');
        ta.innerHTML = initial;
        ta.style.cssText = '';
      };
      ta.appendChild(img);
    } else {
      // Show initial
      ta.textContent = initial;
      ta.style.cssText = '';
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAvatar);
  } else {
    syncAvatar();
  }
})();
