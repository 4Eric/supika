<script setup>
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
const otherUserId = route.params.otherUserId

const event = ref(null)
const messages = ref([])
const newMessage = ref('')
const loading = ref(true)
const sending = ref(false)
const errorMsg = ref('')
const showEmojiPicker = ref(false)

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
    const res = await axios.get(`https://localhost:5000/api/messages/${otherUserId}`, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    // Auto-scroll only if we get new messages
    const isNew = messages.value.length !== res.data.length
    messages.value = res.data
    
    if (isNew) scrollToBottom()
  } catch (error) {
    console.error("Failed to fetch messages:", error)
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  try {
    // Fetch basic event context
    const eventRes = await axios.get(`https://localhost:5000/api/events/${eventId}`)
    event.value = eventRes.data
    
    await fetchMessages()
    
    // Poll for new messages every 3 seconds
    pollInterval = setInterval(fetchMessages, 3000)
    
  } catch (error) {
    errorMsg.value = "Failed to load chat."
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
    const res = await axios.post(`https://localhost:5000/api/messages`, {
      receiver_id: otherUserId,
      event_id: eventId,
      content: newMessage.value.trim()
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    messages.value.push(res.data)
    newMessage.value = ''
    scrollToBottom()
  } catch (error) {
    errorMsg.value = "Failed to send message."
  } finally {
    sending.value = false
  }
}

const goBack = () => {
  router.push(`/event/${eventId}`)
}
</script>

<template>
  <div class="chat-container">
    <div v-if="loading" class="loading">Loading chat...</div>
    <div v-else-if="errorMsg" class="card error">{{ errorMsg }}</div>
    <div v-else class="chat-card">
      
      <div class="chat-header">
        <button @click="goBack" class="btn btn-sm btn-outline">← Back to Event</button>
        <div class="chat-title">
          <h2>{{ event?.title }}</h2>
          <p class="subtitle">Creator Chat</p>
        </div>
      </div>
      
      <div class="messages-area" ref="messagesContainer">
        <div v-if="messages.length === 0" class="empty-chat">
          <p>No messages yet. Send the first message!</p>
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
            placeholder="Type a message..." 
            class="form-control"
            :disabled="sending"
            @focus="showEmojiPicker = false"
          />
          <button type="submit" class="btn" :disabled="sending || !newMessage.trim()">Send</button>
        </form>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
  height: calc(100vh - 130px);
}
.chat-card {
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-light);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.chat-header {
  padding: 1rem 1.5rem;
  background: transparent;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.chat-title h2 {
  font-size: 1.25rem;
  margin: 0;
  color: var(--primary-color);
}
.subtitle {
  font-size: 0.85rem;
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
  background: transparent;
}
.empty-chat {
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 2rem;
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
  color: var(--text-muted);
  margin-bottom: 0.25rem;
  margin-left: 0.5rem;
}
.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  font-size: 0.95rem;
  line-height: 1.4;
  word-wrap: break-word;
}
.message.sent .message-bubble {
  background: var(--primary-color);
  color: #fff;
  border-bottom-right-radius: 0.25rem;
}
.message.received .message-bubble {
  background: var(--bg-color);
  color: var(--text-main);
  border: 1px solid var(--border-light);
  border-bottom-left-radius: 0.25rem;
}
.message-time {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
.input-area {
  padding: 1rem 1.5rem;
  background: transparent;
  border-top: 1px solid var(--border-light);
  position: relative;
}
.emoji-picker-wrapper {
  position: absolute;
  bottom: 100%;
  left: 1.5rem;
  margin-bottom: 0.5rem;
  z-index: 50;
}
.input-area form {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.btn-icon {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}
.btn-icon:hover {
  transform: scale(1.1);
}
.input-area input {
  flex: 1;
  border-radius: 2rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-color);
  color: var(--text-main);
  border: 1px solid var(--border-light);
}
.btn-outline {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}
.btn-outline:hover {
  background: var(--primary-color);
  color: white;
}

@media (max-width: 768px) {
  .chat-container {
    height: calc(100dvh - 160px); 
    margin: -1.5rem -1rem; /* Break out of .main-content padding */
    padding: 0;
    max-width: 100vw;
  }
  .chat-card {
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }
  .chat-header {
    padding: 1rem;
  }
  .input-area {
    padding: 1rem;
  }
  .input-area form {
    gap: 0.5rem;
  }
  .message {
    max-width: 90%;
  }
}
</style>

