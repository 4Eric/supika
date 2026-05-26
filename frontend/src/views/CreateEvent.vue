<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import EventMap from '@/components/EventMap.vue'
import TimeSlotManager from '@/components/TimeSlotManager.vue'
import ImageUploadZone from '@/components/ImageUploadZone.vue'
import { useThemeStore } from '@/stores/themeStore'
import { useGeolocation } from '@/composables/useGeolocation'
import { FileText, MapPin, Coins, Camera, Search, Music, Dumbbell, Palette, Laptop, Pizza, Laugh, Drama, Tent, PawPrint, Sparkles } from 'lucide-vue-next'

const categoryOptions = [
  { key: 'music', icon: Music },
  { key: 'sports', icon: Dumbbell },
  { key: 'art', icon: Palette },
  { key: 'tech', icon: Laptop },
  { key: 'food', icon: Pizza },
  { key: 'comedy', icon: Laugh },
  { key: 'theater', icon: Drama },
  { key: 'festival', icon: Tent },
  { key: 'pet', icon: PawPrint },
  { key: 'other', icon: Sparkles },
]

const router = useRouter()
const themeStore = useThemeStore()
const title = ref('')
const description = ref('')
const imageFiles = ref([])
const requiresApproval = ref(false)
const ticketPrice = ref(0)
const currency = ref('CAD')
const category = ref('other')
const timeSlots = ref([
  { startTime: null, maxAttendees: 5 }
])
const previews = ref([])

const onUploadError = (msg) => {
  errorMsg.value = msg
}

const loading = ref(false)
const errorMsg = ref('')

const eventMapRef = ref(null)

const { latitude, longitude, locationName, handleLocationSelected, lookupAddress, getUserLocation } = useGeolocation(errorMsg)

onMounted(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        if (eventMapRef.value) {
          eventMapRef.value.centerMap(lat, lng)
        }
      },
      (error) => {
        console.warn("Geolocation denied or failed. Using default map location.", error)
      }
    )
  }
})

// Image upload logic moved to ImageUploadZone.vue

const buildEventFormData = () => {
  const formData = new FormData();
  formData.append('title', title.value);
  formData.append('description', description.value);
  formData.append('locationName', locationName.value);
  formData.append('latitude', latitude.value);
  formData.append('longitude', longitude.value);
  formData.append('requiresApproval', requiresApproval.value);
  formData.append('ticketPrice', ticketPrice.value);
  formData.append('currency', currency.value);
  formData.append('category', category.value);
  
  const validSlots = timeSlots.value.filter(s => s.startTime);
  if (validSlots.length === 0) return null;
  formData.append('timeSlots', JSON.stringify(validSlots));
  
  if (imageFiles.value) {
    let sizeError = false;
    imageFiles.value.forEach(file => {
      if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(file.type)) {
        sizeError = true;
      }
    });

    if (sizeError) {
      errorMsg.value = "Images must be JPG/PNG and under 5MB.";
      return null;
    }

    imageFiles.value.forEach(file => {
      formData.append('media', file, encodeURIComponent(file.name));
    });
  }
  return formData;
};

const submitForm = async () => {
  if (!latitude.value || !longitude.value) {
    errorMsg.value = "Please select a location on the map.";
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    const authStore = useAuthStore();
    const formData = buildEventFormData();
    if (!formData) {
      errorMsg.value = "Please configure at least one valid time slot.";
      loading.value = false;
      return;
    }
    const res = await axios.post(`${API_URL}/api/events`, formData, {
      headers: { 'x-auth-token': authStore.token, 'Content-Type': 'multipart/form-data' }
    });
    router.push(`/event/${res.data.id}`);
  } catch (error) {
    errorMsg.value = error.response?.data?.message || error.message || "Failed to create event.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="create-container">
    <header class="page-header">
      <h2 class="page-title">Create New Event</h2>
      <p class="page-subtitle">Share your next vibe with the community</p>
    </header>
    
    <form @submit.prevent="submitForm" class="create-form">
      <!-- Section 1: Basics -->
      <section class="form-section card">
        <h3 class="section-title"><FileText class="lucide" style="width:20px;height:20px;" /> Basic Info</h3>
        <div class="form-group">
          <label for="event-title">Event Title</label>
          <input type="text" id="event-title" v-model="title" class="form-control" required placeholder="Give it a catchy name..." />
        </div>
        <div class="form-group">
          <label for="event-desc">Description</label>
          <textarea id="event-desc" v-model="description" class="form-control" required rows="4" placeholder="What's the vibe? Tell them more..."></textarea>
        </div>
        <div class="form-group">
          <label id="cat-label">Category</label>
          <div class="category-grid" aria-labelledby="cat-label">
            <button type="button" v-for="cat in categoryOptions" :key="cat.key" class="cat-chip" :class="{ active: category === cat.key }" @click="category = cat.key">
              <component :is="cat.icon" class="lucide" style="width:16px;height:16px;" /> {{ cat.key }}
            </button>
          </div>
        </div>
      </section>

      <!-- Section 2: Time Slots -->
      <section class="form-section card">
        <TimeSlotManager v-model="timeSlots" />
      </section>

      <!-- Section 3: Location -->
      <section class="form-section card">
        <h3 class="section-title"><MapPin class="lucide" style="width:20px;height:20px;" /> Location</h3>
        <div class="form-group">
          <label for="location-search">Where</label>
          <div class="location-search">
            <input type="text" id="location-search" v-model="locationName" class="form-control" required placeholder="Search an address..." />
            <div class="search-actions">
              <button type="button" @click="lookupAddress(eventMapRef)" class="btn-search" title="Search address"><Search class="lucide" style="width:18px;height:18px;" /></button>
              <button type="button" @click="getUserLocation(eventMapRef)" class="btn-search" title="Use my current location"><MapPin class="lucide" style="width:18px;height:18px;" /></button>
            </div>
          </div>
        </div>
        <div class="map-container">
          <EventMap ref="eventMapRef" :pickerMode="true" :events="[]" @locationSelected="handleLocationSelected" />
          <div v-if="latitude !== null && longitude !== null" class="map-badge">
            {{ Number(latitude).toFixed(4) }}, {{ Number(longitude).toFixed(4) }}
          </div>
        </div>
      </section>

      <!-- Section 4: Pricing -->
      <section class="form-section card">
        <h3 class="section-title"><Coins class="lucide" style="width:20px;height:20px;" /> Ticket Pricing</h3>
        <p class="section-hint">Keep it 0 for free events. Supika charges a 7% platform fee on paid tickets.</p>
        <div class="pricing-grid">
          <div class="form-group">
            <label for="ticket-price">Price (per person)</label>
            <div class="price-input-wrapper">
              <span class="currency-symbol">$</span>
              <input type="number" id="ticket-price" v-model="ticketPrice" class="form-control price-input" min="0" step="0.01" />
            </div>
          </div>
          <div class="form-group">
            <label for="ticket-currency">Currency</label>
            <select id="ticket-currency" v-model="currency" class="form-control">
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Section 5: Media & Settings -->
      <section class="form-section card">
        <h3 class="section-title"><Camera class="lucide" style="width:20px;height:20px;" /> Media & Settings</h3>
        <div class="form-group">
          <label>Photos (Max 10)</label>
          <ImageUploadZone 
            v-model="imageFiles" 
            v-model:previews="previews" 
            @error="onUploadError" 
          />
        </div>

        <div class="form-group checkbox-group">
          <div class="toggle-wrapper">
            <input type="checkbox" id="approval-toggle" v-model="requiresApproval" class="toggle-input" />
            <label for="approval-toggle" class="toggle-label"></label>
          </div>
          <label for="approval-toggle" class="label-text">Require manual approval for attendees</label>
        </div>
      </section>
      
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      
      <div class="publish-container">
        <button type="submit" class="btn btn-primary publish-btn" :disabled="loading">
          {{ loading ? 'Publishing...' : 'Publish Event' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem 9rem;
}

.page-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 2.2rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  padding: 1.5rem;
  border-radius: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.25rem;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon {
  font-size: 1.4rem;
}

/* Time slot styles moved to TimeSlotManager.vue */

/* Location */
.location-search {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-search {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  color: white;
  padding: 0 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-search:hover {
  border-color: var(--primary-color);
}

.map-container {
  height: 250px;
  border-radius: 1rem;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border-light);
}

.map-badge {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  padding: 0.4rem 0.8rem;
  border-radius: 2rem;
  font-size: 0.75rem;
  color: var(--primary-color);
  z-index: 1000;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

/* Upload zone and preview styles moved to ImageUploadZone.vue */
.label-text {
  font-size: 0.95rem;
  color: var(--text-main);
  cursor: pointer;
}

.error-msg {
  color: #ef4444;
  text-align: center;
  margin: 1rem 0;
}

.publish-container {
  margin-top: 1rem;
}

.publish-btn {
  width: 100%;
  padding: 1.25rem;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: 1rem;
  background: var(--primary-color);
  border: none;
  color: var(--btn-text-on-primary);
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--btn-shadow);
}

.publish-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 15px 30px rgba(56, 189, 248, 0.5);
}

.publish-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Pricing Styles */
.section-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
  margin-top: 0;
}

.pricing-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.price-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 1rem;
  color: var(--text-muted);
  font-weight: 600;
}

.price-input {
  padding-left: 2rem !important;
}

@media (max-width: 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* Responsive styles moved to components */

/* Category chip picker */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.cat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  border: 1px solid var(--border-light);
  background: var(--input-bg);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  text-transform: capitalize;
}
.cat-chip:hover { border-color: var(--primary-color); color: var(--text-main); }
.cat-chip.active {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.7);
  color: #d8b4fe;
}
</style>
