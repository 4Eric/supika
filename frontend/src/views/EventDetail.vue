<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import EventMap from '@/components/EventMap.vue'
import EventHero from '@/components/EventHero.vue'
import AttendeeList from '@/components/AttendeeList.vue'
import { getImageUrl } from '@/utils/imageUrl'
import { useAsync } from '@/composables/useAsync'
import LoadingSkeleton from '@/components/LoadingSkeleton.vue'
import QrcodeVue from 'qrcode.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const event = ref(null)
const registering = ref(false)
const selectedTimeSlot = ref(null)
const rsvpStatus = ref('going')
const message = ref('')
const uploadingMemory = ref(false)
const memoryUploadError = ref('')
const showUploadModal = ref(false)
const showCancelConfirm = ref(false)
const cancelTargetSlotId = ref(null) // locked when cancel modal opens
const showTicketModal = ref(false)

const { loading, execute: executeFetchEvent } = useAsync(async (id) => {
  const res = await axios.get(`${API_URL}/api/events/${id}`)
  event.value = res.data
  return res.data
})

const { data: memories, execute: executeFetchMemories } = useAsync(async (id) => {
  const res = await axios.get(`${API_URL}/api/events/${id}/memories`)
  return res.data
}, { initialData: [] })

const { data: attendees, execute: executeFetchAttendees } = useAsync(async (id) => {
  const res = await axios.get(`${API_URL}/api/events/${id}/attendees`, {
    headers: { 'x-auth-token': authStore.token }
  })
  return res.data
}, { initialData: [] })

const { execute: executeFetchMyRegistrations } = useAsync(async (id) => {
  if (!authStore.isAuthenticated || !authStore.token) return
  const eventIdNum = parseInt(id)
  const regRes = await axios.get(`${API_URL}/api/events/registered/me`, {
    headers: { 'x-auth-token': authStore.token }
  })
  const userRegs = regRes.data.filter(e => e.id === eventIdNum)
  if (userRegs.length > 0) {
    registeredSlots.value = userRegs.map(r => ({ 
      slotId: r.timeSlotId, 
      status: r.status,
      ticketToken: r.ticketToken || r.ticket_token
    }))
  }
})
const checkingOut = ref(false)

const handleCheckout = async () => {
  if (!selectedTimeSlot.value) {
    message.value = 'Please select a time slot'
    return
  }
  
  checkingOut.value = true
  try {
    const res = await axios.post(`${API_URL}/api/payments/checkout`, {
      eventId: event.value.id,
      timeSlotId: selectedTimeSlot.value
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    if (res.data.url) {
      window.location.href = res.data.url
    }
  } catch (err) {
    console.error('Checkout failed', err)
    message.value = err.response?.data?.message || err.message || 'Checkout failed. Please try again.'
  } finally {
    checkingOut.value = false
  }
}

const registeredSlots = ref([])

const selectedSlotReg = computed(() => {
  return registeredSlots.value.find(s => s.slotId === selectedTimeSlot.value)
})
const isRegisteredForSelected = computed(() => !!selectedSlotReg.value)
const selectedSlotStatus = computed(() => selectedSlotReg.value?.status || '')
const showAttendees = ref(false)

const publicAttendees = computed(() => {
  return event.value?.attendees || []
})

const goingAttendees = computed(() => publicAttendees.value.filter(a => a.rsvpStatus === 'going' || !a.rsvpStatus))
const maybeAttendees = computed(() => publicAttendees.value.filter(a => a.rsvpStatus === 'maybe'))

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

const currentTicketToken = computed(() => {
  if (!selectedTimeSlot.value) return null
  // Loose equality check to handle string vs number
  const reg = registeredSlots.value.find(s => s.slotId == selectedTimeSlot.value)
  return reg ? reg.ticketToken : null
})


onMounted(async () => {
  try {
    const id = route.params.id
    await executeFetchEvent(id)

      if (authStore.isAuthenticated) {
        await executeFetchMyRegistrations(id)
      }

      executeFetchAttendees(id)
      executeFetchMemories(id)
  } catch (error) {
    message.value = "Event not found or failed to load."
  }

  // Scroll-reveal: animate sections in when they enter viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.08 })

  // Observe after a tick so DOM is ready
  setTimeout(() => {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el))
  }, 100)
  scrollObserver = observer
})

let scrollObserver = null
onUnmounted(() => {
  if (scrollObserver) scrollObserver.disconnect()
})

// 3D card tilt on hover/touch
const onCardMouseMove = (e) => {
  const card = e.currentTarget
  const rect = card.getBoundingClientRect()
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY

  const cx = (clientX - rect.left) / rect.width - 0.5
  const cy = (clientY - rect.top) / rect.height - 0.5
  card.style.transform = `perspective(800px) rotateX(${cy * -12}deg) rotateY(${cx * 15}deg) translateZ(8px)`
}
const onCardMouseLeave = (e) => {
  e.currentTarget.style.transform = ''
}

const fetchMemories = () => executeFetchMemories(route.params.id)

const handleMemoryUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  uploadingMemory.value = true
  memoryUploadError.value = ''
  
  const formData = new FormData()
  formData.append('media', file)

  try {
    await axios.post(`${API_URL}/api/events/${event.value.id}/memories`, formData, {
      headers: { 
        'x-auth-token': authStore.token,
        'Content-Type': 'multipart/form-data'
      }
    })
    showUploadModal.value = false
    fetchMemories()
  } catch (err) {
    memoryUploadError.value = "Failed to upload memory. Try again."
  } finally {
    uploadingMemory.value = false
  }
}

const isEventPast = computed(() => {
  if (!event.value?.timeSlots?.length) return false
  return event.value.timeSlots.some(slot => slot.startTime && new Date(slot.startTime) < new Date())
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
      { 
        timeSlotId: selectedTimeSlot.value,
        rsvpStatus: rsvpStatus.value
      },
      { headers: { 'x-auth-token': authStore.token } }
    )
    await executeFetchMyRegistrations(event.value.id)
    message.value = event.value.requiresApproval ? "Request sent. Waiting for organizer approval." : "Successfully registered! A confirmation email has been sent."
  } catch (error) {
    message.value = error.response?.data?.message || "Failed to register."
  } finally {
    registering.value = false
  }
}

const deregisterForEvent = async (confirmed = false) => {
  if (confirmed !== true) {
    cancelTargetSlotId.value = selectedTimeSlot.value
    showCancelConfirm.value = true
    return
  }
  showCancelConfirm.value = false

  const isPaid = event.value?.ticketPrice > 0
  const targetSlot = cancelTargetSlotId.value || selectedTimeSlot.value

  registering.value = true
  message.value = ''

  try {
    if (isPaid) {
      await axios.post(`${API_URL}/api/payments/refund`, {
        eventId: event.value.id,
        timeSlotId: targetSlot
      }, { headers: { 'x-auth-token': authStore.token } })
      message.value = '✅ Refund issued! It may take 5–10 business days to appear.'
    } else {
      await axios.delete(`${API_URL}/api/events/${event.value.id}/register`, {
        headers: { 'x-auth-token': authStore.token },
        data: { timeSlotId: targetSlot }
      })
      message.value = 'Successfully canceled registration.'
    }

    registeredSlots.value = registeredSlots.value.filter(s => s.slotId !== targetSlot)
    cancelTargetSlotId.value = null
  } catch (error) {
    message.value = error.response?.data?.message || 'Failed to cancel registration.'
  } finally {
    registering.value = false
  }
}


const confirmCancel = () => deregisterForEvent(true)

const fetchAttendees = () => executeFetchAttendees(route.params.id)

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
      <LoadingSkeleton type="detail" />
    </div>
    <div v-else-if="event" class="page-content">
      
      <EventHero :event="event" />

      <!-- Main Body layout -->
      <div class="main-layout">
        <!-- New Prominent Host Block -->
        <div class="host-prominent-block glass-panel reveal-on-scroll tilt-card"
             @mousemove="onCardMouseMove" @mouseleave="onCardMouseLeave"
             @touchmove="onCardMouseMove" @touchend="onCardMouseLeave">
          <div class="organization-branding-large" v-if="event.organizationName">
            <div class="org-logo-large">
              <img v-if="event.organizationLogo" :src="getImageUrl(event.organizationLogo)" :alt="event.organizationName" />
              <div v-else class="org-logo-placeholder-large">🏢</div>
            </div>
            <span class="org-name-large">{{ event.organizationName }}</span>
          </div>

          <div class="hosts-group-large" v-if="event.hosts && event.hosts.length > 0">
            <h4 class="hosted-by-text">Hosted By</h4>
            <div class="hosts-list">
              <router-link 
                v-for="host in event.hosts" 
                :key="host.id" 
                :to="`/host/${host.id}`" 
                class="host-badge-large clickable"
              >
                <div class="host-avatar-large">
                  <img v-if="host.avatarUrl" :src="getImageUrl(host.avatarUrl)" :alt="host.username" />
                  <div v-else class="host-avatar-placeholder">{{ host.username.charAt(0).toUpperCase() }}</div>
                </div>
                <span class="host-username-large">{{ host.username }}</span>
              </router-link>
            </div>
          </div>
          <div class="hosts-group-large" v-else>
             <h4 class="hosted-by-text">Hosted By</h4>
             <router-link :to="`/host/${event.createdBy}`" class="host-badge-large clickable">
                <div class="host-avatar-large">
                  <img v-if="event.creatorAvatar" :src="getImageUrl(event.creatorAvatar)" :alt="event.creatorName" />
                  <div v-else class="host-avatar-placeholder">{{ (event.creatorName || 'U').charAt(0).toUpperCase() }}</div>
                </div>
                <span class="host-username-large">{{ event.creatorName || 'Organizer' }}</span>
             </router-link>
          </div>
        </div>

        <!-- Left / Body Content -->
        <div class="event-body">
          
          <div v-if="event.timeSlots && event.timeSlots.length > 0" class="section time-slots-section reveal-on-scroll">
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
                @click="selectedTimeSlot = (selectedTimeSlot === slot.id ? null : slot.id)"
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
          
          <div class="section event-description reveal-on-scroll tilt-card glass-panel"
               @mousemove="onCardMouseMove" @mouseleave="onCardMouseLeave"
               @touchmove="onCardMouseMove" @touchend="onCardMouseLeave">
            <h3 class="section-title">About this event</h3>
            <p class="desc-text">{{ event.description }}</p>
          </div>
          
          <div class="section map-section reveal-on-scroll">
            <h3 class="section-title">Location</h3>
            <div class="map-wrapper glass-panel">
              <EventMap :events="[event]" />
            </div>
          </div>

          <!-- Memory Board Section -->
          <div class="section memory-board-section reveal-on-scroll">
            <div class="section-header-flex">
              <h3 class="section-title">Memory Board</h3>
              <button v-if="hasApprovedRegistration || event.createdBy === authStore.user?.id" 
                      @click="showUploadModal = true" 
                      class="btn-sm btn-outline">
                📸 Add Memory
              </button>
            </div>
            
            <div v-if="memories.length > 0" class="memories-masonry">
              <div v-for="(mem, i) in memories" :key="mem.id" class="memory-card"
                   :style="{ '--rot': ((i % 5) - 2) + 'deg' }">
                <img :src="getImageUrl(mem.imageUrl)" class="memory-img" loading="lazy" />
                <div class="memory-info">
                  <span class="uploader-name">by {{ mem.uploaderName }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-memories glass-panel">
              <p>No memories shared yet. {{ isEventPast ? 'Be the first to share a moment!' : 'Check back after the vibe starts!' }}</p>
            </div>
          </div>

          <!-- Upload Modal -->
          <div v-if="showUploadModal" class="modal-overlay" @click.self="showUploadModal = false">
            <div class="modal-content glass-panel">
              <h3>Share a Moment</h3>
              <p>Upload a photo from this event to the Memory Board.</p>
              <input type="file" @change="handleMemoryUpload" accept="image/*" class="file-input" :disabled="uploadingMemory" />
              <div v-if="uploadingMemory" class="upload-status">Uploading...</div>
              <div v-if="memoryUploadError" class="error-text">{{ memoryUploadError }}</div>
              <button @click="showUploadModal = false" class="btn-sm">Cancel</button>
            </div>
          </div>
          
          <!-- Attendee List Section (Public) -->
          <div class="section attendees-visibility reveal-on-scroll">
            <h3 class="section-title">Who's Vibing ({{ publicAttendees.length }})</h3>
            
            <div v-if="goingAttendees.length > 0" class="attendee-group">
              <h4 class="group-title">🔥 Going ({{ goingAttendees.length }})</h4>
              <div class="avatar-stack">
                <div 
                  v-for="att in goingAttendees.slice(0, 10)" 
                  :key="'pub-going-'+att.id" 
                  class="stack-item"
                  :title="att.username + ' (Going)'"
                >
                  <img v-if="att.avatarUrl" :src="getImageUrl(att.avatarUrl)" :alt="att.username" class="stack-img" />
                  <div v-else class="stack-placeholder">{{ att.username.charAt(0).toUpperCase() }}</div>
                </div>
                <div v-if="goingAttendees.length > 10" class="stack-more">+{{ goingAttendees.length - 10 }}</div>
              </div>
            </div>

            <div v-if="maybeAttendees.length > 0" class="attendee-group">
              <h4 class="group-title">🤔 Maybe ({{ maybeAttendees.length }})</h4>
              <div class="avatar-stack">
                <div 
                  v-for="att in maybeAttendees.slice(0, 10)" 
                  :key="'pub-maybe-'+att.id" 
                  class="stack-item"
                  :title="att.username + ' (Maybe)'"
                >
                  <img v-if="att.avatarUrl" :src="getImageUrl(att.avatarUrl)" :alt="att.username" class="stack-img" />
                  <div v-else class="stack-placeholder">{{ att.username.charAt(0).toUpperCase() }}</div>
                </div>
                <div v-if="maybeAttendees.length > 10" class="stack-more">+{{ maybeAttendees.length - 10 }}</div>
              </div>
            </div>

            <p v-if="publicAttendees.length === 0" class="empty-vibe">No one has joined yet. Be the first!</p>
          </div>

          <!-- Attendee Management Panel (Creator Only) -->
          <AttendeeList 
            v-if="showAttendees && event.createdBy === authStore.user?.id"
            :attendees="attendees"
            :isCreator="true"
            :eventId="event.id"
            @updateStatus="updateAttendeeStatus"
            @refresh="executeFetchAttendees(event.id)"
          />

          <!-- Cancel Confirmation Modal -->
          <div v-if="showCancelConfirm" class="modal-overlay" @click.self="showCancelConfirm = false">
            <div class="modal-content glass-panel" style="max-width: 420px;">
              <h3 style="font-size: 1.6rem; margin-bottom: 0.75rem;">Cancel Registration?</h3>
              <p v-if="event.ticketPrice > 0" style="color: var(--text-muted); margin-bottom: 1.5rem;">
                You paid <strong>${{ event.ticketPrice }}</strong> for this ticket. A <strong>full refund</strong> will be issued to your original payment method within <strong>5–10 business days</strong>.
              </p>
              <p v-else style="color: var(--text-muted); margin-bottom: 1.5rem;">
                Are you sure you want to cancel your registration for this event?
              </p>
              <button @click="confirmCancel" :disabled="registering" class="action-btn danger-btn" style="margin-bottom: 0.75rem;">
                {{ registering ? 'Processing...' : (event.ticketPrice > 0 ? '✅ Yes, Cancel & Refund' : '✅ Yes, Cancel') }}
              </button>
              <button @click="showCancelConfirm = false" class="btn-sm btn-outline" style="width: 100%; padding: 10px;">{{ event.ticketPrice > 0 ? 'Keep my ticket' : 'No, Go back' }}</button>
            </div>
          </div><!-- end showCancelConfirm -->
          </div><!-- closes event-body -->

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
                <div v-if="selectedTimeSlot && event.timeSlots">
                  <div class="slot-summary" v-if="event.timeSlots.find(s => s.id === selectedTimeSlot)">
                     Selected Slot: <strong>{{ new Date(event.timeSlots.find(s => s.id === selectedTimeSlot).startTime).toLocaleString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'}) }}</strong>
                  </div>
                  <div v-if="isRegisteredForSelected" class="status-alert" :class="selectedSlotStatus">
                    {{ selectedSlotStatus === 'pending' ? '⏳ Pending Organizer Approval' : (selectedSlotStatus === 'rejected' ? '❌ Registration Rejected' : '✅ You are registered!') }}
                  </div>
                </div>

                <div class="main-actions-grid" v-if="selectedTimeSlot">
                  <template v-if="!isRegisteredForSelected">
                    <!-- RSVP Type Selector -->
                    <div class="rsvp-selector" v-if="!event.ticketPrice || Number(event.ticketPrice) === 0">
                      <button 
                        class="rsvp-btn" 
                        :class="{ active: rsvpStatus === 'going' }"
                        @click="rsvpStatus = 'going'"
                      >
                        🔥 Going
                      </button>
                      <button 
                        class="rsvp-btn" 
                        :class="{ active: rsvpStatus === 'maybe' }"
                        @click="rsvpStatus = 'maybe'"
                      >
                        🤔 Maybe
                      </button>
                    </div>

                    <button v-if="event.ticketPrice > 0" @click="handleCheckout" :disabled="checkingOut || !selectedTimeSlot" class="action-btn primary-btn pulse-glow">
                      {{ checkingOut ? 'Redirecting...' : `Buy Ticket - $${event.ticketPrice}` }}
                    </button>
                    <button v-else @click="registerForEvent" :disabled="registering || !selectedTimeSlot" class="action-btn primary-btn pulse-glow">
                      {{ registering ? 'Registering...' : 'Complete Registration' }}
                    </button>
                  </template>
                  <button v-else @click="deregisterForEvent" :disabled="registering" class="action-btn danger-btn">
                    Cancel Registration
                  </button>

                  <button v-if="isRegisteredForSelected && selectedSlotStatus === 'approved'" @click="showTicketModal = true" class="action-btn highlight-btn">
                    🎟️ Show Ticket (QR)
                  </button>
                  
                  <button v-if="authStore.isAuthenticated" @click="router.push(`/chat/${event.id}/${event.createdBy}`)" class="action-btn secondary-btn">
                    💬 Chat Organizer
                  </button>
                </div>
              </div>

              <!-- Mobile prompt: no slot selected yet -->
              <div v-if="!selectedTimeSlot && event.createdBy !== authStore.user?.id && authStore.isAuthenticated" class="select-slot-prompt">
                <span class="prompt-icon">👆</span>
                <p>Select a time slot to register</p>
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
              <p>Log in to register for this event.</p>
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
    <!-- Ticket QR Modal -->
    <div v-if="showTicketModal" class="modal-overlay" @click.self="showTicketModal = false">
      <div class="modal-content glass-panel ticket-modal">
        <div class="modal-header">
          <h3>Your Entry Ticket</h3>
          <button @click="showTicketModal = false" class="close-btn">&times;</button>
        </div>
        <div class="ticket-body">
          <p class="ticket-info">Present this QR code to the host for check-in.</p>
          <div class="qr-container">
            <template v-if="currentTicketToken">
              <QrcodeVue 
                :value="String(currentTicketToken)" 
                :size="200"
              />
            </template>
            <div v-else class="qr-error">
              Ticket token missing...
            </div>
          </div>
          <div class="event-mini-info">
            <h4>{{ event.title }}</h4>
            <p>{{ new Date(event.timeSlots.find(s => s.id === selectedTimeSlot).startTime).toLocaleString() }}</p>
          </div>
        </div>
        <button @click="showTicketModal = false" class="action-btn primary-btn">Done</button>
      </div>
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

/* =========================================
   3D IMMERSIVE SYSTEM
   ========================================= */

/* Scroll-reveal: elements start invisible, animate in when .revealed is added */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
.reveal-on-scroll.revealed {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger children inside main-layout */
.main-layout > .reveal-on-scroll:nth-child(1) { transition-delay: 0s; }
.main-layout > .reveal-on-scroll:nth-child(2) { transition-delay: 0.06s; }
.main-layout > .reveal-on-scroll:nth-child(3) { transition-delay: 0.12s; }
.event-body .reveal-on-scroll:nth-child(1) { transition-delay: 0.05s; }
.event-body .reveal-on-scroll:nth-child(2) { transition-delay: 0.12s; }
.event-body .reveal-on-scroll:nth-child(3) { transition-delay: 0.19s; }
.event-body .reveal-on-scroll:nth-child(4) { transition-delay: 0.26s; }
.event-body .reveal-on-scroll:nth-child(5) { transition-delay: 0.33s; }

/* Tilt card: preserve-3d for mouse tilt effect */
.tilt-card {
  transform-style: preserve-3d;
  transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
  will-change: transform;
}
.tilt-card:hover {
  box-shadow: 0 20px 60px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.1);
}

/* Description section gets padding when it's a glass panel */
.event-description.glass-panel {
  padding: 1.75rem 2rem;
  border-radius: 20px;
}

/* =========================================
   TIME SLOT 3D LIFT EFFECTS
   ========================================= */
.time-slot-card {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.22s ease,
              border-color 0.22s ease,
              background 0.22s ease;
  will-change: transform;
  position: relative;
  overflow: hidden;
}
.time-slot-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), transparent);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.time-slot-card:not(:disabled):hover {
  transform: translateY(-5px) translateZ(8px) scale(1.02);
  box-shadow: 0 12px 32px -4px rgba(56, 189, 248, 0.2), 0 0 0 1px rgba(56,189,248,0.15);
}
.time-slot-card:not(:disabled):hover::before { opacity: 1; }

.time-slot-card.active {
  transform: translateY(-6px) translateZ(12px) scale(1.04);
  box-shadow: 0 16px 40px -6px rgba(56, 189, 248, 0.35),
              0 0 0 2px rgba(56, 189, 248, 0.5),
              0 0 20px rgba(56, 189, 248, 0.15);
  animation: slotGlow 2s ease-in-out infinite;
}
@keyframes slotGlow {
  0%, 100% { box-shadow: 0 16px 40px -6px rgba(56,189,248,0.35), 0 0 0 2px rgba(56,189,248,0.5), 0 0 20px rgba(56,189,248,0.1); }
  50%       { box-shadow: 0 16px 44px -4px rgba(56,189,248,0.5), 0 0 0 2px rgba(56,189,248,0.7), 0 0 30px rgba(56,189,248,0.2); }
}

.time-slot-card.full:not(.booked) {
  transform: translateY(2px) rotateX(3deg);
  opacity: 0.45;
}

/* =========================================
   ACTION PANEL 3D FLOAT
   ========================================= */
.action-sidebar {
  perspective: 800px;
}
.action-panel.glass-panel {
  transform: translateZ(0);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  transform-style: preserve-3d;
}
@media (min-width: 1024px) {
  .action-panel.glass-panel:hover {
    transform: translateZ(6px);
    box-shadow: 0 24px 60px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.15);
  }
}

/* Registration panel spring slide-up */
.main-actions-grid {
  animation: springUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transform-origin: bottom center;
}
@keyframes springUp {
  from { opacity: 0; transform: translateY(16px) rotateX(-8deg); }
  to   { opacity: 1; transform: translateY(0) rotateX(0deg); }
}

/* =========================================
   MEMORY BOARD — POLAROID 3D
   ========================================= */
.memory-card {
  transform: rotate(var(--rot, 0deg));
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease,
              z-index 0s;
  will-change: transform;
  position: relative;
  z-index: 1;
}
.memory-card:hover {
  transform: rotate(0deg) translateY(-8px) translateZ(20px) scale(1.06);
  box-shadow: 0 20px 50px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.2);
  z-index: 10;
}

/* =========================================
   REDUCED MOTION + TOUCH FALLBACKS
   ========================================= */
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll { opacity: 1; transform: none; transition: none; }
  .time-slot-card { transition: none; animation: none; }
  .time-slot-card.active { animation: none; }
  .memory-card { transition: none; }
  .main-actions-grid { animation: none; }
  .tilt-card { transition: none; }
}
@media (hover: none) {
  .tilt-card:hover { box-shadow: var(--card-shadow); }
  .time-slot-card:not(:disabled):hover { transform: none; box-shadow: none; }
  .memory-card:hover { transform: rotate(var(--rot, 0deg)); }
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
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  border: 1px solid var(--border-light);
  box-shadow: var(--card-shadow);
}

/* Attendee Stack */
.attendees-visibility {
  margin-top: 2rem;
}

.avatar-stack {
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
}

.stack-item {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--bg-color);
  margin-left: -12px;
  overflow: hidden;
  background: var(--input-bg);
  position: relative;
  transition: transform 0.2s;
}

.stack-item:hover {
  transform: translateY(-5px);
  z-index: 10;
}

.stack-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stack-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: white;
  font-weight: 800;
}

.stack-more {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--bg-color);
  margin-left: -12px;
  background: var(--border-light);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.empty-vibe {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.95rem;
}

/* Host Prominent Block */
.host-prominent-block {
  padding: 1.5rem;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1rem;
}

.organization-branding-large {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.org-logo-large {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
}

.org-logo-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.org-logo-placeholder-large {
  font-size: 1.5rem;
  text-align: center;
  line-height: 48px;
}

.org-name-large {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hosted-by-text {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  font-family: 'Outfit', sans-serif;
}

.hosts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.host-badge-large {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  background: var(--input-bg);
  padding: 0.5rem 1rem 0.5rem 0.5rem;
  border-radius: 30px;
  border: 1px solid var(--border-light);
  transition: all 0.2s;
}

.host-badge-large:hover {
  background: rgba(56, 189, 248, 0.1);
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.host-avatar-large {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.host-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.host-username-large {
  color: var(--text-main);
  font-weight: 600;
  font-size: 1.05rem;
}

.attendee-group {
  margin-bottom: 1.5rem;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

/* Hero and Header styles moved to EventHero.vue */
.carousel-indicators { display: none; } /* cleanup */
/* Badge styles moved to EventHero.vue */

/* Sections */
.section { margin-bottom: 2.5rem; animation: fadeInUp 0.5s ease backwards; }
.section:nth-child(2) { animation-delay: 0.1s; }
.section:nth-child(3) { animation-delay: 0.2s; }
.section:nth-child(4) { animation-delay: 0.3s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title { font-family: 'Outfit', sans-serif; font-size: 1.4rem; margin-bottom: 1rem; color: var(--text-main); font-weight: 700; }
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
  background: var(--input-bg);
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
  background: var(--border-light);
  border-color: var(--primary-color);
  transform: translateY(-2px);
}
.time-slot-card.active {
  background: var(--selected-bg);
  border-color: var(--primary-color);
  color: var(--selected-text);
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
.slot-time-text { font-size: 1.6rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; font-family: 'Outfit', sans-serif; }
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
  background: var(--card-bg); /* Slightly darker for contrast */
}

.action-title { font-family: 'Outfit', sans-serif; color: var(--text-main); margin-bottom: 1rem; font-size: 1.2rem; }
.slot-summary { font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px; text-align: center; }
.status-alert { font-size: 0.95rem; text-align: center; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-weight: 600;}
.status-alert.pending { background: rgba(234, 179, 8, 0.15); color: #facc15; }
.status-alert.approved { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.status-alert.rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.select-slot-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(56, 189, 248, 0.06);
  border: 1px dashed rgba(56, 189, 248, 0.25);
  text-align: center;
  margin-bottom: 0.5rem;
}
.prompt-icon { font-size: 1.5rem; }
.select-slot-prompt p { font-size: 0.875rem; color: var(--text-muted); margin: 0; }

.rsvp-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.rsvp-btn {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--input-bg);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.rsvp-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

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
.primary-btn { background: var(--primary-color); color: var(--btn-text-on-primary); box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3); font-weight: 700; }
.primary-btn:hover { background: var(--primary-hover); transform: translateY(-2px); }
.primary-btn:disabled { background: #334155; box-shadow: none; color: #94a3b8; cursor: not-allowed; }

.pulse-glow:not(:disabled) { animation: pulseGlow 2s infinite; }
@keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }

.secondary-btn { background: var(--input-bg); color: var(--text-main); border: 1px solid var(--border-light); }
.secondary-btn:hover { background: rgba(255,255,255,0.1); }
.danger-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.danger-btn:hover { background: rgba(239, 68, 68, 0.2); }
.highlight-btn { background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: var(--btn-text-on-primary); font-weight: 700; }
.outline-btn { background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); }
.outline-btn:hover { background: rgba(56, 189, 248, 0.1); }

.feature-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 15px 0; }
.feature-hint { font-size: 0.85rem; color: var(--text-main); opacity: 0.8; text-align: center; margin-top: 8px; }
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
.btn-icon { width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer; display: inline-flex; justify-content: center; align-items: center; color: var(--text-main); margin-left: 8px; font-size: 1.2rem; }
.approve-btn { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
.approve-btn:hover { background: #34d399; color: var(--btn-text-on-primary); }
.reject-btn { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
.reject-btn:hover { background: #ef4444; color: var(--btn-text-on-primary); }
.empty-state { color: var(--text-muted); font-style: italic; }
/* --- Memory Board --- */
.section-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.memories-masonry { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.memory-card { border-radius: 12px; overflow: hidden; position: relative; aspect-ratio: 1; }
.memory-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.memory-card:hover .memory-img { transform: scale(1.05); }
.memory-info { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding: 8px; font-size: 0.7rem; color: #ffffff; }

.empty-memories { padding: 40px; text-align: center; color: var(--text-muted); border-radius: 16px; }

.btn-sm { padding: 6px 14px; font-size: 0.8rem; border-radius: 8px; cursor: pointer; border: none; background: var(--primary-color); color: var(--btn-text-on-primary); font-weight: 700; }
.btn-outline { background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.modal-content { max-width: 400px; width: 90%; padding: 2rem; border-radius: 20px; text-align: center; position: relative; }
.modal-content h3 { margin-bottom: 1rem; }
.file-input { width: 100%; margin: 1.5rem 0; color: var(--text-main); }
.upload-status { font-size: 0.8rem; color: var(--primary-color); margin-bottom: 1rem; }
.error-text { color: #ef4444; font-size: 0.8rem; margin-bottom: 1rem; }

@media (max-width: 768px) {
  .memories-masonry { grid-template-columns: repeat(2, 1fr); }
}
/* Ticket Modal */
.ticket-modal {
  text-align: center;
  max-width: 400px;
  position: relative;
}
.modal-header {
  margin-bottom: 1.5rem;
}
.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.8rem;
  cursor: pointer;
  line-height: 1;
  z-index: 10;
}
.ticket-info {
  margin-bottom: 2rem;
  color: var(--text-muted);
}
.qr-container {
  background: white;
  padding: 1.5rem;
  border-radius: 1rem;
  display: inline-block;
  margin-bottom: 2rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
.event-mini-info {
  margin-bottom: 2rem;
}
.event-mini-info h4 {
  margin-bottom: 0.5rem;
}
.event-mini-info p {
  color: var(--primary-color);
  font-weight: 600;
}
.qr-error {
  color: #ef4444;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 1rem;
}
</style>
