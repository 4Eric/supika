<script setup>
import { API_URL } from '@/config/api'
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import EventMap from '@/components/EventMap.vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const localEvents = ref([])
const router = useRouter()

const filteredEvents = computed(() => {
  const q = (uiStore.searchQuery || '').toLowerCase()
  if (!q) return localEvents.value
  return localEvents.value.filter(event => 
    event.title.toLowerCase().includes(q) || 
    (event.location_name && event.location_name.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  try {
    // Increase limit for map to see more events, or eventually use a bounding box API
    const res = await axios.get(`${API_URL}/api/events?limit=1000`)
    localEvents.value = res.data
  } catch (err) {
    console.error('Failed to load events:', err)
  }
})

const goToEvent = (id) => {
  router.push(`/event/${id}`)
}
</script>

<template>
  <div class="map-view-container">
    <div class="header-overlay">
      <h2>Interactive Map</h2>
      <p>Discover {{ filteredEvents.length }} events near you.</p>
    </div>
    <div class="map-wrapper">
      <EventMap :events="filteredEvents" @markerClick="goToEvent" />
    </div>
  </div>
</template>

<style scoped>
.map-view-container {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  height: calc(100vh - 80px); /* Adjust based on App.vue top header */
  gap: 1.5rem;
}

.header-overlay h2 {
  font-size: 1.8rem;
  color: var(--primary-color);
  margin-bottom: 0.2rem;
}

.header-overlay p {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.map-wrapper {
  flex: 1;
  width: 100%;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  border: 1px solid var(--border-light);
  min-height: 400px;
}

@media (max-width: 768px) {
  .map-view-container {
    padding: 1rem;
    height: calc(100vh - 120px);
    gap: 1rem;
  }
  .header-overlay h2 {
    font-size: 1.5rem;
  }
  .map-wrapper {
    border-radius: 0.5rem;
  }
}
</style>
