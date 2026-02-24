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

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="my-messages-container">
    <div class="header">
      <h1>My Messages</h1>
      <p>View all your active event conversations.</p>
    </div>

    <div v-if="loading" class="loading">Loading conversations...</div>
    <div v-else-if="errorMsg" class="card error">{{ errorMsg }}</div>
    <div v-else-if="conversations.length === 0" class="card empty-state">
      <h2>No conversations found</h2>
      <p>You don't have any active chats yet. Reach out to an event creator to get started!</p>
      <router-link to="/" class="btn btn-outline" style="margin-top: 1rem; display: inline-block;">Browse Events</router-link>
    </div>
    <div v-else class="conversations-list">
      
      <div 
        v-for="conv in conversations" 
        :key="conv.id" 
        class="card conv-card" 
        :class="{ 'unread-thread': conv.unread_count > 0 }"
        @click="openChat(conv.event_id, conv.other_user_id)"
      >
        <div class="conv-header">
          <div class="conv-users">
            <h3>
              {{ conv.other_user_name }}
              <span v-if="conv.unread_count > 0" class="unread-badge-thread">{{ conv.unread_count }}</span>
            </h3>
            <span class="event-pill">{{ conv.event_title }}</span>
          </div>
          <div class="conv-time">
            {{ formatDate(conv.created_at) }}
          </div>
        </div>
        
        <div class="conv-preview">
          <p class="preview-text">"{{ conv.content.substring(0, 80) }}{{ conv.content.length > 80 ? '...' : '' }}"</p>
          <span class="action-text">Click to open chat →</span>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.my-messages-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.header {
  margin-bottom: 2rem;
}
.header h1 {
  font-size: 2.5rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}
.header p {
  color: var(--text-muted);
  font-size: 1.1rem;
}
.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.conv-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  border-left: 4px solid transparent;
}
.conv-card:hover {
  transform: translateX(4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-left-color: var(--secondary-color);
}
.conv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.conv-users h3 {
  margin: 0 0 0.5rem 0;
  color: var(--primary-color);
  font-size: 1.25rem;
}
.event-pill {
  background: var(--bg-color);
  color: var(--text-main);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--border-light);
}
.conv-time {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.conv-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.preview-text {
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}
.action-text {
  color: var(--secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0;
  transform: translateX(-10px);
  transition: opacity 0.2s, transform 0.2s;
}
.conv-card:hover .action-text {
  opacity: 1;
  transform: translateX(0);
}
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}
.empty-state h2 {
  color: var(--text-main);
  margin-bottom: 0.5rem;
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
  .my-messages-container {
    padding: 1rem;
  }
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .conv-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  .conv-preview {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .empty-state {
    padding: 4rem 1rem;
  }
}

.unread-thread {
  border-left-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.03);
}

.unread-thread .preview-text {
  color: white;
  font-weight: 600;
}

.unread-badge-thread {
  background-color: #ef4444;
  color: white;
  font-size: 0.8rem;
  font-weight: bold;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  margin-left: 0.5rem;
  vertical-align: middle;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
}
</style>

