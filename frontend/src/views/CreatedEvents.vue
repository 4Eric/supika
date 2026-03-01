<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getImageUrl } from '@/utils/imageUrl'

const events = ref([])
const loading = ref(true)
const errorMsg = ref('')
const router = useRouter()
const authStore = useAuthStore()

// Modal State
const showDeleteModal = ref(false);
const eventToDelete = ref(null);

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events/hosted/me`, {
      headers: {
        'x-auth-token': authStore.token
      }
    })
    events.value = res.data
  } catch (error) {
    errorMsg.value = error.response?.data?.message || "Failed to load hosted events."
  } finally {
    loading.value = false
  }
})

const viewEvent = (id) => {
  router.push(`/event/${id}`)
}

const editEvent = (id, event) => {
  if (event) event.stopPropagation();
  router.push(`/event/${id}/edit`)
}

const promptDelete = (id, event) => {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  eventToDelete.value = id;
  showDeleteModal.value = true;
}

const cancelDelete = () => {
  showDeleteModal.value = false;
  eventToDelete.value = null;
}

const confirmDelete = async () => {
  if (!eventToDelete.value) return;
  
  const id = eventToDelete.value;
  try {
    await axios.delete(`${API_URL}/api/events/${id}`, {
      headers: { 'x-auth-token': authStore.token }
    });
    events.value = events.value.filter(e => e.id !== id);
    showDeleteModal.value = false;
    eventToDelete.value = null;
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to delete event');
  }
}

const formatLocation = (loc) => {
  if (!loc) return '';
  const parts = loc.split(',').map(p => p.trim());
  if (parts.length <= 2) return loc;
  
  const isZip = (str) => /\\d/.test(str) && str.length <= 10;
  let stateIdx = parts.length - 2;
  
  if (isZip(parts[stateIdx])) {
    stateIdx--;
  }
  const cityIdx = stateIdx - 1;
  
  if (cityIdx >= 0) {
    return `${parts[cityIdx]}, ${parts[stateIdx]}`;
  }
  return parts.slice(0, 2).join(', ');
}
</script>

<template>
  <div class="my-events-container">
    <div class="header">
      <h1 class="page-title">Hosted Events</h1>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading your events...</p>
    </div>

    <div v-else-if="errorMsg" class="error-msg">
      {{ errorMsg }}
    </div>

    <div v-else-if="events.length === 0" class="empty-state card">
      <h2>You haven't hosted any events yet.</h2>
      <p>Create your first event sharing your vibe to the world!</p>
      <router-link to="/create" class="btn submit-btn" style="display: inline-block; margin-top: 1rem;">Create Event</router-link>
    </div>

    <div v-else class="events-grid">
      <div v-for="event in events" :key="event.id" class="card event-card">
        <div class="card-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.imageUrl) + ')' }" @click="viewEvent(event.id)"></div>
        <div class="card-content">
          <div class="card-content-body" @click="viewEvent(event.id)">
            <h3>{{ event.title }}</h3>
            <div class="attendee-badge">
              👥 {{ event.attendeeCount || 0 }} / {{ event.maxAttendees || 5 }} Attendees
            </div>
            <p class="location-text">
              📍 <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" @click.stop class="location-link">{{ formatLocation(event.locationName) }}</a>
            </p>
            <p class="date-text">📅 {{ new Date(event.date).toLocaleDateString() }}</p>
            <p class="desc-text">{{ event.description.substring(0, 100) }}...</p>
          </div>
          
          <div class="card-footer">
            <a href="#" @click.stop.prevent="editEvent(event.id, $event)" class="action-btn edit-btn">✏️ Edit</a>
            <a href="#" @click.stop.prevent="promptDelete(event.id, $event)" class="action-btn delete-btn">🗑️ Delete</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content card" @click.stop>
        <h2>Confirm Deletion</h2>
        <p>Are you sure you want to permanently delete this event? This action cannot be undone and all registrations, media, and chat messages will be wiped.</p>
        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">Cancel</button>
          <button @click="confirmDelete" class="btn btn-danger">Yes, Delete Event</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-events-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.page-title {
  color: var(--primary-color);
}
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}
.event-card {
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative; /* Required for absolute children */
}
.card-banner {
  height: 180px;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--border-light);
}
.card-content {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-content-body {
  padding: 1.5rem;
  flex: 1;
  cursor: pointer;
}
.card-footer {
  display: flex;
  border-top: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
}
.action-btn {
  flex: 1;
  padding: 1rem;
  text-align: center;
  font-weight: 500;
  font-size: 0.95rem;
  text-decoration: none;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}
.edit-btn {
  color: var(--text-color);
  border-right: 1px solid var(--border-light);
}
.edit-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--primary-color);
}
.delete-btn {
  color: var(--danger-color);
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}
.modal-content {
  max-width: 400px;
  width: 90%;
  padding: 2rem;
  background: var(--surface-color);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}
.modal-content h2 {
  margin-top: 0;
  color: var(--danger-color);
}
.modal-content p {
  color: var(--text-muted);
  margin-bottom: 2rem;
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
.attendee-badge {
  display: inline-block;
  background: rgba(139, 92, 246, 0.15);
  color: var(--primary-color);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.25rem;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(139, 92, 246, 0.3);
}
.location-text, .date-text {
  color: var(--secondary-color);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  font-weight: 500;
}
.location-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}
.location-link:hover {
  text-decoration: underline;
  color: var(--secondary-color);
}
.desc-text {
  margin-top: 1rem;
  font-size: 0.95rem;
  color: var(--text-muted);
}
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}
.error-msg {
  color: #ef4444;
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.loading {
  text-align: center;
  padding: 4rem;
  font-size: 1.2rem;
  color: var(--secondary-color);
}
.card-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 2rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid currentColor;
}
.status-badge.pending { color: #eab308; background: rgba(234, 179, 8, 0.1); }
.status-badge.approved { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
.status-badge.rejected { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.btn-danger {
  background-color: #ef4444;
  color: white;
}
.btn-danger:hover {
  background-color: #dc2626;
}
.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .events-grid {
    grid-template-columns: 1fr;
  }
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>

