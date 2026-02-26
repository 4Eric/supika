<script setup>
import { API_URL } from '@/config/api'
import { ref, computed, onMounted } from 'vue'
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
const filters = ['All', 'Today', 'Tomorrow', 'This Weekend', 'Next Week', 'Auto-Accept']

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events`)
    allEvents.value = res.data.sort((a, b) => new Date(a.date) - new Date(b.date))

    if (authStore.isAuthenticated && authStore.token) {
      const myRes = await axios.get(`${API_URL}/api/events/registered/me`, {
        headers: { 'x-auth-token': authStore.token }
      })
      myEvents.value = myRes.data
    }
  } catch (err) {
    console.error('Failed to load events:', err)
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
    filtered = filtered.filter(e => !e.requires_approval)
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
      (e.location_name && e.location_name.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q))
    )
  }

  return filtered
})

// --- Unified Feed: Recommended first, then by date ---
const feedEvents = computed(() => {
  const events = timeFilteredEvents.value

  if (userKeywords.value.length === 0) {
    // New user — shuffle for serendipity
    return [...events].sort(() => 0.5 - Math.random())
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

  // Recommended first (score > 0), then by date
  return scored.sort((a, b) => {
    if (b._recScore !== a._recScore) return b._recScore - a._recScore
    return new Date(a.date) - new Date(b.date)
  })
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

    <!-- Filter Pills -->
    <div class="filter-pills-container">
      <button
        v-for="filter in filters"
        :key="filter"
        class="filter-pill"
        :class="{ active: activeFilter === filter }"
        @click="activeFilter = filter"
      >
        {{ filter }}
      </button>
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
            :src="getImageUrl(event.image_url)"
            :alt="event.title"
            class="card-image"
            loading="lazy"
          />
          <!-- For You badge -->
          <span v-if="event._recScore > 0" class="for-you-badge">✨ For You</span>
          <!-- Auto-Accept badge -->
          <span v-if="!event.requires_approval" class="auto-badge">⚡ Instant</span>
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
              >{{ formatLocation(event.location_name) }}</a>
            </span>
            <span class="meta-item">📅 {{ new Date(event.date).toLocaleDateString() }}</span>
          </div>
          <div class="card-author">
            <div class="author-avatar">{{ (event.creator_name || 'U').charAt(0).toUpperCase() }}</div>
            <span class="author-name">{{ event.creator_name || 'Organizer' }}</span>
          </div>
        </div>
      </div>
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

/* ---- Filter Pills ---- */
.filter-pills-container {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.filter-pills-container::-webkit-scrollbar {
  display: none;
}
.filter-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  padding: 0.45rem 1rem;
  border-radius: 2rem;
  font-weight: 500;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-family: inherit;
}
.filter-pill:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-main);
}
.filter-pill.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

/* ---- Masonry Grid ---- */
.masonry-grid {
  column-count: 2;
  column-gap: 12px;
}

/* ---- Card ---- */
.masonry-card {
  break-inside: avoid;
  margin-bottom: 12px;
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
  overflow: hidden;
}
.card-image {
  width: 100%;
  height: auto;
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

/* ---- Responsive ---- */

/* Tablet */
@media (min-width: 640px) {
  .masonry-grid {
    column-count: 3;
    column-gap: 14px;
  }
  .masonry-card {
    margin-bottom: 14px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .masonry-grid {
    column-count: 4;
    column-gap: 16px;
  }
  .masonry-card {
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 0.95rem;
  }
}

/* Large Desktop */
@media (min-width: 1400px) {
  .masonry-grid {
    column-count: 5;
    column-gap: 18px;
  }
}

/* Small Mobile */
@media (max-width: 400px) {
  .masonry-grid {
    column-gap: 8px;
  }
  .masonry-card {
    margin-bottom: 8px;
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
