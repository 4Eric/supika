<script setup>
import { API_URL } from '@/config/api'
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import EventMap from '@/components/EventMap.vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { getImageUrl } from '@/utils/imageUrl'

const uiStore = useUiStore()
const localEvents = ref([])
const router = useRouter()
const mapRef = ref(null)
const previewEvent = ref(null)
const isPreviewVisible = ref(false)

const filteredEvents = computed(() => {
  const q = (uiStore.searchQuery || '').toLowerCase()
  if (!q) return localEvents.value
  return localEvents.value.filter(event => 
    (event.title && event.title.toLowerCase().includes(q)) || 
    (event.locationName && event.locationName.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events?limit=1000`)
    localEvents.value = res.data
  } catch (err) {
    console.error('Failed to load events:', err)
  }
})

const goToEvent = (id) => {
  router.push(`/event/${id}`)
}

const handleEventPreview = (event) => {
  previewEvent.value = event
  isPreviewVisible.value = true
}

const closePreview = () => {
  isPreviewVisible.value = false
}

const locateMe = () => {
  if (mapRef.value) mapRef.value.locateUser()
}

const formatLocation = (loc) => {
  if (!loc) return 'Unknown location'
  const parts = loc.split(',').map(p => p.trim())
  if (parts.length <= 2) return loc
  return parts.slice(0, 2).join(', ')
}
</script>

<template>
  <div class="map-page">
    <!-- Full-Bleed Map -->
    <div class="map-full">
      <EventMap 
        ref="mapRef"
        :events="filteredEvents"
        :immersive="true"
        @markerClick="goToEvent"
        @eventPreview="handleEventPreview" 
      />
    </div>

    <!-- Floating Event Count Pill -->
    <div class="floating-pill">
      <span class="pill-dot"></span>
      <span>{{ filteredEvents.length }} events near you</span>
    </div>

    <!-- Locate Me FAB -->
    <button class="locate-fab" @click="locateMe" title="Find my location">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
    </button>

    <!-- Sliding Preview Card -->
    <Transition name="slide-up">
      <div v-if="isPreviewVisible && previewEvent" class="preview-sheet" @click.self="closePreview">
        <div class="preview-card">
          <button class="preview-close" @click="closePreview">✕</button>
          <div class="preview-image">
            <img :src="getImageUrl(previewEvent.imageUrl)" :alt="previewEvent.title" />
            <span v-if="!previewEvent.requiresApproval" class="preview-badge">⚡ Instant</span>
          </div>
          <div class="preview-body">
            <h3 class="preview-title">{{ previewEvent.title }}</h3>
            <div class="preview-meta">
              <span class="preview-meta-item">📍 {{ formatLocation(previewEvent.locationName) }}</span>
              <span class="preview-meta-item">📅 {{ new Date(previewEvent.date).toLocaleDateString() }}</span>
              <span class="preview-meta-item" v-if="previewEvent.attendeeCount">👥 {{ previewEvent.attendeeCount }} joined</span>
            </div>
            <button class="preview-cta" @click="goToEvent(previewEvent.id)">
              View Details →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-page {
  position: relative;
  width: 100%;
  height: calc(100vh - 80px);
  overflow: hidden;
}

.map-full {
  position: absolute;
  inset: 0;
}

/* --- Floating Pill --- */
.floating-pill {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  border: 1px solid var(--border-light);
  padding: 0.6rem 1.4rem;
  border-radius: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  pointer-events: none;
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 6px #34d399;
  animation: dotPulse 2s infinite;
}

@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* --- Locate Me FAB --- */
.locate-fab {
  position: absolute;
  bottom: 2rem;
  left: 1rem;
  z-index: 10;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--border-light);
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
}

.locate-fab:hover {
  background: var(--input-bg);
  border-color: var(--primary-color);
  transform: scale(1.08);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.3);
}

.locate-fab:active {
  transform: scale(0.95);
}

/* --- Preview Sheet --- */
.preview-sheet {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 20;
  padding: 1rem;
  pointer-events: none;
}

.preview-card {
  pointer-events: auto;
  max-width: 420px;
  margin: 0 auto;
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  position: relative;
}

.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.preview-close:hover {
  background: rgba(239, 68, 68, 0.5);
}

.preview-image {
  position: relative;
  width: 100%;
  height: 160px;
  overflow: hidden;
}

.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(52, 211, 153, 0.9);
  color: #fff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  backdrop-filter: blur(4px);
}

.preview-body {
  padding: 1rem 1.25rem 1.25rem;
}

.preview-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.6rem;
  color: var(--text-main);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 1rem;
}

.preview-meta-item {
  font-size: 0.8rem;
  color: var(--text-muted, #9ca3af);
}

.preview-cta {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  color: var(--btn-text-on-primary);
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
}

.preview-cta:active {
  transform: scale(0.98);
}

/* --- Slide Up Transition --- */
.slide-up-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-leave-active {
  transition: all 0.25s ease-in;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* --- Mobile Adjustments --- */
@media (max-width: 768px) {
  .map-page {
    height: calc(100vh - 100px);
  }

  .floating-pill {
    top: 0.75rem;
    font-size: 0.78rem;
    padding: 0.5rem 1rem;
  }

  .locate-fab {
    bottom: 1.5rem;
    left: 0.75rem;
  }

  .preview-card {
    max-width: 100%;
  }

  .preview-image {
    height: 130px;
  }
}

/* --- Desktop: Side Panel --- */
@media (min-width: 992px) {
  .preview-sheet {
    right: 1rem;
    left: auto;
    bottom: 1rem;
    padding: 0;
    width: 380px;
  }

  .preview-card {
    max-width: 380px;
  }
}
</style>
