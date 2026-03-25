<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const fetching = ref(true)
const statusMsg = ref('')
const isError = ref(false)
const avatarFile = ref(null)
const avatarPreview = ref(null)
const currentAvatarUrl = ref(null)
const selectedPresetUrl = ref(null)

const presetAvatars = [
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Aneka&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Mimi&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Garfield&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Buster&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/miniavs/svg?seed=Whiskers&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/miniavs/svg?seed=Mittens&backgroundColor=ffd5dc',
  // Asian-inspired cute avatars
  'https://api.dicebear.com/7.x/notionists/svg?seed=Mei&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/croodles/svg?seed=Kenji&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Yuki&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jin&backgroundColor=d1d4f9',
  // More male avatars
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Ryu&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/micah/svg?seed=Hiro&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Akira&backgroundColor=c0aede',
  // Even more male avatars
  'https://api.dicebear.com/7.x/micah/svg?seed=Jack&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Liam&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Ethan&backgroundColor=ffdfbf'
]

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { 'x-auth-token': authStore.token }
    })
    username.value = res.data.username
    email.value = res.data.email
    currentAvatarUrl.value = res.data.avatarUrl
  } catch (error) {
    statusMsg.value = "Failed to load profile data."
    isError.value = true
  } finally {
    fetching.value = false
  }
})

const selectPreset = (url) => {
  selectedPresetUrl.value = url
  avatarFile.value = null
  avatarPreview.value = url
}

const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      statusMsg.value = 'Avatar is too large (max 2MB).'
      isError.value = true
      return
    }
    avatarFile.value = file
    const reader = new FileReader()
    reader.onload = (event) => { avatarPreview.value = event.target.result }
    reader.readAsDataURL(file)
    selectedPresetUrl.value = null
  }
}

const getAvatarUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_URL}/uploads/${url}`
}

const updateProfile = async () => {
  loading.value = true
  statusMsg.value = ''
  isError.value = false

  try {
    const updatedUser = await authStore.updateProfile({
      username: username.value,
      email: email.value,
      password: password.value
    }, avatarFile.value, selectedPresetUrl.value)

    currentAvatarUrl.value = updatedUser.avatarUrl
    avatarFile.value = null
    avatarPreview.value = null
    selectedPresetUrl.value = null
    statusMsg.value = "Profile updated successfully!"
    password.value = '' // Clear password field after successful update
  } catch (error) {
    statusMsg.value = error.response?.data?.message || "Failed to update profile."
    isError.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="profile-container">
    <div class="card profile-card">
      <div class="header">
        <h1>My Profile</h1>
        <p>Update your account details and credentials</p>
      </div>

      <div v-if="fetching" class="loading">Loading profile info...</div>
      
      <form v-else @submit.prevent="updateProfile" class="profile-form">
        
        <div class="avatar-section">
          <label for="avatar-input" class="avatar-edit-box">
            <img v-if="avatarPreview" :src="avatarPreview" class="avatar-img" />
            <img v-else-if="currentAvatarUrl" :src="getAvatarUrl(currentAvatarUrl)" class="avatar-img" />
            <div v-else class="avatar-placeholder">{{ username.charAt(0).toUpperCase() }}</div>
            <div class="edit-overlay">Change Photo</div>
          </label>
          <input id="avatar-input" type="file" @change="handleFileChange" accept="image/*" class="hidden-input" />
          
          <!-- Presets -->
          <div class="preset-avatars">
            <p class="preset-tip">Or choose a preset vibe:</p>
            <div class="preset-options">
              <img 
                v-for="(url, idx) in presetAvatars" 
                :key="'preset-'+idx"
                :src="url" 
                class="preset-item" 
                :class="{ active: selectedPresetUrl === url }"
                @click="selectPreset(url)"
                alt="preset avatar"
              />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="username">Username</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            class="form-control" 
            required 
            placeholder="Your Username"
          />
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
            class="form-control" 
            required 
            placeholder="you@example.com"
          />
        </div>

        <div class="form-group">
          <label for="password">New Password</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            class="form-control" 
            placeholder="Leave blank to keep current password"
          />
          <small class="help-text">Only fill this out if you want to change your password.</small>
        </div>

        <p v-if="statusMsg" :class="['status-msg', { 'error': isError }]">{{ statusMsg }}</p>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
        
      </form>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  max-width: 600px;
  margin: 4rem auto;
  padding: 0 1rem;
}
.profile-card {
  padding: 2.5rem;
}
.header {
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 1.5rem;
}
.header h1 {
  font-size: 2rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}
.header p {
  color: var(--text-muted);
  font-size: 1rem;
  margin: 0;
}
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Avatar Styles */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
}

.preset-avatars {
  margin-top: 1.5rem;
  text-align: center;
}
.preset-tip {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}
.preset-options {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.preset-item {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  background: var(--input-bg);
}
.preset-item:hover {
  transform: scale(1.1);
  border-color: var(--border-light);
}
.preset-item.active {
  border-color: var(--primary-color);
  transform: scale(1.15);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
}

.avatar-edit-box {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background: var(--input-bg);
  border: 3px solid var(--primary-color);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
  font-weight: 800;
}

.edit-overlay {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 0.75rem;
  padding: 4px 0;
  text-align: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-edit-box:hover .edit-overlay {
  opacity: 1;
}

.hidden-input {
  display: none;
}

.help-text {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.status-msg {
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: rgba(52, 211, 153, 0.1);
  color: #34d399;
  font-weight: 500;
  text-align: center;
  margin: 0;
  border: 1px solid rgba(52, 211, 153, 0.3);
}
.status-msg.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}
.form-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding-left: 2rem;
  padding-right: 2rem;
}

@media (max-width: 768px) {
  .profile-container {
    margin: 2rem auto;
  }
  .profile-card {
    padding: 1.5rem;
  }
  .header h1 {
    font-size: 1.5rem;
  }
  .form-actions {
    justify-content: stretch;
  }
  .btn {
    width: 100%;
  }
}
</style>
