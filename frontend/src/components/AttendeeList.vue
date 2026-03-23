<script setup>
import { defineProps, defineEmits, ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  attendees: { type: Array, default: () => [] },
  isCreator: { type: Boolean, default: false },
  eventId: { type: [String, Number], required: true }
})

const emit = defineEmits(['updateStatus', 'refresh'])
const router = useRouter()
const authStore = useAuthStore()

const isScanning = ref(false)
const scanner = ref(null)
const scanMessage = ref('')
const scanSuccess = ref(false)

const handleUpdateStatus = (userId, status) => {
  emit('updateStatus', userId, status)
}

const handleManualCheckIn = async (userId) => {
  try {
    await axios.post(`${API_URL}/api/v1/events/${props.eventId}/check-in/manual/${userId}`, {}, {
      headers: { 'x-auth-token': authStore.token }
    })
    emit('refresh')
  } catch (err) {
    console.error('Check-in failed', err)
    alert(err.response?.data?.message || 'Check-in failed')
  }
}

const startScanner = () => {
  isScanning.value = true
  scanMessage.value = 'Preparing camera...'
  scanSuccess.value = false
  
  setTimeout(() => {
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    };
    
    scanner.value = new Html5QrcodeScanner("qr-reader", config, /* verbose= */ false);
    scanner.value.render(onScanSuccess, onScanFailure);
    scanMessage.value = 'Scanner active. Center the QR code.'
  }, 100);
}

const stopScanner = () => {
  if (scanner.value) {
    scanner.value.clear().catch(err => console.error('Failed to clear scanner', err));
    scanner.value = null;
  }
  isScanning.value = false;
  scanMessage.value = '';
}

const onScanSuccess = async (decodedText) => {
  try {
    scanMessage.value = 'Verifying ticket...'
    const res = await axios.post(`${API_URL}/api/v1/events/${props.eventId}/check-in`, {
      ticket_token: decodedText
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    scanSuccess.value = true
    scanMessage.value = `✅ Successfully checked in: ${res.data.data.username}`
    
    // Stop scanner after short delay to show success
    setTimeout(() => {
      stopScanner()
      emit('refresh')
    }, 2000)
  } catch (err) {
    console.error('Check-in scan failed', err)
    scanSuccess.value = false
    const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Check-in failed'
    scanMessage.value = `❌ ${errorMsg}`
    
    // Resume scanning after 3 seconds
    setTimeout(() => {
      if (isScanning.value) {
        scanMessage.value = 'Scanner active. Center the QR code.'
      }
    }, 3000)
  }
}

const onScanFailure = (error) => {
  // Silent-ish to avoid console noise
}

onBeforeUnmount(() => {
  if (scanner.value) {
    scanner.value.clear().catch(() => {});
  }
})
</script>

<template>
  <div class="attendees-panel">
    <div class="hub-header">
      <h3 class="section-title">Attendees Hub</h3>
      <button v-if="isCreator" @click="startScanner" class="scan-entry-btn">
        📷 Scan Tickets
      </button>
    </div>
    <ul v-if="attendees.length > 0" class="attendees-list">
      <li v-for="att in attendees" :key="att.id" class="attendee-card">
        <div class="att-info">
          <strong @click="router.push(`/chat/${eventId}/${att.id}`)" class="clickable-username">{{ att.username }}</strong>
          <span class="att-email" v-if="att.email">{{ att.email }}</span>
          <span class="att-timeslot" v-if="att.timeSlot">⌚ {{ new Date(att.timeSlot).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) }}</span>
          <span class="badge" :class="att.status">{{ att.status }}</span>
        </div>
        <div class="att-actions" v-if="isCreator">
          <template v-if="att.status === 'approved'">
            <button v-if="!att.checkInTime" @click="handleManualCheckIn(att.id)" class="btn-sm checkin-btn">
              Check In
            </button>
            <span v-else class="checkin-badge">
              ✅ Checked In
              <small>{{ new Date(att.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</small>
            </span>
          </template>
          <button v-if="att.status !== 'approved'" @click="handleUpdateStatus(att.id, 'approved')" class="btn-icon approve-btn" title="Approve">✓</button>
          <button v-if="att.status !== 'rejected'" @click="handleUpdateStatus(att.id, 'rejected')" class="btn-icon reject-btn" title="Reject">✕</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty-state">No one has registered for this event yet.</p>

    <!-- Scanner Modal Overlay -->
    <div v-if="isScanning" class="scanner-overlay" @click.self="stopScanner">
      <div class="scanner-container glass-panel">
        <div class="scanner-header">
          <h3>Ticket Scanner</h3>
          <button @click="stopScanner" class="close-btn">&times;</button>
        </div>
        <div id="qr-reader"></div>
        <div class="scan-status" :class="{ 'success': scanSuccess, 'error': scanMessage.startsWith('❌') }">
          {{ scanMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.scan-entry-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  transition: transform 0.2s;
}

.scan-entry-btn:hover {
  transform: scale(1.05);
  background: var(--primary-hover);
}

.checkin-btn {
  background: var(--secondary-color);
  color: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  border: none;
  cursor: pointer;
}

.checkin-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #34d399;
  font-size: 0.8rem;
  font-weight: 700;
}

.checkin-badge small {
  font-weight: 400;
  color: var(--text-muted);
}

/* Scanner Overlay */
.scanner-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.scanner-container {
  width: 100%;
  max-width: 500px;
  background: var(--card-bg);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid var(--border-light);
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

#qr-reader {
  border: none !important;
  border-radius: 12px;
  overflow: hidden;
}

#qr-reader__dashboard {
  display: none !important;
}

.scan-status {
  margin-top: 20px;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: var(--input-bg);
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.scan-status.success {
  background: rgba(52, 211, 153, 0.1);
  color: #34d399;
}

.scan-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
}

.btn-sm {
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
}
</style>
