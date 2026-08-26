// Add to homepage.js
import { isUserAdmin, deletePost } from '../Javascript files/adminUtils.js';

// Show admin panel if user is admin
async function initAdmin() {
  const isAdmin = await isUserAdmin();
  const adminPanel = document.getElementById('admin-panel');
  const adminStatus = document.getElementById('admin-status');
  
  if (isAdmin && adminPanel) {
    adminPanel.style.display = 'block';
    if (adminStatus) {
      adminStatus.textContent = '✓ Admin access enabled';
    }
    
    // Add admin button to each photo
    document.querySelectorAll('.photo-card').forEach(card => {
      const postId = card.dataset.postId;
      if (postId) {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'admin-delete-btn';
        adminBtn.style.cssText = `
          position: absolute; top: 10px; right: 10px;
          background: rgba(220, 53, 69, 0.9); color: white;
          border: none; border-radius: 50%; width: 32px; height: 32px;
          font-size: 16px; cursor: pointer; z-index: 10;
          display: flex; align-items: center; justify-content: center;
        `;
        adminBtn.textContent = '×';
        adminBtn.title = 'Delete this photo';
        adminBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Delete this photo?')) {
            await deletePost(postId, 'photo');
            card.style.opacity = '0.5';
            card.style.transition = 'opacity 0.3s';
            setTimeout(() => card.remove(), 300);
          }
        });
        card.style.position = 'relative';
        card.appendChild(adminBtn);
      }
    });
  }
}

// Call initAdmin after loading photos
// Add this line at the end of your existing initHomeContent function:
await initAdmin();