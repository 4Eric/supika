<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import EventMap from '@/components/EventMap.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const router = useRouter()
const title = ref('')
const description = ref('')
const locationName = ref('')
const latitude = ref(null)
const longitude = ref(null)
const imageFiles = ref([])
const requiresApproval = ref(false)
const timeSlots = ref([
  { start_time: null, max_attendees: 5 }
])

const addTimeSlot = () => {
  timeSlots.value.push({ start_time: null, max_attendees: 5 })
}

const removeTimeSlot = (index) => {
  if (timeSlots.value.length > 1) {
    timeSlots.value.splice(index, 1)
  }
}

const loading = ref(false)
const errorMsg = ref('')

const eventMapRef = ref(null)

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

const handleLocationSelected = async (latlng) => {
  latitude.value = latlng.lat
  longitude.value = latlng.lng

  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: {
        lat: latlng.lat,
        lon: latlng.lng,
        format: 'json',
        'accept-language': 'en'
      }
    })
    
    if (res.data && res.data.display_name) {
      locationName.value = res.data.display_name
    }
  } catch (error) {
    console.error("Failed to reverse geocode:", error)
  }
}

const lookupAddress = async () => {
  if (!locationName.value) return
  errorMsg.value = ''
  
  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: locationName.value,
        format: 'json',
        limit: 1,
        'accept-language': 'en'
      }
    })
    
    if (res.data && res.data.length > 0) {
      const { lat, lon } = res.data[0]
      latitude.value = parseFloat(lat)
      longitude.value = parseFloat(lon)
      if (eventMapRef.value) {
        eventMapRef.value.setPickerMarker(latitude.value, longitude.value)
      }
    } else {
      errorMsg.value = "Address not found."
    }
  } catch (error) {
    errorMsg.value = "Failed to lookup address."
  }
}

const handleImageUpload = (event) => {
  const files = Array.from(event.target.files)
  if (files.length > 10) {
    errorMsg.value = "You can only upload a maximum of 10 files."
    event.target.value = ''
    imageFiles.value = []
    return
  }
  imageFiles.value = files
}

const submitForm = async () => {
  if (!latitude.value || !longitude.value) {
    errorMsg.value = "Please select a location on the map."
    return
  }
  
  loading.value = true
  errorMsg.value = ''
  
  try {
    const token = localStorage.getItem('token')
    
    const formData = new FormData()
    formData.append('title', title.value)
    formData.append('description', description.value)
    formData.append('location_name', locationName.value)
    formData.append('latitude', latitude.value)
    formData.append('longitude', longitude.value)
    formData.append('requires_approval', requiresApproval.value)
    
    const validSlots = timeSlots.value.filter(s => s.start_time)
    if (validSlots.length === 0) {
      errorMsg.value = "Please configure at least one valid Date & Time slot."
      loading.value = false
      return
    }
    formData.append('time_slots', JSON.stringify(validSlots))
    
    if (imageFiles.value && imageFiles.value.length > 0) {
      imageFiles.value.forEach(file => {
        // Encode filenames to ASCII to prevent Multer/Busboy from crashing on utf-8 characters like Chinese
        formData.append('media', file, encodeURIComponent(file.name))
      })
    }
    
    const res = await axios.post(`${API_URL}/api/events`, formData, {
      headers: {
        'x-auth-token': token,
        'Content-Type': 'multipart/form-data'
      }
    })
    
    router.push(`/event/${res.data.id}`)
  } catch (error) {
    errorMsg.value = error.response?.data?.message || "Failed to create event."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-container">
    <div class="card">
      <h2 class="page-title">Create a New Event</h2>
      
      <form @submit.prevent="submitForm" class="create-form">
        <div class="form-body">
          <div class="form-inputs">
            <div class="form-group">
              <label>Event Title</label>
              <input type="text" v-model="title" class="form-control" required placeholder="Awesome Tech Meetup" />
            </div>
            
            <div class="form-group">
              <label>Location Name</label>
              <div class="location-input-group">
                <input type="text" v-model="locationName" class="form-control" required placeholder="Central Park, NYC" />
                <button type="button" @click="lookupAddress" class="btn btn-secondary lookup-btn">Lookup on Map</button>
              </div>
            </div>
            
            <div class="form-group time-slots-container" style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="margin: 0; color: var(--primary-color);">Event Time Slots</label>
                <button type="button" @click="addTimeSlot" class="btn btn-sm btn-secondary" style="padding: 0.25rem 0.75rem;">➕ Add Slot</button>
              </div>
              
              <div v-for="(slot, index) in timeSlots" :key="index" class="time-slot-card" style="display: flex; gap: 1rem; align-items: flex-end; background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--bg-color); margin-bottom: 1rem;">
                
                <div style="flex: 2;">
                  <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">Date and Time</label>
                  <VueDatePicker 
                    v-model="slot.start_time"
                    placeholder="Select Date and Time" 
                    dark
                  />
                </div>
                
                <div style="flex: 1;">
                  <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">Capacity</label>
                  <input type="number" v-model="slot.max_attendees" class="form-control" min="1" required />
                </div>
                
                <button type="button" v-if="timeSlots.length > 1" @click="removeTimeSlot(index)" class="btn btn-sm btn-danger" style="margin-bottom: 0.2rem;" title="Remove Slot">🗑️</button>
              </div>
            </div>

            <div class="form-group">
              <label>Event Media (Optional, Max 10)</label>
              <div class="file-upload-wrapper">
                <input type="file" id="banner-upload" multiple @change="handleImageUpload" class="file-input-hidden" accept="image/png, image/jpeg, image/jpg, image/webp, video/mp4, video/webm" />
                <label for="banner-upload" class="btn btn-secondary upload-label">
                  Choose Files
                </label>
                <span class="file-name-text">{{ imageFiles.length > 0 ? `${imageFiles.length} file(s) chosen` : 'No files chosen' }}</span>
              </div>
            </div>
            
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="description" class="form-control" required rows="5" placeholder="Join us for an exciting..."></textarea>
            </div>

            <div class="form-group">
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-main);">
                <input type="checkbox" v-model="requiresApproval" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" />
                Require Manual Approval for Attendees
              </label>
            </div>
          </div>
          
          <div class="form-map">
            <label>Pick Location on Map</label>
            <div class="map-wrapper">
              <EventMap ref="eventMapRef" :pickerMode="true" :events="[]" @locationSelected="handleLocationSelected" />
            </div>
            <p v-if="latitude && longitude" class="coords">
              Selected: {{ latitude.toFixed(4) }}, {{ longitude.toFixed(4) }}
            </p>
          </div>
        </div>
        
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        
        <div class="form-actions">
          <button type="submit" class="btn submit-btn" :disabled="loading">
            {{ loading ? 'Creating...' : 'Publish Event' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.create-container {
  max-width: 1000px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.page-title {
  color: var(--primary-color);
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--bg-color);
  padding-bottom: 1rem;
}
.form-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}
@media (max-width: 768px) {
  .create-container {
    margin: 1rem auto;
  }
  .form-body {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .page-title {
    font-size: 1.8rem;
    margin-bottom: 1.5rem;
  }
  .map-wrapper {
    height: 250px;
  }
  .location-input-group {
    flex-direction: column;
  }
  .lookup-btn {
    width: 100%;
  }
}
.map-wrapper {
  height: 350px;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  overflow: hidden;
  margin-top: 0.5rem;
}
.location-input-group {
  display: flex;
  gap: 1rem;
}
.file-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}
.file-input-hidden {
  display: none;
}
.lookup-btn {
  white-space: nowrap;
  background-color: var(--secondary-color);
  color: white;
}
.lookup-btn:hover {
  background-color: #5b21b6;
}
.coords {
  font-size: 0.875rem;
  color: var(--secondary-color);
  margin-top: 0.5rem;
  font-weight: 500;
}
.error-msg {
  color: #ef4444;
  margin-top: 1rem;
  text-align: center;
}
.form-actions {
  margin-top: 2rem;
  text-align: right;
  border-top: 1px solid var(--bg-color);
  padding-top: 1.5rem;
}
.submit-btn {
  padding-left: 3rem;
  padding-right: 3rem;
}
.upload-label {
  display: inline-block;
  cursor: pointer;
  margin: 0;
}
.file-name-text {
  color: var(--text-muted);
  font-size: 0.95rem;
  font-style: italic;
}
</style>

