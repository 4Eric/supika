<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import EventMap from '@/components/EventMap.vue'
import { getImageUrl } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const event = ref(null)
const loading = ref(true)
const registering = ref(false)
const selectedTimeSlot = ref(null)
const message = ref('')

const registeredSlots = ref([])

const selectedSlotReg = computed(() => {
  return registeredSlots.value.find(s => s.slotId === selectedTimeSlot.value)
})
const isRegisteredForSelected = computed(() => !!selectedSlotReg.value)
const selectedSlotStatus = computed(() => selectedSlotReg.value?.status || '')
const attendees = ref([])
const showAttendees = ref(false)

const hasApprovedRegistration = computed(() => {
  return registeredSlots.value.some(s => s.status === 'approved')
})
const canJoinGroupChat = computed(() => {
  return event.value && (event.value.created_by === authStore.user?.id || hasApprovedRegistration.value)
})

const currentSlide = ref(0)
const nextSlide = () => {
  if (event.value?.media) {
    currentSlide.value = (currentSlide.value + 1) % event.value.media.length
  }
}
const prevSlide = () => {
  if (event.value?.media) {
    currentSlide.value = (currentSlide.value - 1 + event.value.media.length) % event.value.media.length
  }
}

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events/${route.params.id}`)
    event.value = res.data
    
    if (authStore.isAuthenticated) {
      const regRes = await axios.get(`${API_URL}/api/events/registered/me`, {
        headers: { 'x-auth-token': authStore.token }
      })
      const userRegs = regRes.data.filter(e => e.id === event.value.id)
      if (userRegs.length > 0) {
        registeredSlots.value = userRegs.map(r => ({ slotId: r.time_slot_id, status: r.status }))
      }
      
      // If creator, load attendees
      if (event.value.created_by === authStore.user?.id) {
        fetchAttendees()
      }
    }
  } catch (error) {
    message.value = "Event not found or failed to load."
  } finally {
    loading.value = false
  }
})

const registerForEvent = async () => {
  if (!authStore.isAuthenticated) {
    message.value = "Please login to register for this event."
    return
  }
  
  if (!selectedTimeSlot.value) {
    message.value = "Please select an available Time Slot first."
    return
  }
  
  registering.value = true
  message.value = ''
  
  try {
    await axios.post(`${API_URL}/api/events/${event.value.id}/register`, 
      { time_slot_id: selectedTimeSlot.value },
      { headers: { 'x-auth-token': authStore.token } }
    )
    registeredSlots.value.push({
      slotId: selectedTimeSlot.value,
      status: event.value.requires_approval ? 'pending' : 'approved'
    })
    message.value = event.value.requires_approval ? "Request sent. Waiting for organizer approval." : "Successfully registered! A confirmation email has been sent."
  } catch (error) {
    message.value = error.response?.data?.message || "Failed to register."
  } finally {
    registering.value = false
  }
}

const deregisterForEvent = async () => {
  if (!authStore.isAuthenticated) return
  
  registering.value = true
  message.value = ''
  
  try {
    await axios.delete(`${API_URL}/api/events/${event.value.id}/register`, {
      headers: { 'x-auth-token': authStore.token },
      data: { time_slot_id: selectedTimeSlot.value }
    })
    registeredSlots.value = registeredSlots.value.filter(s => s.slotId !== selectedTimeSlot.value)
    message.value = "Successfully canceled registration."
  } catch (error) {
    message.value = error.response?.data?.message || "Failed to cancel registration."
  } finally {
    registering.value = false
  }
}

const fetchAttendees = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/events/${event.value.id}/attendees`, {
      headers: { 'x-auth-token': authStore.token }
    })
    attendees.value = res.data
  } catch (err) {
    console.error("Failed to load attendees")
  }
}

const updateAttendeeStatus = async (userId, status) => {
  try {
    await axios.put(`${API_URL}/api/events/${event.value.id}/attendees/${userId}`, { status }, {
      headers: { 'x-auth-token': authStore.token }
    })
    const att = attendees.value.find(a => a.id === userId)
    if (att) att.status = status
  } catch (err) {
    message.value = "Failed to update attendee status."
  }
}
</script>

<template>
  <div class="detail-container">
    <div v-if="loading" class="loading">Loading event details...</div>
    <div v-else-if="event" class="card p-0">
      <div v-if="event.media && event.media.length > 0" class="carousel-container">
        <div class="carousel-slide" v-for="(media, index) in event.media" :key="media.id" v-show="index === currentSlide">
          <img v-if="media.media_type === 'image'" :src="getImageUrl(media.media_url)" class="carousel-media" />
          <video v-else-if="media.media_type === 'video'" :src="getImageUrl(media.media_url)" controls class="carousel-media autoplay-video"></video>
        </div>
        
        <button v-if="event.media.length > 1" @click="prevSlide" class="carousel-btn prev-btn">❮</button>
        <button v-if="event.media.length > 1" @click="nextSlide" class="carousel-btn next-btn">❯</button>
        
        <div v-if="event.media.length > 1" class="carousel-indicators">
          <span v-for="(media, index) in event.media" :key="'ind-'+media.id" 
                :class="['indicator', { active: index === currentSlide }]" 
                @click="currentSlide = index">
          </span>
        </div>
      </div>
      <div v-else class="event-hero-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.image_url) + ')' }"></div>
      
      <div class="card-content">
        <h1 class="event-title">{{ event.title }}</h1>
        <p class="creator-label">Created by <strong>{{ event.creator_name || 'an unknown user' }}</strong></p>
      
      <div class="event-meta-banner">
        <div><strong>📍 Location:</strong> <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" class="location-link">{{ event.location_name }}</a></div>
      </div>
      
      <div v-if="event.time_slots && event.time_slots.length > 0" class="time-slots-section">
        <h3>Available Time Slots</h3>
        <div class="time-slot-pills">
          <button 
            v-for="slot in event.time_slots" 
            :key="slot.id" 
            class="time-slot-pill"
            :class="{ active: selectedTimeSlot === slot.id, full: slot.attendee_count >= slot.max_attendees && selectedTimeSlot !== slot.id, booked: registeredSlots.some(s => s.slotId === slot.id) }"
            @click="selectedTimeSlot = slot.id"
            :disabled="slot.attendee_count >= slot.max_attendees && !registeredSlots.some(s => s.slotId === slot.id) && selectedTimeSlot !== slot.id"
          >
            <div class="slot-time">{{ new Date(slot.start_time).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) }}</div>
            <div class="slot-capacity">{{ slot.attendee_count }} / {{ slot.max_attendees }} Booked</div>
          </button>
        </div>
      </div>
      
      <div class="event-description">
        <h3>About this event</h3>
        <p>{{ event.description }}</p>
      </div>
      
      <div class="map-section">
        <h3>Location</h3>
        <div class="map-wrapper">
          <EventMap :events="[event]" />
        </div>
      </div>
      
      <div class="action-section">
        <template v-if="authStore.isAuthenticated">
          <!-- Action Buttons based on Role -->
          <div class="role-actions" v-if="event.created_by === authStore.user?.id">
            <button @click="showAttendees = !showAttendees" class="btn btn-secondary">
              👥 Manage Attendees ({{ attendees.length }})
            </button>
          </div>
          <div class="role-actions" v-else>
            <button 
              @click="router.push(`/chat/${event.id}/${event.created_by}`)" 
              class="btn btn-secondary chat-btn"
            >
              💬 Chat with Creator
            </button>
            
            <button v-if="!isRegisteredForSelected" @click="registerForEvent" :disabled="registering" class="btn">
              {{ registering ? 'Registering...' : 'Register for this Time Slot' }}
            </button>
            <div v-else class="registered-actions">
              <span class="status-badge" :class="selectedSlotStatus">
                {{ selectedSlotStatus === 'pending' ? '⏳ Pending Approval' : (selectedSlotStatus === 'rejected' ? '❌ Rejected' : '✅ Registered') }}
              </span>
              <button @click="deregisterForEvent" :disabled="registering" class="btn btn-danger btn-sm">
                Cancel
              </button>
            </div>
          </div>

          <!-- Shared Group Chat Action -->
          <div class="group-chat-action" v-if="canJoinGroupChat">
            <button 
              @click="router.push(`/group-chat/${event.id}`)" 
              class="btn btn-primary group-chat-btn"
            >
              💬 Open Attendees Group Chat
            </button>
            <p class="group-chat-hint">Unlocked for approved attendees!</p>
          </div>
        </template>
        <p v-else class="login-msg">Log in to register for this event.</p>

        <!-- Attendee Management Panel (Creator Only) -->
        <div class="attendees-panel" v-if="showAttendees && event.created_by === authStore.user?.id">
          <h3>Attendees Data</h3>
          <ul v-if="attendees.length > 0" class="attendees-list">
            <li v-for="att in attendees" :key="att.id" class="attendee-item">
              <div class="att-info">
                <strong @click="router.push(`/chat/${event.id}/${att.id}`)" class="clickable-username" title="Message User">{{ att.username }}</strong>
                <span class="att-email">{{ att.email }}</span>
                <span class="att-timeslot" v-if="att.time_slot" style="font-size: 0.8rem; color: var(--primary-color); font-weight: 500; margin-top: 0.2rem;">⌚ {{ new Date(att.time_slot).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) }}</span>
                <span class="att-status" :class="att.status">{{ att.status }}</span>
              </div>
              <div class="att-actions">
                <button v-if="att.status !== 'approved'" @click="updateAttendeeStatus(att.id, 'approved')" class="btn btn-sm">Approve</button>
                <button v-if="att.status !== 'rejected'" @click="updateAttendeeStatus(att.id, 'rejected')" class="btn btn-danger btn-sm">Reject</button>
              </div>
            </li>
          </ul>
          <p v-else style="color: var(--text-muted)">No one has registered for your event yet.</p>
        </div>
        
        <p v-if="message" class="status-msg" :class="{ 'error': message.includes('Failed') || message.includes('login') }">
          {{ message }}
        </p>
      </div>
      </div>
    </div>
    <div v-else class="card error">
      <h2>{{ message }}</h2>
    </div>
  </div>
</template>

<style scoped>
.detail-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.p-0 {
  padding: 0;
  overflow: hidden;
}
.event-hero-banner {
  width: 100%;
  height: 350px;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--border-light);
}
.carousel-container {
  position: relative;
  width: 100%;
  height: 350px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
}
.carousel-slide {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.carousel-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  font-size: 2rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.3s;
  z-index: 10;
}
.carousel-btn:hover {
  background: rgba(0,0,0,0.8);
}
.prev-btn {
  left: 10px;
}
.next-btn {
  right: 10px;
}
.carousel-indicators {
  position: absolute;
  bottom: 15px;
  display: flex;
  gap: 8px;
  justify-content: center;
  width: 100%;
  z-index: 10;
}
.indicator {
  width: 12px;
  height: 12px;
  background: rgba(255,255,255,0.5);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.3s;
}
.indicator.active {
  background: white;
  box-shadow: 0 0 5px rgba(255,255,255,0.8);
}
.card-content {
  padding: 2.5rem;
}
.event-title {
  font-size: 2.5rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}
.creator-label {
  color: var(--text-muted);
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}
.event-meta-banner {
  background: var(--bg-color);
  padding: 1rem;
  border-radius: 0.5rem;
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}
.location-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}
.location-link:hover {
  text-decoration: underline;
  color: var(--secondary-color);
}
.event-description {
  margin-bottom: 3rem;
  font-size: 1.1rem;
  line-height: 1.7;
}
.map-section {
  margin-bottom: 3rem;
}
.map-section h3 {
  margin-bottom: 1rem;
}
.map-wrapper {
  height: 350px;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.action-section {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}
.chat-btn {
  background-color: transparent;
  color: var(--text-main);
  border: 1px solid var(--border-light);
  width: auto;
}
.chat-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.group-chat-action {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
  text-align: center;
  width: 100%;
}

.group-chat-btn {
  width: 100%;
  background: var(--primary-color);
  box-shadow: 0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.3);
}

.group-chat-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.status-msg {
  margin-top: 1rem;
  color: var(--secondary-color);
  font-weight: 500;
}
.status-msg.error {
  color: #ef4444; /* Red 500 */
}
.login-msg {
  color: var(--text-muted);
  font-style: italic;
}
.btn-danger {
  background-color: #ef4444;
  color: white;
}
.btn-danger:hover {
  background-color: #dc2626;
}

.role-actions { display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap; }
.registered-actions { display: flex; align-items: center; gap: 1rem; }
.status-badge { padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 600; font-size: 0.9rem; border: 1px solid currentColor; }
.status-badge.pending { background: rgba(234, 179, 8, 0.2); color: #eab308; }
.status-badge.approved { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.status-badge.rejected { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.attendees-panel { margin-top: 2rem; width: 100%; border-top: 1px solid var(--border-light); padding-top: 1.5rem; text-align: left; }
.attendees-panel h3 { margin-bottom: 1rem; color: var(--primary-color); }
.attendees-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.attendee-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border-light); }
.att-info { display: flex; flex-direction: column; gap: 0.2rem; }
.att-email { font-size: 0.85rem; color: var(--text-muted); }
.att-status { text-transform: uppercase; font-size: 0.75rem; font-weight: bold; margin-top: 0.3rem; }
.att-status.pending { color: #eab308; }
.att-status.approved { color: #22c55e; }
.att-status.rejected { color: #ef4444; }
.att-actions { display: flex; gap: 0.5rem; }

@media (max-width: 768px) {
  .detail-container {
    margin: 1rem auto;
  }
  .event-title {
    font-size: 1.8rem;
  }
  .event-meta-banner {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  .card-content {
    padding: 1.5rem;
  }
  .event-hero-banner, .carousel-container, .map-wrapper {
    height: 250px;
  }
}

.clickable-username {
  cursor: pointer;
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s;
}

.clickable-username:hover {
  text-decoration: underline;
  color: var(--primary-dark-color, #0ea5e9);
}

.time-slots-section {
  margin: 1.5rem 0;
}
.time-slot-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.time-slot-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-main);
  text-align: left;
}
.time-slot-pill:hover:not(:disabled) {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}
.time-slot-pill.active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}
.time-slot-pill.booked {
  background: rgba(34, 197, 94, 0.1);
  border-color: #22c55e;
  color: #22c55e;
}
.time-slot-pill.booked .slot-time, .time-slot-pill.booked .slot-capacity {
  color: #22c55e;
}
.time-slot-pill.active .slot-time, .time-slot-pill.active .slot-capacity {
  color: #fff;
}
.time-slot-pill.full {
  opacity: 0.5;
  cursor: not-allowed;
}
.slot-time {
  font-weight: 600;
  margin-bottom: 0.2rem;
}
.slot-capacity {
  font-size: 0.8rem;
  color: var(--text-muted);
}
</style>

