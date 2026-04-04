<script setup>
import { ref, onMounted, computed, defineProps } from 'vue'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { useAuthStore } from '@/stores/auth'
import { getImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  eventId: { type: Number, required: true },
  organizerId: { type: Number, required: true },
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const comments = ref([])
const loading = ref(true)
const newComment = ref('')
const error = ref('')

const replyingTo = ref(null) // ID of comment being replied to
const replyingToUser = ref('') // Username of person being replied to

// Flattened state to track which comments have their replies expanded
const expandedReplies = ref({})

const fetchComments = async () => {
  try {
    const headers = authStore.token ? { 'x-auth-token': authStore.token } : {}
    const res = await axios.get(`${API_URL}/api/events/${props.eventId}/comments`, { headers })
    comments.value = res.data
  } catch (err) {
    console.error('Failed to load comments', err)
    error.value = 'Failed to load comments.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (props.isOpen) {
    fetchComments()
  }
})

// Watch for modal open to fetch if not yet loaded
import { watch } from 'vue'
watch(() => props.isOpen, (newVal) => {
  if (newVal && comments.value.length === 0) {
    fetchComments()
  }
})

const postComment = async () => {
  if (!newComment.value.trim() || !authStore.isAuthenticated) return
  
  const content = newComment.value.trim()
  const parentId = replyingTo.value

  const previousComment = newComment.value
  newComment.value = ''
  
  try {
    const res = await axios.post(`${API_URL}/api/events/${props.eventId}/comments`, {
      content,
      parentId
    }, {
      headers: { 'x-auth-token': authStore.token }
    })
    
    // Optimistic UI updates
    if (parentId) {
      // Find parent and append
      const parent = comments.value.find(c => c.id === parentId)
      if (parent) {
        parent.replies.push(res.data)
        expandedReplies.value[parentId] = true // auto expand on reply
      }
    } else {
      comments.value.push(res.data)
    }
    
    cancelReply()
  } catch (err) {
    newComment.value = previousComment // Revert optimistic clear
    error.value = 'Failed to post comment.'
  }
}

const toggleLike = async (comment) => {
  if (!authStore.isAuthenticated) return
  
  const wasLiked = comment.isLikedByMe
  comment.isLikedByMe = !wasLiked
  comment.likesCount += wasLiked ? -1 : 1
  
  try {
    await axios.post(`${API_URL}/api/events/${props.eventId}/comments/${comment.id}/like`, {}, {
      headers: { 'x-auth-token': authStore.token }
    })
  } catch (err) {
    // Revert optimistic
    comment.isLikedByMe = wasLiked
    comment.likesCount += wasLiked ? 1 : -1
  }
}

const startReply = (commentId, username) => {
  replyingTo.value = commentId
  replyingToUser.value = username
}

const cancelReply = () => {
  replyingTo.value = null
  replyingToUser.value = ''
}

const toggleReplies = (commentId) => {
  expandedReplies.value[commentId] = !expandedReplies.value[commentId]
}

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
</script>

<template>
  <div class="bottom-sheet-overlay" v-if="isOpen" @click.self="emit('close')">
    <div class="bottom-sheet glass-panel" :class="{ 'open': isOpen }">
      <div class="sheet-header">
        <div class="drag-handle"></div>
        <h3>Comments</h3>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="comments-scroll-area">
        <div v-if="loading" class="loading-state">Loading comments...</div>
        <div v-else-if="comments.length === 0" class="empty-state">
          No comments yet. Be the first to start the vibe!
        </div>
        
        <div v-else class="comment-list">
          <!-- Top Level Comment -->
          <div v-for="comment in comments" :key="comment.id" class="comment-thread">
            
            <div class="comment-item">
              <div class="comment-avatar">
                <img v-if="comment.avatarUrl" :src="getImageUrl(comment.avatarUrl)" :alt="comment.username" />
                <div v-else class="avatar-placeholder">{{ comment.username.charAt(0).toUpperCase() }}</div>
              </div>
              <div class="comment-body">
                <div class="comment-user">
                  <span class="username">{{ comment.username }}</span>
                  <span v-if="comment.userId === organizerId" class="host-badge">Host</span>
                  <span class="time">{{ timeAgo(comment.createdAt) }}</span>
                </div>
                <div class="comment-content">{{ comment.content }}</div>
                <div class="comment-actions">
                  <button class="reply-btn" @click="startReply(comment.id, comment.username)">Reply</button>
                </div>
              </div>
              <div class="comment-like-col">
                <button class="like-btn" :class="{ active: comment.isLikedByMe }" @click="toggleLike(comment)">
                  <span class="heart-icon">♥</span>
                </button>
                <span class="like-count">{{ comment.likesCount }}</span>
              </div>
            </div>

            <!-- Threaded Replies -->
            <div class="replies-container" v-if="comment.replies && comment.replies.length > 0">
              <button v-if="!expandedReplies[comment.id]" class="view-replies-btn" @click="toggleReplies(comment.id)">
                View replies ({{ comment.replies.length }}) ▾
              </button>
              
              <div class="replies-list" v-else>
                <div v-for="reply in comment.replies" :key="reply.id" class="comment-item reply-item">
                  <div class="comment-avatar small">
                    <img v-if="reply.avatarUrl" :src="getImageUrl(reply.avatarUrl)" :alt="reply.username" />
                    <div v-else class="avatar-placeholder">{{ reply.username.charAt(0).toUpperCase() }}</div>
                  </div>
                  <div class="comment-body">
                    <div class="comment-user">
                      <span class="username">{{ reply.username }}</span>
                      <span v-if="reply.userId === organizerId" class="host-badge">Host</span>
                      <span class="time">{{ timeAgo(reply.createdAt) }}</span>
                    </div>
                    <div class="comment-content">{{ reply.content }}</div>
                    <div class="comment-actions">
                      <button class="reply-btn" @click="startReply(comment.id, reply.username)">Reply</button>
                    </div>
                  </div>
                  <div class="comment-like-col">
                    <button class="like-btn" :class="{ active: reply.isLikedByMe }" @click="toggleLike(reply)">
                      <span class="heart-icon">♥</span>
                    </button>
                    <span class="like-count">{{ reply.likesCount }}</span>
                  </div>
                </div>
                <button class="view-replies-btn hide-replies" @click="toggleReplies(comment.id)">
                  Hide replies ▴
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="comment-input-area">
        <div v-if="error" class="error-msg">{{ error }}</div>
        
        <div v-if="replyingTo" class="replying-banner">
          Replying to <strong>{{ replyingToUser }}</strong>
          <button class="cancel-reply-btn" @click="cancelReply">&times;</button>
        </div>

        <div v-if="authStore.isAuthenticated" class="input-form">
          <input 
            v-model="newComment" 
            type="text" 
            placeholder="Add a comment..."
            @keyup.enter="postComment"
            class="comment-input"
          />
          <button class="send-btn" @click="postComment" :disabled="!newComment.trim()">
            ↑
          </button>
        </div>
        <div v-else class="login-prompt">
          <router-link to="/login">Log in to vibe and comment</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bottom-sheet {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px 24px 0 0;
  border-top: 1px solid var(--border-light);
  height: 85vh; /* TikTok style deep sheet */
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
}

@media (min-width: 768px) {
  .bottom-sheet {
    width: 450px;
    height: 100vh;
    border-radius: 20px 0 0 20px;
    border-left: 1px solid var(--border-light);
    border-top: none;
    position: absolute;
    right: 0;
    top: 0;
    animation: slideLeft 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes slideLeft {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.sheet-header {
  padding: 1rem 1.5rem;
  text-align: center;
  border-bottom: 1px solid var(--border-light);
  position: relative;
  flex-shrink: 0;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  margin: 0 auto 0.75rem auto;
}

@media (min-width: 768px) {
  .drag-handle { display: none; }
}

.sheet-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.comments-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  scrollbar-width: none; /* Firefox */
}
.comments-scroll-area::-webkit-scrollbar { display: none; }

.loading-state, .empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 0;
  font-size: 0.95rem;
}

/* Comment Item */
.comment-thread {
  margin-bottom: 1.2rem;
}

.comment-item {
  display: flex;
  gap: 12px;
  margin-bottom: 0.5rem;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.comment-avatar.small {
  width: 24px;
  height: 24px;
}

.comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { font-weight: 700; font-size: 0.9rem; color: #fff; }

.comment-body {
  flex: 1;
}

.comment-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.username {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
}

.host-badge {
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.comment-content {
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--text-main);
  margin-bottom: 6px;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  gap: 16px;
}

.reply-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.reply-btn:hover { color: var(--text-main); }

/* Likes */
.comment-like-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
}

.like-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.like-btn.active {
  color: #ef4444;
}
.like-btn:active {
  transform: scale(0.8);
}

.like-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 2px;
}

/* Replies Thread */
.replies-container {
  padding-left: 48px;
  margin-top: -4px;
}

.view-replies-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 0;
  cursor: pointer;
}
.view-replies-btn:hover { color: var(--text-main); }

.replies-list {
  margin-top: 8px;
}

/* Input Area */
.comment-input-area {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  background: var(--bg-color);
  padding-bottom: env(safe-area-inset-bottom, 1rem); /* handles iOS notch */
}

.replying-banner {
  font-size: 0.85rem;
  color: var(--text-main);
  background: var(--input-bg);
  padding: 6px 12px;
  border-radius: 12px 12px 0 0;
  margin: -1rem -1.5rem 1rem -1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed var(--border-light);
}

.cancel-reply-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
}

.input-form {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  border-radius: 30px;
  padding: 4px 6px 4px 16px;
  transition: border-color 0.2s;
}
.input-form:focus-within {
  border-color: var(--primary-color);
}

.comment-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main);
  font-size: 0.95rem;
}

.send-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-prompt {
  text-align: center;
  padding: 0.5rem;
}
.login-prompt a {
  color: var(--primary-color);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
}
</style>
