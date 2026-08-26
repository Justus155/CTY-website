import { supabase } from './supabaseclient.js';
import { isUserAdmin, deletePost, logAdminAction } from './adminUtils.js';

let currentUser = null;
let isAdmin = false;
let events = [];

// Check admin status and show/hide admin controls
async function checkAdminStatus() {
  isAdmin = await isUserAdmin();
  const adminControls = document.getElementById('admin-controls');
  if (adminControls) {
    adminControls.style.display = isAdmin ? 'block' : 'none';
  }
  return isAdmin;
}

// Load events from Supabase
async function loadEvents() {
  try {
    // Only load non-deleted events
    const { data, error } = await supabase
      .from('events') // Assuming you have an events table
      .select('*')
      .eq('is_deleted', false)
      .eq('status', 'published')
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    
    events = data || [];
    renderEvents(events);
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-list').innerHTML = 
      '<p class="events-empty">Unable to load events. Please try again later.</p>';
  }
}

// Render events with admin controls if admin
function renderEvents(events) {
  const container = document.getElementById('events-list');
  
  if (!events || events.length === 0) {
    container.innerHTML = `<p class="events-empty">No upcoming events. Check back soon!</p>`;
    return;
  }
  
  container.innerHTML = events.map(event => `
    <div class="event-card" data-event-id="${event.id}">
      <div class="event-date-badge">
        <span class="day">${new Date(event.event_date).getDate()}</span>
        <span class="mon">${new Date(event.event_date).toLocaleString('default', { month: 'short' })}</span>
      </div>
      <div class="event-info">
        <span class="event-meta">${event.category || 'General'}</span>
        <h3>${event.title}</h3>
        <p>${event.description || ''}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="event-rsvp">${event.rsvp_count || 0} going</span>
        ${isAdmin ? `
          <button class="admin-btn delete-event-btn" data-id="${event.id}" style="background: #dc3545; color: white; border: none;">
            🗑️ Delete
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  // Add delete event listeners
  if (isAdmin) {
    document.querySelectorAll('.delete-event-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this event?')) {
          await deleteEvent(btn.dataset.id);
        }
      });
    });
  }
}

// Delete event
async function deleteEvent(eventId) {
  try {
    const { error } = await supabase
      .from('events')
      .update({ 
        is_deleted: true, 
        status: 'deleted',
        deleted_at: new Date().toISOString()
      })
      .eq('id', eventId);
    
    if (error) throw error;
    
    await logAdminAction('delete', 'event', eventId);
    showAdminMessage('Event deleted successfully!', 'success');
    await loadEvents();
  } catch (error) {
    showAdminMessage('Error deleting event: ' + error.message, 'error');
  }
}

// Add new event (admin only)
async function addEvent(eventData) {
  if (!isAdmin) return;
  
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        created_by: (await supabase.auth.getSession()).data.session.user.id
      })
      .select();
    
    if (error) throw error;
    
    await logAdminAction('create', 'event', data[0].id);
    showAdminMessage('Event added successfully!', 'success');
    await loadEvents();
  } catch (error) {
    showAdminMessage('Error adding event: ' + error.message, 'error');
  }
}

// Show admin messages
function showAdminMessage(message, type = 'info') {
  const msgEl = document.getElementById('admin-message');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.style.color = type === 'error' ? '#dc3545' : '#2e7d32';
    setTimeout(() => {
      msgEl.textContent = '';
    }, 5000);
  }
}

// Initialize
async function init() {
  await checkAdminStatus();
  await loadEvents();
  
  // Set up event listeners for admin
  if (isAdmin) {
    const addEventBtn = document.getElementById('add-event-btn');
    if (addEventBtn) {
      addEventBtn.addEventListener('click', () => {
        // Show add event modal
        showAddEventModal();
      });
    }
    
    const refreshBtn = document.getElementById('refresh-events-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadEvents);
    }
  }
}

// Add event modal (admin only)
function showAddEventModal() {
  // Simple prompt-based add for demo
  const title = prompt('Event Title:');
  if (!title) return;
  
  const description = prompt('Description:');
  const date = prompt('Date (YYYY-MM-DD):');
  const category = prompt('Category (optional):');
  
  addEvent({
    title,
    description: description || '',
    event_date: date || new Date().toISOString().split('T')[0],
    category: category || 'General',
    status: 'published'
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);