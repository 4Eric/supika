<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_URL } from '@/config/api'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const host = ref(null)
const upcomingEvents = ref([])
const pastEvents = ref([])
const loading = ref(true)
const error = ref(null)
const activeTab = ref('upcoming')

const fetchHostProfile = async () => {
  try {
    loading.value = true
    const res = await axios.get(`${API_URL}/api/auth/users/${route.params.id}/events`)
    host.value = res.data.user
    upcomingEvents.value = res.data.upcoming
    pastEvents.value = res.data.past
    
    if (upcomingEvents.value.length === 0 && pastEvents.value.length > 0) {
      activeTab.value = 'past'
    }
  } catch (err) {
    console.error('Failed to fetch host profile', err)
    error.value = 'Host profile not found.'
  } finally {
    loading.value = false
  }
}

const getAvatarUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_URL}/uploads/${url}`
}

const formatEventDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

onMounted(fetchHostProfile)

const goToEvent = (id) => {
  router.push(`/event/${id}`)
}
</script>

<template>
  <div class="host-profile-page">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading profile...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <span class="error-icon">📭</span>
      <h2>{{ error }}</h2>
      <button @click="router.push('/')" class="btn btn-primary">Go Home</button>
    </div>

    <div v-else class="profile-container">
      <!-- Header Section -->
      <section class="profile-header card">
        <div class="profile-main-info">
          <div class="profile-avatar">
            <img v-if="host.avatarUrl" :src="getAvatarUrl(host.avatarUrl)" :alt="host.username" />
            <div v-else class="avatar-placeholder">{{ host.username.charAt(0).toUpperCase() }}</div>
          </div>
          <div class="profile-name-area">
            <h1>{{ host.username }}</h1>
            <p class="host-badge">✨ Event Host</p>
          </div>
        </div>
        
        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-value">{{ upcomingEvents.length }}</span>
            <span class="stat-label">Upcoming</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ pastEvents.length }}</span>
            <span class="stat-label">Past Hosted</span>
          </div>
        </div>
      </section>

      <!-- Events Feed Section -->
      <section class="events-feed">
        <div class="feed-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'upcoming' }"
            @click="activeTab = 'upcoming'"
          >
            Upcoming ({{ upcomingEvents.length }})
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'past' }"
            @click="activeTab = 'past'"
          >
            Past Events ({{ pastEvents.length }})
          </button>
        </div>

        <div class="tab-content">
          <TransitionGroup name="list" tag="div" class="event-grid">
            <div 
              v-for="event in (activeTab === 'upcoming' ? upcomingEvents : pastEvents)" 
              :key="event.id"
              class="event-card card"
              @click="goToEvent(event.id)"
            >
              <div class="event-image-container">
                <img :src="getAvatarUrl(event.imageUrl)" :alt="event.title" class="event-image" />
                <div v-if="activeTab === 'past'" class="past-overlay">Past</div>
              </div>
              <div class="event-info">
                <p class="event-date">{{ formatEventDate(event.date) }}</p>
                <h3 class="event-title">{{ event.title }}</h3>
                <p class="event-location">{{ event.locationName }}</p>
                <div class="event-footer">
                  <span class="attendee-count">👥 {{ event.attendeeCount }} vibing</span>
                  <span v-if="event.ticketPrice > 0" class="price-tag">${{ event.ticketPrice }}</span>
                  <span v-else class="free-badge">Free</span>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <div v-if="(activeTab === 'upcoming' ? upcomingEvents : pastEvents).length === 0" class="empty-feed">
            <span class="empty-icon">🏜️</span>
            <p>No {{ activeTab }} events found for this host.</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.host-profile-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.profile-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Header UI */
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3rem;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-color: var(--primary-color);
}

.profile-main-info {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid var(--primary-color);
  box-shadow: 0 0 30px rgba(56, 189, 248, 0.4);
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 3rem;
  font-weight: 800;
  color: var(--primary-color);
}

.profile-name-area h1 {
  font-size: 2.5rem;
  margin: 0;
  letter-spacing: -1px;
}

.host-badge {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 1rem;
  margin-top: 0.25rem;
}

.profile-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.05);
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  min-width: 120px;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--text-main);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Tabs */
.feed-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.tab-btn {
  padding: 0.8rem 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-light);
  background: var(--card-bg);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn.active {
  background: var(--primary-color);
  color: var(--btn-text-on-primary);
  border-color: var(--primary-color);
  box-shadow: 0 5px 15px rgba(56, 189, 248, 0.3);
}

/* Event Grid */
.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.event-card {
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}

.event-image-container {
  height: 160px;
  position: relative;
  overflow: hidden;
}

.event-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.event-card:hover .event-image {
  transform: scale(1.05);
}

.past-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.5rem;
  text-transform: uppercase;
}

.event-info {
  padding: 1.25rem;
}

.event-date {
  color: var(--primary-color);
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.event-title {
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  color: var(--text-main);
}

.event-location {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.attendee-count {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.price-tag {
  color: #10b981;
  font-weight: 700;
}

.free-badge {
  color: var(--primary-color);
  font-weight: 700;
}

/* States */
.loading-state, .error-state, .empty-feed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  text-align: center;
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-light);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.error-icon, .empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Mobile */
@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    padding: 2rem;
    gap: 1.5rem;
    text-align: center;
  }
  
  .profile-main-info {
    flex-direction: column;
    gap: 1rem;
  }
  
  .profile-name-area h1 {
    font-size: 2rem;
  }
  
  .profile-stats {
    width: 100%;
    gap: 1rem;
  }
  
  .stat-item {
    flex: 1;
    min-width: 0;
  }
  
  .event-grid {
    grid-template-columns: 1fr;
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
