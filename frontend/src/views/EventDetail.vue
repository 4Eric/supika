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
  if (!event.value || !selectedTimeSlot.value) return false
  
  // Organizer can join any slot's chat
  if (event.value.createdBy === authStore.user?.id) return true
  
  // Check if approved for THIS specific slot
  return registeredSlots.value.some(s => s.slotId === selectedTimeSlot.value && s.status === 'approved')
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
        registeredSlots.value = userRegs.map(r => ({ slotId: r.timeSlotId, status: r.status }))
      }
      
      // If creator, load attendees
      if (event.value.createdBy === authStore.user?.id) {
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
      { timeSlotId: selectedTimeSlot.value },
      { headers: { 'x-auth-token': authStore.token } }
    )
    registeredSlots.value.push({
      slotId: selectedTimeSlot.value,
      status: event.value.requiresApproval ? 'pending' : 'approved'
    })
    message.value = event.value.requiresApproval ? "Request sent. Waiting for organizer approval." : "Successfully registered! A confirmation email has been sent."
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
      data: { timeSlotId: selectedTimeSlot.value }
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
  <div class="event-detail-page">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
    <div v-else-if="event" class="page-content">
      
      <!-- Hero Media (Edge-to-Edge) -->
      <div class="hero-section">
        <div v-if="event.media && event.media.length > 0" class="carousel-container">
          <div class="carousel-slide" v-for="(media, index) in event.media" :key="media.id" v-show="index === currentSlide">
            <img v-if="media.mediaType === 'image'" :src="getImageUrl(media.mediaUrl)" class="carousel-media" />
            <video v-else-if="media.mediaType === 'video'" :src="getImageUrl(media.mediaUrl)" controls class="carousel-media autoplay-video"></video>
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
        <div v-else class="event-hero-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.imageUrl) + ')' }"></div>
        
        <!-- Back Button Overlay -->
        <button class="back-btn" @click="router.back()">
          ← Back
        </button>
      </div>

      <!-- Main Body layout -->
      <div class="main-layout">
        <!-- Left / Body Content -->
        <div class="event-body">
          <div class="body-header">
            <h1 class="event-title">{{ event.title }}</h1>
            <div class="meta-badges">
              <span class="badge creator-badge">
                <span class="badge-icon">👤</span> By {{ event.creatorName || 'unknown' }}
              </span>
              <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" class="badge location-badge">
                <span class="badge-icon">📍</span> {{ event.locationName }}
              </a>
            </div>
          </div>
          
          <div v-if="event.timeSlots && event.timeSlots.length > 0" class="section time-slots-section">
            <h3 class="section-title">Select a Time Slot</h3>
            <div class="time-slot-scroll-container">
              <button 
                v-for="slot in event.timeSlots" 
                :key="slot.id" 
                class="time-slot-card"
                :class="{ 
                  active: selectedTimeSlot === slot.id, 
                  full: slot.attendeeCount >= slot.maxAttendees && selectedTimeSlot !== slot.id, 
                  booked: registeredSlots.some(s => s.slotId === slot.id) 
                }"
                @click="selectedTimeSlot = slot.id"
                :disabled="slot.attendeeCount >= slot.maxAttendees && !registeredSlots.some(s => s.slotId === slot.id) && selectedTimeSlot !== slot.id"
              >
                <div class="slot-date">{{ new Date(slot.startTime).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric'}) }}</div>
                <div class="slot-time-text">{{ new Date(slot.startTime).toLocaleString([], {hour: '2-digit', minute:'2-digit'}) }}</div>
                <div class="slot-status">
                  <span v-if="registeredSlots.some(s => s.slotId === slot.id)">✓ Registered</span>
                  <span v-else>{{ slot.attendeeCount }} / {{ slot.maxAttendees }} Joined</span>
                </div>
              </button>
            </div>
          </div>
          
          <div class="section event-description">
            <h3 class="section-title">About this event</h3>
            <p class="desc-text">{{ event.description }}</p>
          </div>
          
          <div class="section map-section">
            <h3 class="section-title">Location</h3>
            <div class="map-wrapper glass-panel">
              <EventMap :events="[event]" />
            </div>
          </div>

          <!-- Attendee Management Panel (Creator Only) -->
          <div class="section attendees-panel" v-if="showAttendees && event.createdBy === authStore.user?.id">
            <h3 class="section-title">Attendees Hub</h3>
            <ul v-if="attendees.length > 0" class="attendees-list">
              <li v-for="att in attendees" :key="att.id" class="attendee-card">
                <div class="att-info">
                  <strong @click="router.push(`/chat/${event.id}/${att.id}`)" class="clickable-username">{{ att.username }}</strong>
                  <span class="att-email">{{ att.email }}</span>
                  <span class="att-timeslot" v-if="att.timeSlot">⌚ {{ new Date(att.timeSlot).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) }}</span>
                  <span class="badge" :class="att.status">{{ att.status }}</span>
                </div>
                <div class="att-actions">
                  <button v-if="att.status !== 'approved'" @click="updateAttendeeStatus(att.id, 'approved')" class="btn-icon approve-btn" title="Approve">✓</button>
                  <button v-if="att.status !== 'rejected'" @click="updateAttendeeStatus(att.id, 'rejected')" class="btn-icon reject-btn" title="Reject">✕</button>
                </div>
              </li>
            </ul>
            <p v-else class="empty-state">No one has registered for your event yet.</p>
          </div>
        </div>

        <!-- Right / Bottom Action Bar -->
        <div class="action-sidebar">
          <div class="action-panel glass-panel">
            <template v-if="authStore.isAuthenticated">
              <div class="role-actions" v-if="event.createdBy === authStore.user?.id">
                <h4 class="action-title">Organizer Actions</h4>
                <button @click="showAttendees = !showAttendees" class="action-btn outline-btn">
                  👥 Manage Attendees ({{ attendees.length }})
                </button>
              </div>
              <div class="role-actions" v-else>
                <div v-if="selectedTimeSlot">
                  <div class="slot-summary">
                     Selected Slot: <strong>{{ new Date(event.timeSlots.find(s => s.id === selectedTimeSlot)?.startTime).toLocaleString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'}) }}</strong>
                  </div>
                  <div v-if="isRegisteredForSelected" class="status-alert" :class="selectedSlotStatus">
                    {{ selectedSlotStatus === 'pending' ? '⏳ Pending Organizer Approval' : (selectedSlotStatus === 'rejected' ? '❌ Registration Rejected' : '✅ You are registered!') }}
                  </div>
                </div>

                <div class="main-actions-grid">
                  <button v-if="!isRegisteredForSelected" @click="registerForEvent" :disabled="registering || !selectedTimeSlot" class="action-btn primary-btn pulse-glow">
                    {{ registering ? 'Registering...' : 'Complete Registration' }}
                  </button>
                  <button v-else @click="deregisterForEvent" :disabled="registering" class="action-btn danger-btn">
                    Cancel Registration
                  </button>
                  
                  <button @click="router.push(`/chat/${event.id}/${event.createdBy}`)" class="action-btn secondary-btn">
                    💬 Chat Organizer
                  </button>
                </div>
              </div>

              <!-- Group Chat Action -->
              <div class="feature-divider" v-if="canJoinGroupChat || (selectedTimeSlot && !isRegisteredForSelected && event.createdBy !== authStore.user?.id)"></div>
              
              <div class="group-chat-action" v-if="canJoinGroupChat">
                <button @click="router.push(`/group-chat/${event.id}/${selectedTimeSlot}`)" class="action-btn highlight-btn">
                  <span class="icon">💬</span> Open Group Chat
                </button>
                <p class="feature-hint">Unlocked for this time slot!</p>
              </div>
              <div class="group-chat-action" v-else-if="selectedTimeSlot && !isRegisteredForSelected && event.createdBy !== authStore.user?.id">
                 <p class="feature-hint locked-hint"><span class="icon">🔒</span> Register to unlock group chat</p>
              </div>
            </template>
            <div v-else class="auth-prompt">
              <h3>Join the Vibe</h3>
              <p>Log in to reserve your spot at this event.</p>
              <button @click="router.push('/login')" class="action-btn primary-btn">Login to Register</button>
            </div>
            
            <p v-if="message" class="status-message" :class="{ 'error': message.includes('Failed') || message.includes('login') }">
              {{ message }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="error-page">
      <h2>{{ message || 'Event not found.' }}</h2>
      <button @click="router.push('/')" class="action-btn outline-btn">Go Back Home</button>
    </div>
  </div>
</template>

<style scoped>
/* Page Variables & Resets */
.event-detail-page {
  position: relative;
  min-height: 100vh;
  background-color: var(--bg-color);
  padding-bottom: 15rem; /* Space for action bar on mobile */
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(255,255,255,0.1);
  border-left-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 100px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Hero Section (Edge to Edge) */
.hero-section {
  position: relative;
  width: 100%;
  height: 45vh;
  min-height: 300px;
  background-color: #000;
  overflow: hidden;
}
.hero-section::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 100px;
  background: linear-gradient(to top, var(--bg-color), transparent);
  pointer-events: none;
}

.carousel-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.carousel-slide { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
.carousel-media { width: 100%; height: 100%; object-fit: cover; }
.event-hero-banner { width: 100%; height: 100%; background-size: cover; background-position: center; }

.back-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  z-index: 10;
}
.back-btn:hover { background: rgba(0,0,0,0.8); }

.carousel-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: 0.2s; z-index: 10; }
.carousel-btn:hover { background: var(--primary-color); }
.prev-btn { left: 15px; }
.next-btn { right: 15px; }

/* Main Layout & Glassmorphism */
.main-layout {
  position: relative;
  max-width: 1200px;
  margin: -40px auto 0;
  padding: 0 1rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.event-body {
  background: var(--bg-color);
  border-radius: 24px 24px 0 0;
  padding: 24px 0;
  width: 100%;
}

.glass-panel {
  background: rgba(30, 30, 35, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-light);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

/* Typography & Header */
.body-header { margin-bottom: 2rem; }
.event-title {
  font-family: 'Outfit', sans-serif;
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #fff, var(--primary-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.meta-badges { display: flex; flex-wrap: wrap; gap: 0.8rem; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 30px;
  font-size: 0.9rem;
  color: var(--text-main);
  text-decoration: none;
}
.badge.pending { color: #facc15; }
.badge.approved { color: #34d399; }
.badge.rejected { color: #ef4444; }

.location-badge { color: var(--primary-color); transition: all 0.2s; }
.location-badge:hover { background: rgba(56, 189, 248, 0.1); border-color: var(--primary-color); transform: translateY(-1px); }

/* Sections */
.section { margin-bottom: 2.5rem; animation: fadeInUp 0.5s ease backwards; }
.section:nth-child(2) { animation-delay: 0.1s; }
.section:nth-child(3) { animation-delay: 0.2s; }
.section:nth-child(4) { animation-delay: 0.3s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title { font-family: 'Outfit', sans-serif; font-size: 1.4rem; margin-bottom: 1rem; color: #fff; font-weight: 700; }
.desc-text { font-size: 1.05rem; color: var(--text-muted); line-height: 1.7; white-space: pre-wrap; }

/* Time Slots (Scrollable Horizontal Cards) */
.time-slot-scroll-container {
  display: flex;
  overflow-x: auto;
  gap: 1rem;
  padding-bottom: 1rem;
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color) rgba(255,255,255,0.05);
  -webkit-overflow-scrolling: touch;
}
.time-slot-scroll-container::-webkit-scrollbar { height: 6px; }
.time-slot-scroll-container::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 3px; }

.time-slot-card {
  flex: 0 0 auto;
  min-width: 150px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1.25rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  color: var(--text-muted);
}
.time-slot-card:hover:not(:disabled) {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.2);
  transform: translateY(-2px);
}
.time-slot-card.active {
  background: rgba(56, 189, 248, 0.1);
  border-color: var(--primary-color);
  color: #fff;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);
}
.time-slot-card.active::before {
  content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--primary-color);
}
.time-slot-card.booked {
  border-color: var(--secondary-color);
  background: rgba(52, 211, 153, 0.05);
  color: var(--text-main);
}
.time-slot-card.full { opacity: 0.5; cursor: not-allowed; }

.slot-date { font-size: 0.85rem; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px; }
.slot-time-text { font-size: 1.6rem; font-weight: 700; color: #fff; margin-bottom: 8px; font-family: 'Outfit', sans-serif; }
.time-slot-card.booked .slot-time-text { color: var(--secondary-color); }
.slot-status { font-size: 0.8rem; }

/* Map */
.map-wrapper { height: 300px; border-radius: 16px; overflow: hidden; padding: 4px; }

/* Action Sidebar & Bottom Bar */
.action-sidebar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 100;
  padding: 1rem;
  background: linear-gradient(to top, rgba(9,9,11,1) 70%, rgba(9,9,11,0));
  pointer-events: none; /* Let touches pass through gradient */
}
.action-panel {
  pointer-events: auto; /* Re-enable for the actual panel */
  border-radius: 20px;
  padding: 1.25rem;
  background: rgba(20, 20, 25, 0.7); /* Slightly darker for contrast */
}

.action-title { font-family: 'Outfit', sans-serif; color: #fff; margin-bottom: 1rem; font-size: 1.2rem; }
.slot-summary { font-size: 0.95rem; color: var(--text-muted); margin-bottom: 8px; text-align: center; }
.status-alert { font-size: 0.95rem; text-align: center; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-weight: 600;}
.status-alert.pending { background: rgba(234, 179, 8, 0.15); color: #facc15; }
.status-alert.approved { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.status-alert.rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.main-actions-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.action-btn {
  width: 100%;
  padding: 12px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.98rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
.primary-btn { background: var(--primary-color); color: #000; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3); font-weight: 700; }
.primary-btn:hover { background: var(--primary-hover); transform: translateY(-2px); }
.primary-btn:disabled { background: #334155; box-shadow: none; color: #94a3b8; cursor: not-allowed; }

.pulse-glow:not(:disabled) { animation: pulseGlow 2s infinite; }
@keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }

.secondary-btn { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
.secondary-btn:hover { background: rgba(255,255,255,0.1); }
.danger-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.danger-btn:hover { background: rgba(239, 68, 68, 0.2); }
.highlight-btn { background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: #000; font-weight: 700; }
.outline-btn { background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); }
.outline-btn:hover { background: rgba(56, 189, 248, 0.1); }

.feature-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 15px 0; }
.feature-hint { font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 8px; }
.locked-hint { color: #facc15; }
.status-message { text-align: center; margin-top: 10px; font-weight: 500; color: var(--secondary-color); font-size: 0.95rem; }
.status-message.error { color: #ef4444; }

/* Desktop Media Query */
@media (min-width: 992px) {
  .hero-section { height: 50vh; max-height: 500px; border-radius: 24px; margin-top: 2rem; }
  .event-detail-page { padding-bottom: 2rem; }
  .main-layout { flex-direction: row; margin-top: 2rem; align-items: flex-start; }
  .event-body { flex: 1; min-width: 0; padding: 0; background: transparent; border-radius: 0; padding-right: 2rem; }
  
  .action-sidebar {
    position: sticky;
    top: 2rem;
    width: 400px;
    flex-shrink: 0;
    padding: 0;
    background: transparent;
    pointer-events: auto;
  }
}

/* Attendee Panel overrides */
.attendee-card { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); }
.att-info { display: flex; flex-direction: column; gap: 0.3rem; }
.clickable-username { color: var(--primary-color); text-decoration: none; cursor: pointer; font-size: 1.1rem; }
.clickable-username:hover { text-decoration: underline; }
.att-email { color: var(--text-muted); font-size: 0.9rem; }
.btn-icon { width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer; display: inline-flex; justify-content: center; align-items: center; color: white; margin-left: 8px; font-size: 1.2rem; }
.approve-btn { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
.approve-btn:hover { background: #34d399; color: #000; }
.reject-btn { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
.reject-btn:hover { background: #ef4444; color: #fff; }
.empty-state { color: var(--text-muted); font-style: italic; }
</style>
