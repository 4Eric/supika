<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const isLoginMode = ref(true)
const email = ref('')
const password = ref('')
const username = ref('')
const errorMsg = ref('')
const loading = ref(false)

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  errorMsg.value = ''
}

const handleSubmit = async () => {
  errorMsg.value = ''
  loading.value = true

  try {
    let success
    if (isLoginMode.value) {
      success = await authStore.login(email.value, password.value)
      if (!success) {
        errorMsg.value = 'Invalid email or password.'
      }
    } else {
      if (!username.value.trim()) {
        errorMsg.value = 'Username is required.'
        loading.value = false
        return
      }
      success = await authStore.register(username.value, email.value, password.value)
    }

    if (success) {
      router.push('/')
    }
  } catch (err) {
    errorMsg.value = err.message || 'An unexpected error occurred.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-logo">Supika</h1>
        <p class="auth-subtitle">{{ isLoginMode ? 'Welcome back! Sign in to continue.' : 'Create your account and start vibing.' }}</p>
      </div>

      <!-- Tabs -->
      <div class="auth-tabs">
        <button class="tab" :class="{ active: isLoginMode }" @click="isLoginMode = true; errorMsg = ''">Login</button>
        <button class="tab" :class="{ active: !isLoginMode }" @click="isLoginMode = false; errorMsg = ''">Register</button>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- Username (Register only) -->
        <div v-if="!isLoginMode" class="form-group">
          <label for="username">Username</label>
          <input id="username" v-model="username" type="text" placeholder="Choose a username" required />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" required />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" placeholder="••••••••" required />
          <div v-if="isLoginMode" class="forgot-link-container">
            <router-link to="/forgot-password" class="forgot-link">Forgot password?</router-link>
          </div>
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Please wait...' : (isLoginMode ? 'Sign In' : 'Create Account') }}
        </button>
      </form>

      <p class="toggle-text">
        {{ isLoginMode ? "Don't have an account?" : 'Already have an account?' }}
        <a href="#" @click.prevent="toggleMode" class="toggle-link">
          {{ isLoginMode ? 'Register' : 'Sign In' }}
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 2rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 1.5rem;
  padding: 2.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-logo {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary-color);
  letter-spacing: -0.5px;
  text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
  margin-bottom: 0.5rem;
}

.auth-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
}

/* Tabs */
.auth-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  padding: 0.25rem;
  margin-bottom: 2rem;
  border: 1px solid var(--border-light);
}

.tab {
  flex: 1;
  padding: 0.7rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.25s ease;
  font-family: inherit;
}

.tab.active {
  background: var(--primary-color);
  color: white;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
}

.tab:hover:not(.active) {
  color: white;
  background: rgba(255, 255, 255, 0.05);
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.3px;
}

.form-group input {
  width: 100%;
  padding: 0.8rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  color: var(--text-main);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.25s ease;
  box-sizing: border-box;
}

.form-group input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.form-group input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
  background: rgba(255, 255, 255, 0.08);
}

/* Error */
.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  text-align: center;
  padding: 0.6rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 0.5rem;
  margin: 0;
}

/* Submit */
.submit-btn {
  width: 100%;
  padding: 0.85rem;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.forgot-link-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.forgot-link {
  font-size: 0.8rem;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.forgot-link:hover {
  text-decoration: underline;
}

/* Toggle */
.toggle-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 1.5rem;
}

.toggle-link {
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.toggle-link:hover {
  color: var(--secondary-color);
  text-decoration: underline;
}

/* Mobile */
@media (max-width: 768px) {
  .auth-page {
    align-items: flex-start;
    justify-content: flex-end;
    padding: 1.5rem 1rem;
    min-height: 100svh;
  }

  .auth-card {
    padding: 2rem 1.25rem;
    border-radius: 1.25rem;
  }

  .auth-logo {
    font-size: 1.8rem;
  }

  /* Bigger tap targets for tabs */
  .tab {
    padding: 0.85rem 0.5rem;
    font-size: 1rem;
    min-height: 44px;
  }

  /* Bigger inputs with 16px font to prevent iOS zoom */
  .form-group input {
    padding: 1rem 1rem;
    font-size: 1rem;
    min-height: 48px;
  }

  .form-group label {
    font-size: 0.9rem;
  }

  /* Bigger submit button */
  .submit-btn {
    padding: 1rem;
    font-size: 1.05rem;
    min-height: 52px;
  }

  /* More room for toggle link */
  .toggle-text {
    font-size: 1rem;
    margin-top: 1.25rem;
  }

  .toggle-link {
    font-size: 1rem;
    padding: 0.25rem 0;
    display: inline-block;
  }
}
</style>
