<script setup>
import { API_URL } from '@/config/api'
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { getImageUrl } from '@/utils/imageUrl'

const authStore = useAuthStore()
const query = ref('')
const lat = ref(null)
const lng = ref(null)
const loading = ref(false)
const approving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// Discovery result waiting for review
const previewEvent = ref(null)

// Past discoveries
const discoveries = ref([])
const loadingList = ref(true)

const fetchDiscoveries = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/ai/discoveries`, {
      headers: { 'x-auth-token': authStore.token }
    })
    discoveries.value = res.data
  } catch (e) {
    console.error('Failed to load discoveries:', e)
  } finally {
    loadingList.value = false
  }
}
fetchDiscoveries()

// Get user's current location for context
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((pos) => {
    lat.value = pos.coords.latitude
    lng.value = pos.coords.longitude
  })
}

const discoverEvent = async () => {
  if (!query.value.trim()) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  previewEvent.value = null

  try {
    const res = await axios.post(`${API_URL}/api/ai/discover`, {
      query: query.value,
      lat: lat.value,
      lng: lng.value
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    previewEvent.value = res.data.event
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Discovery failed. Try a different query.'
  } finally {
    loading.value = false
  }
}

const approveEvent = async () => {
  if (!previewEvent.value) return
  approving.value = true
  errorMsg.value = ''
  
  try {
    const res = await axios.post(`${API_URL}/api/ai/approve`, {
      event: previewEvent.value
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    successMsg.value = `✅ "${res.data.event.title}" is now live on the map!`
    previewEvent.value = null
    fetchDiscoveries() // Refresh list
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Failed to approve event.'
  } finally {
    approving.value = false
  }
}

const rejectEvent = () => {
  previewEvent.value = null
  successMsg.value = ''
  errorMsg.value = ''
}
</script>

<template>
  <div class="ai-page">
    <div class="ai-header">
      <div class="ai-title-row">
        <span class="ai-icon">🤖</span>
        <h1>eFinder.ai</h1>
      </div>
      <p class="ai-subtitle">Discover real events from the internet and add them to Supika.</p>
    </div>

    <!-- Search Bar -->
    <div class="search-section">
      <form @submit.prevent="discoverEvent" class="search-form">
        <input 
          v-model="query"
          type="text"
          placeholder="e.g. music festivals this weekend, tech conferences nearby..."
          class="search-input"
          :disabled="loading"
        />
        <button type="submit" class="discover-btn" :disabled="loading || !query.trim()">
          <span v-if="loading" class="btn-spinner"></span>
          {{ loading ? 'Searching...' : '🔍 Discover' }}
        </button>
      </form>
      <p class="location-hint" v-if="lat">
        📍 Using your current location for better results
      </p>
    </div>

    <!-- Error / Success Messages -->
    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <!-- Preview Card -->
    <Transition name="slide-in">
      <div v-if="previewEvent" class="preview-section">
        <h2 class="section-title">Review Discovery</h2>
        <div class="preview-card">
          <div class="preview-image" v-if="previewEvent.imageUrl">
            <img :src="previewEvent.imageUrl" :alt="previewEvent.title" />
          </div>
          <div class="preview-body">
            <h3>{{ previewEvent.title }}</h3>
            <p class="preview-desc">{{ previewEvent.description }}</p>
            <div class="preview-meta">
              <span>📍 {{ previewEvent.locationName }}</span>
              <span>📅 {{ new Date(previewEvent.date).toLocaleString() }}</span>
              <a v-if="previewEvent.sourceUrl" :href="previewEvent.sourceUrl" target="_blank" class="source-link">🔗 Source</a>
            </div>
            <div class="preview-coords" v-if="previewEvent.latitude">
              <span>🗺️ {{ previewEvent.latitude.toFixed(4) }}, {{ previewEvent.longitude.toFixed(4) }}</span>
            </div>
          </div>
          <div class="preview-actions">
            <button @click="approveEvent" class="btn-approve" :disabled="approving">
              {{ approving ? 'Publishing...' : '✅ Approve & Publish' }}
            </button>
            <button @click="rejectEvent" class="btn-reject">✕ Reject</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Past Discoveries -->
    <div class="discoveries-section">
      <h2 class="section-title">Past Discoveries</h2>
      <div v-if="loadingList" class="loading-state">Loading...</div>
      <div v-else-if="discoveries.length === 0" class="empty-state">
        No events discovered yet. Use the search above to find your first event.
      </div>
      <div v-else class="discoveries-grid">
        <div v-for="event in discoveries" :key="event.id" class="discovery-item">
          <div class="discovery-image">
            <img :src="getImageUrl(event.imageUrl)" :alt="event.title" />
          </div>
          <div class="discovery-info">
            <h4>{{ event.title }}</h4>
            <span class="discovery-date">{{ new Date(event.date).toLocaleDateString() }}</span>
            <span class="discovery-loc">{{ event.locationName }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-page {
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

.ai-header {
  margin-bottom: 2rem;
}

.ai-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-icon {
  font-size: 2.5rem;
}

.ai-header h1 {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #38bdf8, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ai-subtitle {
  color: var(--text-muted);
  margin-top: 0.5rem;
}

/* Search */
.search-section {
  margin-bottom: 2rem;
}

.search-form {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
  padding: 0.9rem 1.25rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  color: white;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.3s;
}

.search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);
}

.discover-btn {
  padding: 0.9rem 1.5rem;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  color: var(--btn-text-on-primary);
  font-weight: 700;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-size: 0.95rem;
  white-space: nowrap;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.discover-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
}

.discover-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: var(--btn-text-on-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.location-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

/* Alerts */
.alert {
  padding: 1rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.alert-success {
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.25);
  color: #6ee7b7;
}

/* Section Titles */
.section-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: var(--text-main);
}

/* Preview Card */
.preview-section {
  margin-bottom: 3rem;
}

.preview-card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

.preview-image {
  width: 100%;
  height: 220px;
  overflow: hidden;
}

.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-body {
  padding: 1.5rem;
}

.preview-body h3 {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.preview-desc {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.source-link {
  color: var(--primary-color);
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}

.preview-coords {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
  opacity: 0.6;
}

.preview-actions {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
}

.btn-approve {
  flex: 1;
  padding: 0.85rem;
  background: linear-gradient(135deg, #34d399, #38bdf8);
  color: var(--btn-text-on-primary);
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.btn-approve:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(52, 211, 153, 0.4);
}

.btn-reject {
  padding: 0.85rem 1.25rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-reject:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Past Discoveries */
.discoveries-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.discovery-item {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
}

.discovery-image {
  height: 120px;
  overflow: hidden;
}

.discovery-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.discovery-info {
  padding: 0.75rem 1rem;
}

.discovery-info h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discovery-date, .discovery-loc {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
}

.loading-state, .empty-state {
  color: var(--text-muted);
  text-align: center;
  padding: 2rem;
}

/* Transition */
.slide-in-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-in-leave-active { transition: all 0.25s ease-in; }
.slide-in-enter-from { opacity: 0; transform: translateY(20px); }
.slide-in-leave-to { opacity: 0; transform: translateY(20px); }

@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }
  
  .preview-actions {
    flex-direction: column;
  }
}
</style>
