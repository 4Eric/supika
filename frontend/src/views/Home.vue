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
    // Sort broadly by date first so hero is chronologically relevant
    allEvents.value = res.data.sort((a,b) => new Date(a.date) - new Date(b.date))

    if (authStore.isAuthenticated && authStore.token) {
      const myRes = await axios.get(`${API_URL}/api/events/registered/me`, {
        headers: { 'x-auth-token': authStore.token }
      })
      // myRes.data returns rows from Registrations JOIN Events
      myEvents.value = myRes.data 
    }
  } catch (err) {
    console.error('Failed to load events:', err)
  }
})

// Machine Learning-lite Keyword Extraction
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
  // sort by frequency, return top 10 keywords
  return Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 10).map(x => x[0])
})

// Filter by Date Pills & Search box
const timeFilteredEvents = computed(() => {
  let filtered = allEvents.value
  
  // Auto-Accept filter works independently of date filters
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
        const diffToSatAdjusted = diffToSat === 0 && now.getHours() < 24 ? 0 : diffToSat // handle if today is saturday
        const sat = new Date(now)
        sat.setDate(now.getDate() + diffToSatAdjusted)
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

// 1. Hero Event (First relevant event)
const heroEvent = computed(() => {
  const events = timeFilteredEvents.value
  return events.length > 0 ? events[0] : null
})

// 2. Recommended For You
const recommendedEvents = computed(() => {
  const others = timeFilteredEvents.value.slice(1) // exclude hero
  
  if (userKeywords.value.length === 0) {
    // Graceful fallback for brand new users - random sample
    return [...others].sort(() => 0.5 - Math.random()).slice(0, 6)
  }
  
  const scored = others.map(e => {
    let score = 0
    const textBlob = ((e.title || '') + ' ' + (e.description || '')).toLowerCase()
    userKeywords.value.forEach(kw => {
      if (textBlob.includes(kw)) score++
    })
    return { event: e, score }
  })
  
  // Sort by score descendant, slice top 6
  return scored.sort((a,b) => b.score - a.score).slice(0, 6).map(s => s.event)
})

// 3. Trending Now (Random pool excluding Recommended & Hero)
const trendingEvents = computed(() => {
  const recIds = new Set(recommendedEvents.value.map(e => e.id))
  // Filter out the hero and recommended from the general pool
  const others = timeFilteredEvents.value.slice(1).filter(e => !recIds.has(e.id))
  // Pure random sort for serendipity
  return [...others].sort(() => 0.5 - Math.random()).slice(0, 6)
})

// 4. All Upcoming Feed
const allUpcomingEvents = computed(() => {
  const usedIds = new Set([
    ...(heroEvent.value ? [heroEvent.value.id] : []),
    ...recommendedEvents.value.map(e => e.id),
    ...trendingEvents.value.map(e => e.id)
  ])
  return timeFilteredEvents.value.filter(e => !usedIds.has(e.id))
})

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

    <div v-if="timeFilteredEvents.length === 0" class="no-results">
      <h3>No events found 🕵️</h3>
      <p>Try adjusting your search or date filters.</p>
    </div>

    <!-- Hero Spotlight -->
    <section v-if="heroEvent" class="hero-spotlight" @click="goToEvent(heroEvent.id)">
      <div class="hero-bg" :style="{ backgroundImage: 'url(' + getImageUrl(heroEvent.image_url) + ')' }"></div>
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <span class="spotlight-tag">🌟 Spotlight Event</span>
        <h2>{{ heroEvent.title }}</h2>
        <p class="hero-meta">📍 {{ formatLocation(heroEvent.location_name) }} • 📅 {{ new Date(heroEvent.date).toLocaleDateString() }}</p>
      </div>
    </section>

    <!-- Recommended For You Lane -->
    <section class="section-container" v-if="recommendedEvents.length > 0">
      <div class="section-header">
        <h2>Recommended For You ✨</h2>
        <p v-if="userKeywords.length > 0">Based on your past RSVPs (Topics: <span class="keyword-highlight">{{ userKeywords.slice(0,3).join(', ') }}</span>)</p>
        <p v-else>Top picks to kickstart your vibe journey.</p>
      </div>
      
      <div class="horizontal-scroll">
        <div class="card event-card" v-for="event in recommendedEvents" :key="event.id" @click="goToEvent(event.id)">
          <div class="card-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.image_url) + ')' }"></div>
          <div class="card-content">
            <h3>{{ event.title }}</h3>
            <p class="event-meta">
              📍 <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" @click.stop class="location-link">{{ formatLocation(event.location_name) }}</a>
            </p>
            <p class="event-meta">📅 {{ new Date(event.date).toLocaleDateString() }}</p>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" @click.stop="goToEvent(event.id)">Book Now</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trending Now Lane -->
    <section class="section-container" v-if="trendingEvents.length > 0">
      <div class="section-header">
        <h2>Trending Now 🔥</h2>
        <p>What's hot and happening around the city.</p>
      </div>
      
      <div class="horizontal-scroll">
        <div class="card event-card" v-for="event in trendingEvents" :key="event.id" @click="goToEvent(event.id)">
          <div class="card-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.image_url) + ')' }"></div>
          <div class="card-content">
            <h3>{{ event.title }}</h3>
            <p class="event-meta">
              📍 <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" @click.stop class="location-link">{{ formatLocation(event.location_name) }}</a>
            </p>
            <p class="event-meta">📅 {{ new Date(event.date).toLocaleDateString() }}</p>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" @click.stop="goToEvent(event.id)">Book Now</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- All Upcoming Grid -->
    <section class="section-container" v-if="allUpcomingEvents.length > 0">
      <div class="section-header">
        <h2>All Upcoming Events 📅</h2>
        <p>Keep scrolling to find more hidden gems.</p>
      </div>
      
      <div class="vertical-grid">
        <div class="card event-card vertical-card" v-for="event in allUpcomingEvents" :key="event.id" @click="goToEvent(event.id)">
          <div class="card-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.image_url) + ')' }"></div>
          <div class="card-content">
            <h3>{{ event.title }}</h3>
            <p class="event-meta">
              📍 <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" @click.stop class="location-link">{{ formatLocation(event.location_name) }}</a>
            </p>
            <p class="event-meta">📅 {{ new Date(event.date).toLocaleDateString() }}</p>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" @click.stop="goToEvent(event.id)">Book Now</button>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.discover-container {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding: 1.5rem;
  padding-bottom: 3rem;
}

/* Date Pills */
.filter-pills-container {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  margin-bottom: -1rem; /* tighten gap to hero */
}
.filter-pills-container::-webkit-scrollbar {
  display: none;
}
.filter-pill {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  padding: 0.6rem 1.25rem;
  border-radius: 2rem;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.filter-pill:hover {
  background: rgba(255, 255, 255, 0.1);
}
.filter-pill.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
}

/* Hero Spotlight */
.hero-spotlight {
  position: relative;
  width: 100%;
  height: 380px;
  border-radius: 1.5rem;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.hero-spotlight:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0,0,0,0.6);
}
.hero-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
  z-index: 1;
}
.hero-gradient {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);
  z-index: 2;
}
.hero-content {
  position: relative;
  z-index: 3;
  padding: 2.5rem;
}
.spotlight-tag {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(8px);
  padding: 0.3rem 0.8rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.8rem;
  border: 1px solid rgba(255,255,255,0.3);
}
.hero-content h2 {
  font-size: 2.5rem;
  color: white;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.hero-meta {
  color: var(--text-muted);
  font-size: 1.1rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

/* Generic Section Layouts */
.section-header {
  margin-bottom: 1.25rem;
}
.section-header h2 {
  font-size: 1.7rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
  color: var(--text-main);
}
.section-header p {
  color: var(--text-muted);
  font-size: 0.95rem;
}
.keyword-highlight {
  color: var(--primary-color);
  font-weight: 600;
}

/* Horizontal scroll lanes */
.horizontal-scroll {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  scroll-behavior: smooth;
}
.horizontal-scroll::-webkit-scrollbar {
  height: 8px;
}
.horizontal-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.horizontal-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.horizontal-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Vertical grid for 'All Upcoming' */
.vertical-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Base Card Styles */
.event-card {
  min-width: 300px;
  max-width: 300px;
  flex: 0 0 auto;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.vertical-card {
  min-width: 0;
  max-width: none;
}
.card-banner {
  height: 180px;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--border-light);
}
.card-content {
  padding: 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-content h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-meta {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.location-link {
  color: var(--text-muted);
  text-decoration: none;
}
.location-link:hover {
  text-decoration: underline;
  color: var(--secondary-color);
}
.card-actions {
  margin-top: auto;
  padding-top: 1rem;
}
.btn-sm {
  width: 100%;
}

.no-results {
  text-align: center;
  padding: 4rem;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 1rem;
}
.no-results h3 {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

/* Mobile Breakpoints */
@media (max-width: 768px) {
  .discover-container {
    padding: 1rem;
    gap: 2rem;
  }
  .hero-spotlight {
    height: 300px;
  }
  .hero-content {
    padding: 1.5rem;
  }
  .hero-content h2 {
    font-size: 1.8rem;
  }
  .section-header h2 {
    font-size: 1.4rem;
  }
  .event-card {
    min-width: 260px;
    max-width: 260px;
  }
  .card-banner {
    height: 150px;
  }
}
</style>

