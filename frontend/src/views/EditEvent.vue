<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import EventMap from '@/components/EventMap.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const router = useRouter()
const route = useRoute()
const eventId = route.params.id
const title = ref('')
const description = ref('')
const locationName = ref('')
const latitude = ref(null)
const longitude = ref(null)
const imageFiles = ref([])
const requiresApproval = ref(false)
const timeSlots = ref([])
const previews = ref([])

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

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events/${eventId}`)
    const event = res.data
    
    title.value = event.title
    description.value = event.description
    locationName.value = event.locationName
    latitude.value = event.latitude
    longitude.value = event.longitude
    requiresApproval.value = event.requiresApproval
    
    if (event.timeSlots && event.timeSlots.length > 0) {
      timeSlots.value = event.timeSlots.map(ts => ({
        id: ts.id,
        startTime: new Date(ts.startTime),
        maxAttendees: ts.maxAttendees,
        durationMinutes: ts.durationMinutes
      }))
    } else {
      timeSlots.value = [{ startTime: null, maxAttendees: 5 }]
    }
    
    if (eventMapRef.value && latitude.value && longitude.value) {
      eventMapRef.value.centerMap(latitude.value, longitude.value)
      eventMapRef.value.setPickerMarker(latitude.value, longitude.value)
    }
  } catch (error) {
    errorMsg.value = "Failed to load event details."
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

const resolveAddress = async (lat, lng) => {
  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: { lat, lon: lng, format: 'json', 'accept-language': 'en' }
    });
    if (res.data && res.data.display_name) {
      locationName.value = res.data.display_name;
    }
  } catch (e) {
    console.error("Reverse geocoding failed:", e);
  }
};

const getUserLocation = () => {
  if (!navigator.geolocation) {
    errorMsg.value = "Geolocation is not supported by your browser.";
    return;
  }
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
  if (!isSecure && window.location.protocol !== 'https:') {
    errorMsg.value = "Mobile browsers require HTTPS for location features.";
    return;
  }
  errorMsg.value = "Requesting permission...";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      latitude.value = lat;
      longitude.value = lng;
      if (eventMapRef.value) eventMapRef.value.setPickerMarker(lat, lng);
      errorMsg.value = "";
      await resolveAddress(lat, lng);
    },
    (error) => {
      errorMsg.value = error.code === 1 ? "Permission denied." : "Unable to retrieve location: " + error.message;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

const handleImageUpload = (event) => {
  const files = Array.from(event.target.files);
  if (files.length > 10) {
    errorMsg.value = "You can only upload a maximum of 10 files.";
    event.target.value = '';
    imageFiles.value = [];
    previews.value = [];
    return;
  }
  imageFiles.value = files;
  previews.value = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => previews.value.push(e.target.result);
    reader.readAsDataURL(file);
  });
};

const buildEventFormData = () => {
  const formData = new FormData();
  formData.append('title', title.value);
  formData.append('description', description.value);
  formData.append('locationName', locationName.value);
  formData.append('latitude', latitude.value);
  formData.append('longitude', longitude.value);
  formData.append('requiresApproval', requiresApproval.value);
  
  const validSlots = timeSlots.value.filter(s => s.startTime);
  if (validSlots.length === 0) return null;
  formData.append('timeSlots', JSON.stringify(validSlots));
  
  if (imageFiles.value) {
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
    await axios.put(`${API_URL}/api/events/${eventId}`, formData, {
      headers: { 'x-auth-token': authStore.token, 'Content-Type': 'multipart/form-data' }
    });
    router.push(`/event/${eventId}`);
  } catch (error) {
    errorMsg.value = error.response?.data?.message || "Failed to update event.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="create-container">
    <header class="page-header">
      <h2 class="page-title">Edit Event</h2>
      <p class="page-subtitle">Refine your vibe and keep it fresh</p>
    </header>
    
    <form @submit.prevent="submitForm" class="create-form">
      <!-- Section 1: Basics -->
      <section class="form-section card">
        <h3 class="section-title"><span class="icon">📝</span> Basic Info</h3>
        <div class="form-group">
          <label>Event Title</label>
          <input type="text" v-model="title" class="form-control" required placeholder="Update your title..." />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="description" class="form-control" required rows="4" placeholder="Update the description..."></textarea>
        </div>
      </section>

      <!-- Section 2: Time Slots -->
      <section class="form-section card">
        <div class="section-header">
          <h3 class="section-title"><span class="icon">📅</span> Date & Time</h3>
          <button type="button" @click="addTimeSlot" class="btn btn-sm btn-secondary">Add Slot</button>
        </div>
        
        <div class="time-slots-list">
          <div v-for="(slot, index) in timeSlots" :key="index" class="time-slot-item">
            <div class="slot-inputs">
              <div class="slot-field">
                <label>When</label>
                <VueDatePicker v-model="slot.startTime" placeholder="Select time" dark teleport="body" />
              </div>
              <div class="slot-field small">
                <label>Capacity</label>
                <input type="number" v-model="slot.maxAttendees" class="form-control" min="1" required />
              </div>
              <button type="button" v-if="timeSlots.length > 1" @click="removeTimeSlot(index)" class="btn-delete" title="Remove">✕</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Location -->
      <section class="form-section card">
        <h3 class="section-title"><span class="icon">📍</span> Location</h3>
        <div class="form-group">
          <label>Where</label>
          <div class="location-search">
            <input type="text" v-model="locationName" class="form-control" required placeholder="Search an address..." />
            <div class="search-actions">
              <button type="button" @click="lookupAddress" class="btn-search" title="Search address">🔍</button>
              <button type="button" @click="getUserLocation" class="btn-search" title="Use my current location">📍</button>
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

      <!-- Section 4: Media & Settings -->
      <section class="form-section card">
        <h3 class="section-title"><span class="icon">📸</span> Media & Settings</h3>
        <div class="form-group">
          <label>Photos (Max 10)</label>
          <div class="upload-zone" :class="{ 'has-files': imageFiles.length > 0 }">
            <input type="file" id="media-upload" multiple @change="handleImageUpload" accept="image/*" />
            <label for="media-upload" class="upload-content">
              <span class="upload-icon">📤</span>
              <span class="upload-text">{{ imageFiles.length > 0 ? `${imageFiles.length} images selected` : 'Tap to upload new images' }}</span>
            </label>
          </div>
          <p class="helper-text">Uploading new images will replace existing ones.</p>
          <div v-if="previews.length > 0" class="preview-grid">
            <div v-for="(src, i) in previews" :key="i" class="preview-item">
              <img :src="src" alt="Preview" />
            </div>
          </div>
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
          {{ loading ? 'Saving...' : 'Update Event' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem 6rem;
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
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon {
  font-size: 1.4rem;
}

.time-slots-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-slot-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-light);
}

.slot-inputs {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.slot-field {
  flex: 1;
}

.slot-field.small {
  width: 80px;
  flex: none;
}

.slot-field label {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
  display: block;
}

.btn-delete {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.2rem;
  cursor: pointer;
  padding-bottom: 0.5rem;
}

.helper-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 0.5rem;
}

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

/* Upload Zone */
.upload-zone {
  border: 2px dashed var(--border-light);
  border-radius: 1rem;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: rgba(255, 255, 255, 0.02);
}

.upload-zone:hover {
  border-color: var(--primary-color);
  background: rgba(56, 189, 248, 0.05);
}

.upload-zone.has-files {
  border-style: solid;
  border-color: var(--secondary-color);
}

.upload-zone input {
  display: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  width: 100%;
}

.upload-icon {
  font-size: 1.8rem;
}

.upload-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.preview-grid {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.preview-item {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Toggle Switch */
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}

.toggle-wrapper {
  position: relative;
  width: 48px;
  height: 24px;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-label {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #334155;
  transition: .4s;
  border-radius: 24px;
  cursor: pointer;
}

.toggle-label:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-input:checked + .toggle-label {
  background-color: var(--primary-color);
}

.toggle-input:checked + .toggle-label:before {
  transform: translateX(24px);
}

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
  background: linear-gradient(135deg, var(--primary-color), #0ea5e9);
  border: none;
  color: white;
  box-shadow: 0 4px 15px rgba(56, 189, 248, 0.4);
}

.publish-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(56, 189, 248, 0.6);
}

.publish-btn:active {
  transform: translateY(0);
}

@media (max-width: 480px) {
  .slot-inputs {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  .slot-field.small {
    width: 100%;
  }
  .btn-delete {
    align-self: flex-end;
    padding: 0;
  }
}
</style>

