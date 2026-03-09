<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getImageUrl } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const hostId = route.params.id

const publicInfo = ref(null)
const upcomingEvents = ref([])
const pastEvents = ref([])
const loading = ref(true)

const fetchHostData = async () => {
  try {
    loading.value = true
    // Fetch Profile
    const profileRes = await axios.get(`${API_URL}/api/users/${hostId}/public`)
    publicInfo.value = profileRes.data

    // Fetch Events (Upcoming)
    const upcomingRes = await axios.get(`${API_URL}/api/users/${hostId}/events?time_filter=upcoming`)
    upcomingEvents.value = upcomingRes.data

    // Fetch Events (Past)
    const pastRes = await axios.get(`${API_URL}/api/users/${hostId}/events?time_filter=past`)
    pastEvents.value = pastRes.data
  } catch (err) {
    console.error('Failed to load host data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchHostData)

const formatLocation = (loc) => {
  if (!loc) return ''
  const parts = loc.split(',').map(p => p.trim())
  if (parts.length <= 2) return loc
  const isZip = (str) => /\d/.test(str) && str.length <= 10
  let stateIdx = parts.length - 2
  if (isZip(parts[stateIdx])) stateIdx--
  const cityIdx = stateIdx - 1
  if (cityIdx >= 0) return `${parts[cityIdx]}, ${parts[stateIdx]}`
  return parts.slice(0, 2).join(', ')
}

const goToEvent = (id) => {
  router.push(`/event/${id}`)
}
</script>

<template>
  <div class="profile-container" v-if="publicInfo">
    <!-- Cinematic Header -->
    <div class="profile-hero">
      <div class="hero-blur" :style="{ backgroundImage: `url(${getImageUrl(publicInfo.avatarUrl)})` }"></div>
      <div class="hero-overlay"></div>
      
      <div class="hero-content">
        <div class="avatar-wrapper">
          <div class="main-avatar">
            {{ publicInfo.username ? publicInfo.username.charAt(0).toUpperCase() : 'U' }}
          </div>
          <div class="verified-badge" v-if="publicInfo.eventsHostedCount > 5">✨</div>
        </div>
        
        <h1 class="host-name">{{ publicInfo.username }}</h1>
        <span class="role-pill">Event Organizer</span>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ publicInfo.eventsHostedCount }}</span>
            <span class="stat-label">Events Hosted</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ publicInfo.totalAttendeesCount }}</span>
            <span class="stat-label">Total Attendees</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ new Date(publicInfo.createdAt).getFullYear() }}</span>
            <span class="stat-label">Joined</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Sections -->
    <div class="profile-body">
      
      <!-- Upcoming -->
      <section class="events-section">
        <h2 class="section-title">Upcoming Vibe</h2>
        <div v-if="upcomingEvents.length === 0" class="empty-state">
          <p>No upcoming events scheduled yet. Check back soon!</p>
        </div>
        <div class="masonry-grid" v-else>
          <div
            class="masonry-card"
            v-for="event in upcomingEvents"
            :key="event.id"
            @click="goToEvent(event.id)"
          >
            <div class="card-image-wrapper">
              <img :src="getImageUrl(event.imageUrl)" :alt="event.title" class="card-image" loading="lazy" />
              <span v-if="!event.requiresApproval" class="auto-badge">⚡ Instant</span>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ event.title }}</h3>
              <div class="card-meta">
                <span class="meta-item">📍 {{ formatLocation(event.locationName) }}</span>
                <span class="meta-item">📅 {{ new Date(event.date).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Legacy -->
      <section class="events-section legacy" v-if="pastEvents.length > 0">
        <h2 class="section-title">Legacy</h2>
        <div class="masonry-grid">
          <div
            class="masonry-card is-past"
            v-for="event in pastEvents"
            :key="event.id"
            @click="goToEvent(event.id)"
          >
            <div class="card-image-wrapper">
              <img :src="getImageUrl(event.imageUrl)" :alt="event.title" class="card-image" loading="lazy" />
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ event.title }}</h3>
              <div class="card-meta">
                <span class="meta-item">📍 {{ formatLocation(event.locationName) }}</span>
                <span class="meta-item">📅 {{ new Date(event.date).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.profile-container {
  min-height: 100vh;
  background: var(--bg-color);
  color: var(--text-main);
  padding-bottom: 5rem;
}

/* --- Hero Section --- */
.profile-hero {
  position: relative;
  height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-blur {
  position: absolute;
  top: -50px; left: -50px; right: -50px; bottom: -50px;
  background-size: cover;
  background-position: center;
  filter: blur(40px) brightness(0.4);
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, var(--bg-color) 95%);
  z-index: 2;
}

.hero-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 2rem;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 1.5rem;
}

.main-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 800;
  color: #000;
  box-shadow: 0 0 40px rgba(56, 189, 248, 0.4);
  border: 4px solid rgba(255, 255, 255, 0.1);
}

.verified-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.host-name {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  letter-spacing: -1px;
}

.role-pill {
  background: rgba(255,255,255,0.08);
  padding: 0.4rem 1.2rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primary-color);
  border: 1px solid rgba(56, 189, 248, 0.2);
  margin-bottom: 2rem;
}

.stats-grid {
  display: flex;
  gap: 1.5rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  padding: 1rem 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  min-width: 110px;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* --- Body --- */
.profile-body {
  max-width: 1200px;
  margin: -2rem auto 0;
  padding: 0 1.5rem;
  position: relative;
  z-index: 4;
}

.events-section {
  margin-bottom: 4rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  background: var(--card-bg);
  border-radius: 16px;
  border: 1px dashed rgba(255,255,255,0.1);
  color: var(--text-muted);
}

/* --- Masonry Duplicated from Home (Refactor later) --- */
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.masonry-card {
  border-radius: 14px;
  overflow: hidden;
  background: var(--card-bg);
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.masonry-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 30px rgba(56, 189, 248, 0.15);
}

.is-past {
  filter: grayscale(0.8);
  opacity: 0.6;
}

.is-past:hover {
  filter: grayscale(0.2);
  opacity: 1;
}

.card-image-wrapper {
  position: relative;
  aspect-ratio: 16/10;
}

.card-image {
  width: 100%; height: 100%; object-fit: cover;
}

.auto-badge {
  position: absolute; top: 10px; right: 10px;
  background: rgba(52, 211, 153, 0.9);
  color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700;
}

.card-body { padding: 1rem; }
.card-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.card-meta { display: flex; flex-direction: column; gap: 4px; }
.meta-item { font-size: 0.8rem; color: var(--text-muted); }

@media (max-width: 768px) {
  .profile-hero { height: 400px; }
  .host-name { font-size: 1.8rem; }
  .stats-grid { gap: 0.75rem; width: 100%; padding: 0 1rem; }
  .stat-card { flex: 1; min-width: 0; padding: 0.75rem 0.5rem; }
  .stat-value { font-size: 1.1rem; }
  .stat-label { font-size: 0.6rem; }
}
</style>
