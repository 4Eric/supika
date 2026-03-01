<script setup>
import { API_URL } from '@/config/api'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { getImageUrl } from '@/utils/imageUrl'

const uiStore = useUiStore()
const authStore = useAuthStore()
const router = useRouter()

const allEvents = ref([])
const myEvents = ref([])
const activeFilter = ref('All')
const filters = [
  { label: 'All', icon: '🌍' },
  { label: 'Today', icon: '⏱️' },
  { label: 'Tomorrow', icon: '🌅' },
  { label: 'This Weekend', icon: '🎉' },
  { label: 'Next Week', icon: '⏭️' },
  { label: 'Auto-Accept', icon: '⚡' }
]

// Pagination State
const limit = 12
const offset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)
const observerTarget = ref(null)
let observer = null

const fetchEvents = async (append = false) => {
  try {
    const res = await axios.get(`${API_URL}/api/events?limit=${limit}&offset=${offset.value}`)
    const newEvents = res.data
    
    if (newEvents.length < limit) {
      hasMore.value = false
    }

    if (append) {
      allEvents.value = [...allEvents.value, ...newEvents]
    } else {
      allEvents.value = newEvents
    }
    
    // Always sort by date after fetching
    allEvents.value.sort((a, b) => new Date(a.date) - new Date(b.date))
  } catch (err) {
    console.error('Failed to load events:', err)
  }
}

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  offset.value += limit
  await fetchEvents(true)
  loadingMore.value = false
}

onMounted(async () => {
  await fetchEvents()
  
  try {
    if (authStore.isAuthenticated && authStore.token) {
      const myRes = await axios.get(`${API_URL}/api/events/registered/me`, {
        headers: { 'x-auth-token': authStore.token }
      })
      myEvents.value = myRes.data
    }
  } catch (err) {
    console.error('Failed to load registered events:', err)
  }

  // Setup Intersection Observer for infinite scrolling
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore.value && !loadingMore.value) {
      loadMore()
    }
  }, { rootMargin: '200px' }) // Trigger 200px before reaching the bottom

  if (observerTarget.value) {
    observer.observe(observerTarget.value)
  }
})

onUnmounted(() => {
  if (observer && observerTarget.value) {
    observer.unobserve(observerTarget.value)
  }
})

// --- Recommendation Engine ---
const stopWords = ['the', 'is', 'at', 'which', 'and', 'on', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'from', 'this', 'that', 'by', 'as', 'it', 'are', 'was', 'were', 'be', 'been', 'will', 'or', 'but', 'not', 'if', 'then', 'you', 'your', 'i', 'my', 'we', 'our']

const userKeywords = computed(() => {
  if (myEvents.value.length === 0) return []
  const textBlob = myEvents.value.map(e => (e.title + ' ' + (e.description || ''))).join(' ').toLowerCase()
  const words = textBlob.replace(/[^\w\s]/g, '').split(/\s+/)
  const freq = {}
  words.forEach(w => {
    if (w.length > 3 && !stopWords.includes(w)) {
      freq[w] = (freq[w] || 0) + 1
    }
  })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0])
})

// --- Date & Search Filtering ---
const timeFilteredEvents = computed(() => {
  let filtered = allEvents.value

  if (activeFilter.value === 'Auto-Accept') {
    filtered = filtered.filter(e => !e.requiresApproval)
  } else if (activeFilter.value !== 'All') {
    const now = new Date()
    const todayStr = now.toDateString()

    filtered = filtered.filter(e => {
      const eDate = new Date(e.date)
      if (activeFilter.value === 'Today') {
        return eDate.toDateString() === todayStr
      } else if (activeFilter.value === 'Tomorrow') {
        const tmrw = new Date(now)
        tmrw.setDate(tmrw.getDate() + 1)
        return eDate.toDateString() === tmrw.toDateString()
      } else if (activeFilter.value === 'This Weekend') {
        const day = now.getDay()
        const diffToSat = (6 - day + 7) % 7
        const sat = new Date(now)
        sat.setDate(now.getDate() + (diffToSat === 0 && now.getHours() < 24 ? 0 : diffToSat))
        const sun = new Date(sat)
        sun.setDate(sat.getDate() + 1)
        return eDate.toDateString() === sat.toDateString() || eDate.toDateString() === sun.toDateString()
      } else if (activeFilter.value === 'Next Week') {
        const diffDays = (eDate.getTime() - now.getTime()) / (1000 * 3600 * 24)
        return diffDays >= 7 && diffDays <= 14
      }
      return true
    })
  }

  const q = (uiStore.searchQuery || '').toLowerCase()
  if (q) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.locationName && e.locationName.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q))
    )
  }

  return filtered
})

// --- Unified Feed: Recommended first, then by date ---
const feedEvents = computed(() => {
  const events = timeFilteredEvents.value

  if (userKeywords.value.length === 0) {
    // New user — return events sorted by date (handled in fetchEvents)
    return events
  }

  // Score each event by keyword match
  const scored = events.map(e => {
    let score = 0
    const text = ((e.title || '') + ' ' + (e.description || '')).toLowerCase()
    userKeywords.value.forEach(kw => {
      if (text.includes(kw)) score++
    })
    return { ...e, _recScore: score }
  })

  // We disabled sorting by recommendation score to prevent order shifting
  // during pagination. Recommended events will still get a 'For You' badge.
  // Events are already sorted by date from the backend.
  return scored
})

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
  <div class="discover-container">

    <!-- Filter Pills Area -->
    <div class="filter-bar-wrapper">
      <div class="filter-pills-container">
        <button
          v-for="filter in filters"
          :key="filter.label"
          class="filter-pill"
          :class="{ active: activeFilter === filter.label }"
          @click="activeFilter = filter.label"
        >
          <span class="filter-icon">{{ filter.icon }}</span>
          <span class="filter-label">{{ filter.label === 'Auto-Accept' ? 'Instant' : filter.label }}</span>
        </button>
      </div>
      <div class="scroll-fade"></div>
    </div>

    <div v-if="feedEvents.length === 0" class="no-results">
      <h3>No events found 🕵️</h3>
      <p>Try adjusting your search or date filters.</p>
    </div>

    <!-- Masonry Waterfall Grid -->
    <div class="masonry-grid" v-else>
      <div
        class="masonry-card"
        v-for="event in feedEvents"
        :key="event.id"
        @click="goToEvent(event.id)"
      >
        <!-- Image -->
        <div class="card-image-wrapper">
          <img
            :src="getImageUrl(event.imageUrl)"
            :alt="event.title"
            class="card-image"
            loading="lazy"
          />
          <!-- For You badge -->
          <span v-if="event._recScore > 0" class="for-you-badge">✨ For You</span>
          <!-- Auto-Accept badge -->
          <span v-if="!event.requiresApproval" class="auto-badge">⚡ Instant</span>
        </div>

        <!-- Content -->
        <div class="card-body">
          <h3 class="card-title">{{ event.title }}</h3>
          <div class="card-meta">
            <span class="meta-item">
              📍 <a
                :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`"
                target="_blank"
                @click.stop
                class="location-link"
              >{{ formatLocation(event.locationName) }}</a>
            </span>
            <span class="meta-item">📅 {{ new Date(event.date).toLocaleDateString() }}</span>
          </div>
          <div class="card-author">
            <div class="author-avatar">{{ (event.creatorName || 'U').charAt(0).toUpperCase() }}</div>
            <span class="author-name">{{ event.creatorName || 'Organizer' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Infinite Scroll Observer Target -->
    <div ref="observerTarget" class="load-more-container">
      <p v-if="loadingMore" class="loading-text">Loading more events...</p>
    </div>

  </div>
</template>

<style scoped>
.discover-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

/* ---- Elegant Filter Bar ---- */
.filter-bar-wrapper {
  position: relative;
  width: 100%;
  margin-bottom: 0.5rem;
}
.filter-pills-container {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.5rem 1rem 0.5rem 0.25rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.filter-pills-container::-webkit-scrollbar {
  display: none;
}
.scroll-fade {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 40px;
  background: linear-gradient(to right, rgba(9,9,11,0), rgba(9,9,11,1));
  pointer-events: none;
}
.filter-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  padding: 0.55rem 1.2rem;
  border-radius: 30px;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.filter-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}
.filter-pill:active {
  transform: scale(0.96);
}
.filter-pill.active {
  background: rgba(56, 189, 248, 0.15);
  color: #fff;
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.3), inset 0 0 10px rgba(56, 189, 248, 0.1);
}
.filter-pill.active .filter-icon {
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}
.filter-icon {
  font-size: 1.1rem;
  line-height: 1;
}
.filter-label {
  letter-spacing: 0.2px;
}

/* ---- Grid Layout (Fixes Masonry Reflow Jumping) ---- */
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}

/* ---- Card ---- */
.masonry-card {
  border-radius: 14px;
  overflow: hidden;
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.masonry-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(56, 189, 248, 0.15), 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* Image */
.card-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}
.card-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: transform 0.35s ease;
}
.masonry-card:hover .card-image {
  transform: scale(1.04);
}

/* Badges */
.for-you-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(56, 189, 248, 0.85);
  backdrop-filter: blur(8px);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.3px;
}
.auto-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(52, 211, 153, 0.85);
  backdrop-filter: blur(8px);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.3px;
}

/* Card Body */
.card-body {
  padding: 10px 12px 12px;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--text-main);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.meta-item {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.location-link {
  color: var(--text-muted);
  text-decoration: none;
}
.location-link:hover {
  color: var(--secondary-color);
  text-decoration: underline;
}

/* Author Row */
.card-author {
  display: flex;
  align-items: center;
  gap: 6px;
}
.author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: black;
  flex-shrink: 0;
}
.author-name {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* No Results */
.no-results {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 1rem;
}
.no-results h3 {
  font-size: 1.3rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}
.no-results p {
  color: var(--text-muted);
}

/* Load More */
.load-more-container {
  display: flex;
  justify-content: center;
  margin: 2rem 0 4rem;
}
.load-more-btn {
  background: var(--surface-color);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  padding: 0.75rem 2.5rem;
  border-radius: 2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.load-more-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
}
.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Responsive ---- */

/* Tablet */
@media (min-width: 640px) {
  /* CSS Grid handles columns automatically now */
}

/* Desktop */
@media (min-width: 1024px) {
  .card-title {
    font-size: 0.95rem;
  }
}

/* Small Mobile */
@media (max-width: 400px) {
  .masonry-grid {
    gap: 12px;
  }
  .masonry-card {
    border-radius: 10px;
  }
  .card-body {
    padding: 8px 10px 10px;
  }
  .card-title {
    font-size: 0.82rem;
  }
}
</style>
