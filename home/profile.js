  // 3. Listen for the "close" message from profile.js
  window.addEventListener('message', (event) => {
    // Catch the close signal
    if (event.data && (event.data.type === 'close-profile-modal' || event.data.type === 'close-profile-drawer')) {
      overlay.style.display = "none";
      iframe.src = iframe.src; // Reset the iframe
    }
    
    // Catch the update signal to refresh the header avatar
    if (event.data && event.data.type === 'profile-updated') {
      if (typeof window.syncHeaderAuth === 'function') {
        window.syncHeaderAuth();
      }
    }
  });