<script setup>
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

onMounted(async () => {
  try {
    const res = await axios.get('https://localhost:5000/api/auth/me', {
      headers: { 'x-auth-token': authStore.token }
    })
    username.value = res.data.username
    email.value = res.data.email
  } catch (error) {
    statusMsg.value = "Failed to load profile data."
    isError.value = true
  } finally {
    fetching.value = false
  }
})

const updateProfile = async () => {
  loading.value = true
  statusMsg.value = ''
  isError.value = false

  try {
    const res = await axios.put('https://localhost:5000/api/auth/me', {
      username: username.value,
      email: email.value,
      password: password.value // Will be empty string if untouched
    }, {
      headers: { 'x-auth-token': authStore.token }
    })

    // Update the local pinia store and local storage so the navbar updates instantly
    authStore.updateUser({
      username: res.data.username,
      email: res.data.email
    })

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
          <button type="submit" class="btn" :disabled="loading">
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
  border-bottom: 2px solid var(--bg-color);
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
.help-text {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.status-msg {
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: #dcfce7;
  color: #166534;
  font-weight: 500;
  text-align: center;
  margin: 0;
}
.status-msg.error {
  background-color: #fee2e2;
  color: #991b1b;
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

