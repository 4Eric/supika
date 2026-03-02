<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const eventId = route.params.eventId
const timeSlotId = route.params.timeSlotId

const event = ref(null)
const messages = ref([])
const members = ref([])
const newMessage = ref('')
const loading = ref(true)
const sending = ref(false)
const errorMsg = ref('')
const showEmojiPicker = ref(false)
const showMembers = ref(false)

const onSelectEmoji = (emoji) => {
  newMessage.value += emoji.i
}

let pollInterval = null
const messagesContainer = ref(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const fetchMessages = async () => {
  if (!authStore.isAuthenticated) return
  
  try {
    const res = await axios.get(`${API_URL}/api/messages/group/${eventId}/${timeSlotId}`, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    // Group messages by sender for UI clustering
    let lastSenderId = null
    const groupedData = res.data.map(msg => {
      const isFirstInGroup = msg.sender_id !== lastSenderId;
      lastSenderId = msg.sender_id;
      return { ...msg, isFirstInGroup };
    });

    const isNew = messages.value.length !== groupedData.length
    messages.value = groupedData
    
    // Only scroll to bottom if new messages arrived OR we just loaded
    if (isNew) scrollToBottom()

  } catch (error) {
    console.error("Failed to fetch messages:", error)
  }
}

const fetchMembers = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/messages/group/${eventId}/${timeSlotId}/members`, {
      headers: { 'x-auth-token': authStore.token }
    })
    members.value = res.data
  } catch (error) {
    console.error("Failed to fetch members:", error)
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  // Adjust body overscroll for mobile to prevent bouncy elastic scrolling on iOS when keyboard is up
  document.body.style.overscrollBehavior = 'none';

  try {
    const eventRes = await axios.get(`${API_URL}/api/events/${eventId}`)
    event.value = eventRes.data
    
    await Promise.all([fetchMessages(), fetchMembers()])
    
    pollInterval = setInterval(fetchMessages, 3000)
    
  } catch (error) {
    if (error.response?.status === 403) {
      errorMsg.value = "Access denied. You must be an approved attendee to join this chat."
    } else {
      errorMsg.value = "Failed to load group chat."
    }
  } finally {
    loading.value = false
    scrollToBottom()
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  document.body.style.overscrollBehavior = 'auto'; // restore
})

const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value) return
  
  sending.value = true
  const tempContent = newMessage.value.trim()
  newMessage.value = '' // Clear input immediately for snappy feel
  showEmojiPicker.value = false

  try {
    await axios.post(`${API_URL}/api/messages/group/${eventId}/${timeSlotId}`, {
      content: tempContent
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    // Re-fetch immediately to show the new message with correct grouping
    await fetchMessages();
    scrollToBottom()
  } catch (error) {
    errorMsg.value = "Failed to send message."
    newMessage.value = tempContent // Restore if failed
  } finally {
    sending.value = false
  }
}

const goBack = () => {
  router.push(`/messages`)
}

// Relative time formatting for messages inside the chat
const formatMessageTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="chat-wrapper">
    <!-- Loading & Error States -->
    <div v-if="loading" class="state-full">
      <div class="spinner"></div>
      <p>Joining chat...</p>
    </div>
    <div v-else-if="errorMsg" class="state-full error">
      <div class="card error-card">
        <h3>Oops</h3>
        <p>{{ errorMsg }}</p>
        <button @click="goBack" class="btn btn-outline mt-3">Go Back</button>
      </div>
    </div>
    
    <!-- Chat UI -->
    <div v-else class="chat-column">
      
      <!-- Frosted Sticky Header -->
      <header class="chat-header glass-header">
        <button @click="goBack" class="btn-icon back-btn" aria-label="Go Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        
        <div class="header-info" @click="showMembers = !showMembers">
          <h2 class="chat-title">{{ event?.title || 'Group Chat' }}</h2>
          <p class="chat-subtitle">
            {{ members.length }} Members <span class="member-chevron">›</span>
          </p>
        </div>
      </header>

      <!-- Messages Area -->
      <main class="messages-area" ref="messagesContainer">
        <div v-if="messages.length === 0" class="empty-chat">
          <div class="empty-icon">👋</div>
          <p>Welcome to the group! Be the first to say hello.</p>
        </div>
        
        <div class="message-list">
          <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message-row"
            :class="msg.sender_id === authStore.user.id ? 'row-sent' : 'row-received'"
          >
            <!-- Only show avatar for received messages, and only if it's the first in a group -->
            <div class="msg-avatar-spacer" v-if="msg.sender_id !== authStore.user.id">
              <div v-if="msg.isFirstInGroup" class="msg-avatar">
                {{ msg.sender_name.charAt(0).toUpperCase() }}
              </div>
            </div>

            <div class="msg-content-wrapper">
              <div v-if="msg.sender_id !== authStore.user.id && msg.isFirstInGroup" class="msg-sender-name">
                {{ msg.sender_name }}
              </div>
              
              <div 
                class="msg-bubble" 
                :class="{ 
                  'bubble-sent': msg.sender_id === authStore.user.id, 
                  'bubble-received': msg.sender_id !== authStore.user.id,
                  'bubble-first': msg.isFirstInGroup
                }"
              >
                <span class="msg-text">{{ msg.content }}</span>
                <span class="msg-time">{{ formatMessageTime(msg.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Input Area -->
      <footer class="input-area glass-footer">
        <!-- Emoji Picker Popup -->
        <transition name="fade-up">
          <div class="emoji-picker-container" v-if="showEmojiPicker">
            <EmojiPicker :native="true" @select="onSelectEmoji" class="custom-emoji-picker" />
          </div>
        </transition>

        <form @submit.prevent="sendMessage" class="input-form">
          <button type="button" class="btn-icon emoji-btn" @click="showEmojiPicker = !showEmojiPicker" aria-label="Add emoji">
            😀
          </button>
          <div class="input-wrapper">
            <input 
              type="text" 
              v-model="newMessage" 
              placeholder="Message group..." 
              class="chat-input"
              :disabled="sending"
              @focus="showEmojiPicker = false"
              autocomplete="off"
            />
          </div>
          <button type="submit" class="btn-send" :disabled="sending || !newMessage.trim()" aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ opacity: (sending || !newMessage.trim()) ? 0.5 : 1 }"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </footer>

      <!-- Members Overlay Sidebar (Mobile Friendly) -->
      <transition name="slide-right">
        <div v-if="showMembers" class="members-overlay">
          <div class="members-sidebar glass-panel">
            <div class="sidebar-header">
              <h3>Group Members</h3>
              <button @click="showMembers = false" class="btn-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div class="sidebar-scroll">
              <div v-for="member in members" :key="member.id" class="member-item">
                <div class="member-avatar">{{ member.username.charAt(0).toUpperCase() }}</div>
                <div class="member-info">
                  <span class="member-name">{{ member.username }}</span>
                  <span class="member-tag" v-if="member.group_role === 'organizer'">Host</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Click outer area to close -->
          <div class="sidebar-backdrop" @click="showMembers = false"></div>
        </div>
      </transition>
      
    </div>
  </div>
</template>

<style scoped>
/* Mobile-First Full Screen Wrapper */
.chat-wrapper {
  position: absolute; /* Take over the screen, bypassing normal layout flow slightly */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-color);
  z-index: 1000; /* Sit above the standard App.vue navigation */
  display: flex;
  flex-direction: column;
}

.chat-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%; /* Important for iOS Safari safe areas */
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  background-color: var(--bg-color);
}

/* States */
.state-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  color: var(--text-muted);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Sticky Header */
.glass-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(9, 9, 11, 0.85); /* Very dark, semi-transparent */
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  padding: 0.75rem 0.5rem;
  /* Safe area top padding for iPhones */
  padding-top: max(0.75rem, env(safe-area-inset-top)); 
}

.back-btn {
  padding: 0.5rem;
  color: var(--primary-color);
  background: transparent;
  border: none;
  border-radius: 50%;
}
.back-btn:active {
  background: rgba(255,255,255,0.05);
}

.header-info {
  flex: 1;
  padding: 0 0.5rem;
  cursor: pointer;
}
.chat-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70vw;
}
.chat-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.member-chevron {
  font-size: 1rem;
  line-height: 1;
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  -webkit-overflow-scrolling: touch;
  /* Safe area padding */
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
}

.empty-chat {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.95rem;
  padding: 2rem;
  background: rgba(255,255,255,0.03);
  border-radius: 1rem;
}
.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.message-list {
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* Push to bottom */
  min-height: 100%;
  gap: 0.25rem; /* Tight gap for grouped messages */
}

.message-row {
  display: flex;
  width: 100%;
}
.row-sent {
  justify-content: flex-end;
}
.row-received {
  justify-content: flex-start;
  margin-top: 0.5rem; /* Spacing before new sender starts */
}
.row-sent {
  margin-top: 0.25rem;
}

.msg-avatar-spacer {
  width: 32px;
  min-width: 32px;
  margin-right: 0.5rem;
  display: flex;
  align-items: flex-end; /* Avatar sits at the bottom of a block */
}
.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--bg-lighter), var(--border-light));
  color: var(--text-main);
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.msg-content-wrapper {
  max-width: 80%; /* Don't stretch across screen */
  display: flex;
  flex-direction: column;
}

.msg-sender-name {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-left: 0.5rem;
  margin-bottom: 0.15rem;
}

.msg-bubble {
  position: relative;
  padding: 0.6rem 0.85rem;
  border-radius: 1.15rem; /* Pill-like */
  font-size: 0.95rem;
  line-height: 1.35;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* Sent message tail grouping logic */
.bubble-sent {
  background: linear-gradient(135deg, #0ea5e9, #3b82f6); /* Primary Brand Gradient */
  color: white;
  border-bottom-right-radius: 0.35rem; /* Sharp corner for sent */
  border-top-right-radius: 0.35rem; /* Assume grouped middle */
}
.bubble-sent.bubble-first {
  border-top-right-radius: 1.15rem; /* Round top right if first */
}
/* If it's the LAST one in a group, we ideally make bottom-right sharp and top-right round, 
   but simplistic grouping logic here just sharpens the whole right edge. It still looks modern. */

/* Received message tail grouping logic */
.bubble-received {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  border-bottom-left-radius: 0.35rem;
  border-top-left-radius: 0.35rem;
}
.bubble-received.bubble-first {
  border-top-left-radius: 1.15rem;
}

.msg-text {
  word-wrap: break-word; /* Ensure long links don't break layout */
}

/* Time stamped inside bubble bottom right corner */
.msg-time {
  font-size: 0.65rem;
  align-self: flex-end;
  margin-top: 0.1rem;
  margin-right: -0.2rem;
  opacity: 0.7;
}

/* Input Footer */
.glass-footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 0.75rem;
  /* Safe area padding for iPhones with Home Bars */
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  padding-left: max(0.75rem, env(safe-area-inset-left));
  padding-right: max(0.75rem, env(safe-area-inset-right));
}

.input-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
}
.btn-icon:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-main);
}

.input-wrapper {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24px; /* Highly rounded pill shape */
  overflow: hidden;
  transition: border-color 0.2s, background 0.2s;
}
.input-wrapper:focus-within {
  background: rgba(255,255,255,0.1);
  border-color: rgba(56, 189, 248, 0.4);
}

.chat-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.75rem 1rem;
  color: var(--text-main);
  font-size: 0.95rem;
  outline: none;
}
.chat-input::placeholder {
  color: var(--text-muted);
}

.btn-send {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(56, 189, 248, 0.3);
  transition: transform 0.1s;
}
.btn-send:active:not(:disabled) {
  transform: scale(0.9);
}
.btn-send:disabled {
  background: rgba(255,255,255,0.1);
  box-shadow: none;
  color: rgba(255,255,255,0.3);
}

/* Emoji Picker Positioning */
.emoji-picker-container {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0.5rem;
  z-index: 100;
  /* Mobile constraint */
  max-width: calc(100vw - 1rem); 
  max-height: 350px;
}
.custom-emoji-picker {
  --ep-color-bg: #1e293b;
  --ep-color-border: #334155;
  --ep-color-text: #f8fafc;
  --ep-color-s-text: #94a3b8;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

/* Transitions */
.fade-up-enter-active, .fade-up-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(10px) scale(0.98); }

.slide-right-enter-active, .slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}
.slide-right-enter-from, .slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Members Overlay Sidebar */
.members-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}
.sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  z-index: -1;
}
.members-sidebar {
  width: 85vw;
  max-width: 320px;
  height: 100%;
  background: var(--card-bg);
  border-left: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
}
.sidebar-header {
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-header h3 {
  font-size: 1.1rem;
  margin: 0;
  color: var(--text-main);
}
.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem;
  border-radius: 0.5rem;
}
.member-info {
  display: flex;
  flex-direction: column;
}
.member-name { font-weight: 500; font-size: 0.95rem; }
.member-tag { font-size: 0.7rem; color: var(--primary-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;}

/* Desktop Layout Tweaks */
@media (min-width: 768px) {
  .chat-wrapper {
    position: relative; /* Break out of absolute mobile takeover */
    height: calc(100vh - 80px); /* Fit within desktop nav layout */
    padding: 1rem;
    z-index: 1;
  }
  .chat-column {
    border: 1px solid var(--border-light);
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  }
  .input-area {
    padding-bottom: 1rem; /* Reset mobile safe area */
  }
}
</style>
