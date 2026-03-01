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

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events/registered/me`, {
      headers: {
        'x-auth-token': authStore.token
      }
    })
    events.value = res.data
  } catch (error) {
    errorMsg.value = error.response?.data?.message || "Failed to load your events."
  } finally {
    loading.value = false
  }
})

const viewEvent = (id) => {
  router.push(`/event/${id}`)
}

const deregister = async (eventId, timeSlotId, eventObj) => {
  if (eventObj) eventObj.stopPropagation();
  try {
    const authStore = (await import('@/stores/auth')).useAuthStore()
    await axios.delete(`${API_URL}/api/events/${eventId}/register`, {
      headers: { 'x-auth-token': authStore.token },
      data: { timeSlotId: timeSlotId }
    })
    // Remove from local list
    events.value = events.value.filter(e => !(e.id === eventId && e.timeSlotId === timeSlotId))
  } catch (error) {
    errorMsg.value = "Failed to cancel registration."
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
      <h1 class="page-title">My Registered Events</h1>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading your events...</p>
    </div>

    <div v-else-if="errorMsg" class="error-msg">
      {{ errorMsg }}
    </div>

    <div v-else-if="events.length === 0" class="empty-state card">
      <h2>You haven't registered for any events yet.</h2>
      <p>Head over to the Discover page to find something exciting!</p>
      <router-link to="/" class="btn submit-btn" style="display: inline-block; margin-top: 1rem;">Discover Events</router-link>
    </div>

    <div v-else class="events-grid">
      <div v-for="event in events" :key="`${event.id}-${event.timeSlotId}`" class="card event-card" @click="viewEvent(event.id)">
        <div class="card-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.imageUrl) + ')' }"></div>
        <div class="card-content">
          <h3>{{ event.title }}</h3>
          <p class="location-text">
            📍 <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" @click.stop class="location-link">{{ formatLocation(event.locationName) }}</a>
          </p>
          <p class="date-text">📅 {{ new Date(event.date).toLocaleDateString() }} at {{ new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</p>
          <p class="desc-text">{{ event.description.substring(0, 100) }}...</p>
          
          <div class="card-actions">
            <span class="status-badge" :class="event.status">
              {{ event.status === 'pending' ? '⏳ Pending' : (event.status === 'rejected' ? '❌ Rejected' : '✅ Approved') }}
            </span>
            <button @click="deregister(event.id, event.timeSlotId, $event)" class="btn btn-danger btn-sm">Cancel</button>
          </div>
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
}
.card-banner {
  height: 180px;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--border-light);
}
.card-content {
  padding: 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-actions {
  margin-top: auto;
  padding-top: 1rem;
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

