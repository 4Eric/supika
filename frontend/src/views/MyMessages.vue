<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const conversations = ref([])
const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  try {
    const res = await axios.get(`${API_URL}/api/messages/conversations/me`, {
      headers: { 'x-auth-token': authStore.token }
    })
    conversations.value = res.data
  } catch (error) {
    console.error("Failed to load conversations:", error)
    errorMsg.value = "Failed to load your conversations."
  } finally {
    loading.value = false
  }
})

const openChat = (eventId, otherUserId) => {
  router.push(`/chat/${eventId}/${otherUserId}`)
}

// Relative time formatter for a premium mobile feel (e.g., "5m", "2h", "Yesterday")
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d`
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="messages-page">
    <div class="page-header">
      <h1>Messages</h1>
    </div>

    <div v-if="loading" class="state-container">
      <div class="spinner"></div>
      <p>Loading chats...</p>
    </div>
    
    <div v-else-if="errorMsg" class="state-container error">
      <p>{{ errorMsg }}</p>
    </div>
    
    <div v-else-if="conversations.length === 0" class="state-container empty">
      <div class="empty-icon">💬</div>
      <h2>No messages yet</h2>
      <p>Join an event and start chatting with the community!</p>
      <button @click="router.push('/')" class="btn btn-primary mt-4">Discover Events</button>
    </div>

    <div v-else class="chat-list">
      <div 
        v-for="conv in conversations" 
        :key="conv.id" 
        class="chat-row" 
        :class="{ 'is-unread': conv.unread_count > 0 }"
        @click="openChat(conv.event_id, conv.other_user_id)"
      >
        <!-- Avatar -->
        <div class="avatar-container">
          <div class="avatar" :class="{ 'gradient-bg': !conv.user_image }">
            {{ conv.other_user_name.charAt(0).toUpperCase() }}
          </div>
          <div v-if="conv.unread_count > 0" class="unread-dot"></div>
        </div>

        <!-- Content -->
        <div class="chat-content">
          <div class="chat-header">
            <span class="chat-name">{{ conv.other_user_name }}</span>
            <span class="chat-time" :class="{ 'time-unread': conv.unread_count > 0 }">
              {{ formatRelativeTime(conv.created_at) }}
            </span>
          </div>
          
          <div class="chat-body">
            <p class="chat-preview">
              <span v-if="conv.sender_id === authStore.user.id">You: </span>
              {{ conv.content }}
            </p>
            <div class="chat-event-pill">
              {{ conv.event_title }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mobile-First Layout */
.messages-page {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 60px); /* Adjust based on navbar height */
  background: var(--bg-color); /* Matches app background */
}

.page-header {
  padding: 1.5rem 1.25rem 0.5rem;
  position: sticky;
  top: 0;
  background: rgba(9, 9, 11, 0.85); /* Dark frosted glass */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 10;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
  letter-spacing: -0.5px;
}

/* States */
.state-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  opacity: 0.8;
}

.state-container h2 {
  color: var(--text-main);
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

/* Chat List (Edge-to-Edge on Mobile) */
.chat-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 2rem; /* Safe area bottom */
}

.chat-row {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  gap: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.chat-row:active {
  background-color: rgba(255,255,255,0.05);
}

/* Desktop Hover */
@media (hover: hover) {
  .chat-row:hover {
    background-color: rgba(255,255,255,0.03);
  }
}

/* Separator Line (iOS Style) */
.chat-row:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  left: 4.5rem; /* Align line with content, skipping avatar */
  height: 1px;
  background-color: rgba(255,255,255,0.05);
}

/* Avatar */
.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  background-color: var(--surface-color);
}

.gradient-bg {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

.unread-dot {
  position: absolute;
  top: 0px;
  right: 0px;
  width: 14px;
  height: 14px;
  background-color: var(--primary-color);
  border: 2px solid var(--bg-color); /* Match background to punch out a border */
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

/* Chat Content */
.chat-content {
  flex: 1;
  min-width: 0; /* Important for text truncation */
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.chat-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 0.8rem;
  color: var(--text-muted);
  flex-shrink: 0;
  font-weight: 500;
}

.time-unread {
  color: var(--primary-color);
}

.chat-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.chat-preview {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.is-unread .chat-preview {
  color: var(--text-main);
  font-weight: 500;
}

.chat-event-pill {
  font-size: 0.65rem;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  background: rgba(255,255,255,0.08);
  color: var(--text-muted);
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

/* Desktop Enhancements */
@media (min-width: 768px) {
  .messages-page {
    margin: 2rem auto;
    border-radius: 1rem;
    border: 1px solid var(--border-light);
    background: var(--card-bg);
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }
  
  .page-header {
    background: rgba(30, 41, 59, 0.6); /* Slightly lighter on desktop card */
  }
  
  .chat-row:not(:last-child)::after {
    left: 1.25rem; /* Full width line on desktop card */
  }
}
</style>
