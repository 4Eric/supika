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
    
    const isNew = messages.value.length !== res.data.length
    messages.value = res.data
    
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
})

const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value) return
  
  sending.value = true
  
  try {
    const res = await axios.post(`${API_URL}/api/messages/group/${eventId}/${timeSlotId}`, {
      content: newMessage.value.trim()
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    messages.value.push(res.data)
    newMessage.value = ''
    scrollToBottom()
    showEmojiPicker.value = false
  } catch (error) {
    errorMsg.value = "Failed to send message."
  } finally {
    sending.value = false
  }
}

const goBack = () => {
  router.push(`/event/${eventId}`)
}

const toggleMembers = () => {
  showMembers.value = !showMembers.value
}
</script>

<template>
  <div class="chat-container">
    <div v-if="loading" class="loading">Loading group chat...</div>
    <div v-else-if="errorMsg" class="card error">{{ errorMsg }}</div>
    <div v-else class="chat-layout">
      
      <div class="chat-card main-chat">
        <div class="chat-header">
          <button @click="goBack" class="btn btn-sm btn-outline">← Event</button>
          <div class="chat-title">
            <h2>{{ event?.title }}</h2>
            <p class="subtitle" v-if="event?.timeSlots">
              Attendees Group Chat • 
              {{ new Date(event.timeSlots.find(s => s.id == timeSlotId)?.startTime).toLocaleString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'}) }} • 
              {{ members.length }} Members
            </p>
          </div>
          <button @click="toggleMembers" class="btn btn-sm btn-members">
            👥 Members
          </button>
        </div>
        
        <div class="messages-area" ref="messagesContainer">
          <div v-if="messages.length === 0" class="empty-chat">
            <p>Welcome to the group! Be the first to say hello.</p>
          </div>
          
          <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message"
            :class="msg.sender_id === authStore.user.id ? 'sent' : 'received'"
          >
            <div class="message-sender" v-if="msg.sender_id !== authStore.user.id">
              {{ msg.sender_name }}
            </div>
            <div class="message-bubble">
              {{ msg.content }}
            </div>
            <div class="message-time">
              {{ new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </div>
          </div>
        </div>
        
        <div class="input-area">
          <div class="emoji-picker-wrapper" v-if="showEmojiPicker">
            <EmojiPicker :native="true" @select="onSelectEmoji" class="emoji-picker" />
          </div>
          
          <form @submit.prevent="sendMessage">
            <button type="button" class="btn btn-icon" @click="showEmojiPicker = !showEmojiPicker">
              😀
            </button>
            <input 
              type="text" 
              v-model="newMessage" 
              placeholder="Message group..." 
              class="form-control"
              :disabled="sending"
              @focus="showEmojiPicker = false"
            />
            <button type="submit" class="btn" :disabled="sending || !newMessage.trim()">Send</button>
          </form>
        </div>
      </div>

      <!-- Members Sidebar -->
      <transition name="slide">
        <div v-if="showMembers" class="members-sidebar glass-card">
          <div class="members-header">
            <h3>Group Members</h3>
            <button @click="showMembers = false" class="btn-close">×</button>
          </div>
          <div class="members-list">
            <div v-for="member in members" :key="member.id" class="member-item">
              <div class="member-avatar">{{ member.username.charAt(0).toUpperCase() }}</div>
              <div class="member-info">
                <span class="member-name">{{ member.username }}</span>
                <span class="member-role" :class="member.group_role.toLowerCase()">
                  {{ member.group_role }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </transition>

    </div>
  </div>
</template>

<style scoped>
.chat-container {
  max-width: 1000px;
  margin: 1.5rem auto;
  padding: 0 1rem;
  height: calc(100vh - 120px);
}
.chat-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
  position: relative;
}
.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  overflow: hidden;
}
.chat-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.chat-title {
  flex: 1;
}
.chat-title h2 {
  font-size: 1.15rem;
  margin: 0;
  color: var(--primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.message {
  max-width: 75%;
  display: flex;
  flex-direction: column;
}
.message.sent {
  align-self: flex-end;
  align-items: flex-end;
}
.message.received {
  align-self: flex-start;
  align-items: flex-start;
}
.message-sender {
  font-size: 0.75rem;
  color: var(--primary-color);
  margin-bottom: 0.25rem;
  font-weight: 500;
}
.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  font-size: 0.95rem;
  line-height: 1.4;
}
.message.sent .message-bubble {
  background: var(--primary-color);
  color: #fff;
  border-bottom-right-radius: 0.25rem;
}
.message.received .message-bubble {
  background: rgba(255,255,255,0.05);
  color: var(--text-main);
  border: 1px solid var(--border-light);
  border-bottom-left-radius: 0.25rem;
}
.message-time {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
.input-area {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  position: relative;
}
.input-area form {
  display: flex;
  gap: 0.75rem;
}
.input-area input {
  flex: 1;
  border-radius: 2rem;
  padding: 0.75rem 1.25rem;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-light);
  color: white;
}
.emoji-picker-wrapper {
  position: absolute;
  bottom: 100%;
  left: 1.5rem;
  margin-bottom: 0.5rem;
  z-index: 100;
}

/* Members Sidebar */
.members-sidebar {
  width: 280px;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.members-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.members-header h3 {
  font-size: 1rem;
  margin: 0;
  color: var(--primary-color);
}
.btn-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}
.members-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
}
.member-item:hover {
  background: rgba(255,255,255,0.05);
}
.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
}
.member-info {
  display: flex;
  flex-direction: column;
}
.member-name {
  font-size: 0.9rem;
  font-weight: 500;
}
.member-role {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 10px;
  width: fit-content;
}
.member-role.organizer {
  background: rgba(var(--primary-rgb, 59, 130, 246), 0.2);
  color: var(--primary-color);
}
.member-role.attendee {
  background: rgba(255,255,255,0.1);
  color: var(--text-muted);
}

.btn-members {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  color: var(--text-main);
}
.btn-members:hover {
  background: rgba(255,255,255,0.1);
}

/* Transitions */
.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 900px) {
  .members-sidebar {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 1000;
    box-shadow: -10px 0 30px rgba(0,0,0,0.5);
  }
}

@media (max-width: 600px) {
  .chat-container {
    height: calc(100dvh - 100px);
    margin: -1rem -0.75rem;
    padding: 0;
  }
  .main-chat {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
  .chat-header {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }
  .chat-title h2 {
    font-size: 0.95rem;
  }
  .subtitle {
    font-size: 0.7rem;
  }
  .btn-outline {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
  }
  .btn-members {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
  }
  .messages-area {
    padding: 0.75rem;
    gap: 0.5rem;
  }
  .input-area {
    padding: 0.5rem 0.75rem;
  }
  .input-area form {
    gap: 0.5rem;
  }
  .input-area input {
    padding: 0.6rem 1rem;
    font-size: 1rem;
    min-height: 44px;
  }
  .message {
    max-width: 85%;
  }
  .message-bubble {
    padding: 0.6rem 0.85rem;
    font-size: 0.9rem;
  }
  .members-sidebar {
    width: 100%;
    border-radius: 0;
  }
}
</style>

