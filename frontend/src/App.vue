<script setup>
import { API_URL } from '@/config/api'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import axios from 'axios'

// PWA install prompt
const deferredInstallPrompt = ref(null)
const showInstallBanner = ref(false)

const handleInstallPrompt = (e) => {
  e.preventDefault()
  deferredInstallPrompt.value = e
  showInstallBanner.value = true
}

const installApp = async () => {
  if (!deferredInstallPrompt.value) return
  deferredInstallPrompt.value.prompt()
  const { outcome } = await deferredInstallPrompt.value.userChoice
  deferredInstallPrompt.value = null
  showInstallBanner.value = false
}

const dismissInstallBanner = () => {
  showInstallBanner.value = false
  deferredInstallPrompt.value = null
}

const authStore = useAuthStore()
const uiStore = useUiStore()
const themeStore = useThemeStore()
const router = useRouter()
const route = useRoute()

const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Unread Message State
const unreadCount = ref(0)
let pollInterval = null

const fetchUnreadCount = async () => {
  if (!authStore.isAuthenticated) {
    unreadCount.value = 0
    return
  }
  try {
    const res = await axios.get(`${API_URL}/api/messages/unread/count`, {
      headers: { 'x-auth-token': authStore.token }
    })
    unreadCount.value = res.data.count
  } catch (err) {
    // console.warn('Failed to fetch unread count', err)
  }
}

watch(() => authStore.isAuthenticated, (newVal) => {
  if (newVal) fetchUnreadCount()
  else unreadCount.value = 0
})

// Close sidebar on mobile when route changes, and fetch unread count to keep UI aggressive
watch(route, () => {
  if (window.innerWidth <= 768) {
    isSidebarOpen.value = false
  }
  if (authStore.isAuthenticated) fetchUnreadCount()
})

onMounted(() => {
  if (authStore.isAuthenticated) fetchUnreadCount()
  pollInterval = setInterval(() => {
    if (authStore.isAuthenticated) fetchUnreadCount()
  }, 10000)

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', handleInstallPrompt)
  window.addEventListener('appinstalled', () => { showInstallBanner.value = false })
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
})

const logout = () => {
  authStore.logout()
  isSidebarOpen.value = false
  router.push('/login')
}

// Map route names to dashboard titles
const pageTitle = computed(() => {
  if (route.path === '/') return 'Discover'
  if (route.path === '/map') return 'Interactive Map'
  if (route.path === '/my-events') return 'Calendar'
  if (route.path === '/hosted') return 'My Hosted Events'
  if (route.path === '/my-messages') return 'Inbox'
  if (route.path.startsWith('/chat/')) return 'Chat with Organizer'
  if (route.path.startsWith('/group-chat/')) return 'Group Chat'
  if (route.path === '/create') return 'Create Event'
  if (route.path === '/profile') return 'Account Settings'
  if (route.path === '/admin/users') return 'Admin User Management'
  if (route.path === '/admin/ai') return 'eFinder.ai'
  if (route.path.startsWith('/event/') && route.path.endsWith('/edit')) return 'Edit Event'
  if (route.path.startsWith('/event/')) return 'Event Details'
  if (route.path.startsWith('/host/')) return 'Host Profile'
  if (route.path === '/host-landing') return 'Grow Your Tribe'
  return 'Dashboard'
})
</script>

<template>
  <div class="app-container">
    <!-- Floating Glass Navigation (Island) -->
    <nav class="dynamic-island">
      <div class="island-section">
        <router-link to="/" class="logo-link">
          <img src="@/assets/supika-logo-refined.png" alt="Supika" class="logo-img" />
        </router-link>
      </div>

      <div class="island-section links-section">
        <router-link to="/" class="nav-item" title="Discover">
          <span class="icon">🧭</span><span class="label">Discover</span>
        </router-link>
        <router-link to="/map" class="nav-item" title="Map">
          <span class="icon">🗺️</span><span class="label">Map</span>
        </router-link>
        
        <template v-if="authStore.isAuthenticated">
          <router-link to="/my-events" class="nav-item" title="Calendar">
            <span class="icon">📅</span><span class="label">Calendar</span>
          </router-link>
          <router-link to="/hosted" class="nav-item" title="Hosted">
             <span class="icon">🎟️</span><span class="label">Hosted</span>
          </router-link>
          <router-link to="/my-messages" class="nav-item badge-container" title="Messages">
            <span class="icon">💬</span><span class="label">Messages</span>
            <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
          </router-link>
          <router-link to="/host-landing" class="nav-item create-btn" title="Create Event">
             <span class="icon">+</span><span class="label">Create</span>
          </router-link>
        </template>
      </div>

      <div class="island-section controls-section">
        <div class="search-bar-container" v-if="route.path === '/' || route.path === '/map'">
          <span class="search-icon">🔍</span>
          <input type="text" v-model="uiStore.searchQuery" placeholder="Search..." class="global-search" />
        </div>

        <button @click="themeStore.toggleTheme" class="nav-item theme-toggle-btn" title="Toggle Theme">
          <span class="icon">{{ themeStore.activeTheme === 'dark' ? '☀️' : '🌙' }}</span> 
        </button>
        
        <template v-if="authStore.isAuthenticated">
          <div class="user-profile-badge" @click="router.push('/profile')" title="Profile">
            <div class="avatar">{{ authStore.user?.username.charAt(0).toUpperCase() }}</div>
          </div>
          <button @click="logout" class="nav-item logout-btn" title="Logout">
            <span class="icon">🚪</span>
          </button>
        </template>
        <template v-else>
          <router-link to="/login" class="nav-item login-link">
            <span class="icon">👤</span><span class="label">Login</span>
          </router-link>
        </template>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="main-content" :class="{ 'no-padding': route.path === '/map' }">
      <div class="page-header" v-if="route.path !== '/map'">
        <h1 class="page-title">{{ pageTitle }}</h1>
      </div>
      <router-view />
    </main>

    <!-- PWA Install Banner -->
    <Transition name="slide-up">
      <div v-if="showInstallBanner" class="pwa-install-banner">
        <div class="pwa-install-content">
          <span class="pwa-icon">📲</span>
          <div class="pwa-text">
            <strong>Install Supika</strong>
            <span>Add to home screen for the best experience</span>
          </div>
        </div>
        <div class="pwa-actions">
          <button @click="installApp" class="pwa-install-btn">Install</button>
          <button @click="dismissInstallBanner" class="pwa-dismiss-btn">✕</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  position: relative;
  overflow-x: hidden;
}

/* High-End Visual Anchor: Organic Mesh Gradient Drift */
.app-container::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at 20% 30%, var(--primary-color) 0%, transparent 30%),
              radial-gradient(circle at 80% 70%, var(--secondary-color) 0%, transparent 30%);
  opacity: 0.08;
  filter: blur(120px);
  animation: mesh-drift 30s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 0;
}

@keyframes mesh-drift {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  50% { transform: translate(5%, -5%) rotate(3deg) scale(1.05); }
  100% { transform: translate(-5%, 5%) rotate(-3deg) scale(0.95); }
}

/* Ensure content sits above the mesh */
.main-content, .dynamic-island, .pwa-install-banner {
  z-index: 10;
  position: relative;
}

/* Dynamic Island Floating Navigation */
.dynamic-island {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 1rem;
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  box-shadow: var(--card-shadow);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.island-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.links-section {
  border-left: 1px solid var(--border-light);
  border-right: 1px solid var(--border-light);
  padding: 0 1rem;
}

.logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  height: 28px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: screen;
  transition: transform 0.3s;
}

.logo-img:hover {
  transform: scale(1.05);
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
}

.nav-item .icon {
  font-size: 1.2rem;
}

.nav-item .label {
  display: none; /* Hide text by default for compact island */
}

.nav-item:hover {
  background-color: var(--input-focus-bg);
  color: var(--text-main);
  transform: translateY(-2px);
}

.nav-item.router-link-active {
  background-color: var(--selected-bg);
  color: var(--selected-text);
}

.nav-item.router-link-active .icon {
  opacity: 1;
}

.badge-container {
  position: relative;
}

.unread-badge {
  position: absolute;
  top: 0px;
  right: 0px;
  background-color: #ef4444;
  color: white;
  font-size: 0.65rem;
  font-weight: bold;
  padding: 0.1rem 0.4rem;
  border-radius: 1rem;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  transform: translate(25%, -25%);
}

.create-btn {
  background: rgba(56, 189, 248, 0.1);
  color: var(--primary-color);
  border: 1px solid rgba(56, 189, 248, 0.4);
}
.create-btn:hover {
  background: rgba(56, 189, 248, 0.2);
}

.search-bar-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  font-size: 0.9rem;
  opacity: 0.6;
}

.global-search {
  width: 140px;
  padding: 0.5rem 1rem 0.5rem 2.25rem;
  background-color: var(--input-bg);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  border-radius: 999px;
  outline: none;
  font-family: inherit;
  font-size: 0.85rem;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.global-search:focus {
  width: 200px;
  background-color: var(--input-focus-bg);
  border-color: var(--primary-color);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 0 15px rgba(16, 185, 129, 0.2);
}

.user-profile-badge {
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.user-profile-badge:hover {
  transform: scale(1.08);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1rem;
  color: #000;
  box-shadow: inset 0 2px 4px rgba(255,255,255,0.4);
}

/* Main Content Area */
.main-content {
  flex: 1;
  padding: 8rem 2rem 4rem 2rem; /* Give room for the island */
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.main-content.no-padding {
  padding: 0;
  max-width: 100%;
}

.page-header {
  margin-bottom: 3rem;
  text-align: left;
}

.page-title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--text-main);
  margin: 0;
  line-height: 1;
}

/* PWA Install Banner */
.pwa-install-banner {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 480px;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  z-index: 9999;
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
}
.pwa-install-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}
.pwa-icon { font-size: 1.8rem; flex-shrink: 0; }
.pwa-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.pwa-text strong { color: var(--text-main); font-size: 0.95rem; }
.pwa-text span { color: var(--text-muted); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pwa-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.pwa-install-btn {
  background: var(--primary-color);
  color: var(--btn-text-on-primary);
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
}
.pwa-dismiss-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateX(-50%) translateY(120%); opacity: 0; }

/* Mobile Reponsiveness: Move island to bottom dock */
@media (max-width: 900px) {
  .dynamic-island {
    top: auto;
    bottom: 1.5rem;
    padding: 0.75rem;
    width: 90%;
    max-width: 400px;
    justify-content: space-around;
    gap: 0.5rem;
  }
  
  .island-section {
    gap: 0.25rem;
  }
  
  .links-section {
    border: none;
    padding: 0;
  }
  
  .search-bar-container, .logo-link, .theme-toggle-btn {
    display: none; /* Hide extra controls on mobile dock to save space */
  }

  .main-content {
    padding: 3rem 1.5rem 8rem 1.5rem; /* Room for bottom dock */
  }
  
  .page-header {
    margin-bottom: 2rem;
  }
}

[data-theme="notion"] .logo-img,
[data-theme="notion"] .logo-img-mobile {
  filter: invert(1);
  mix-blend-mode: normal;
}
</style>
