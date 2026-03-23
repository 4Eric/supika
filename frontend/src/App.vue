<script setup>
import { API_URL } from '@/config/api'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import axios from 'axios'

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
  // Poll every 10 seconds silently to keep UI live 
  pollInterval = setInterval(() => {
    if (authStore.isAuthenticated) fetchUnreadCount()
  }, 10000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
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
    <!-- Mobile Header -->
    <header class="mobile-header">
      <router-link to="/" class="mobile-logo"><img src="@/assets/supika-logo-refined.png" alt="Supika" class="logo-img-mobile" /></router-link>
      <h2 class="mobile-page-title">{{ pageTitle }}</h2>
      <button class="hamburger-btn" @click="toggleSidebar">
        ☰
      </button>
    </header>

    <!-- Sidebar Overlay -->
    <div class="sidebar-overlay" :class="{ 'active': isSidebarOpen }" @click="isSidebarOpen = false"></div>

    <aside class="sidebar" :class="{ 'active': isSidebarOpen }">
      <div class="logo">
        <router-link to="/"><img src="@/assets/supika-logo-refined.png" alt="Supika" class="logo-img" /></router-link>
      </div>
      
      <nav class="nav-links">
        <p class="nav-section-title">MENU</p>
        <router-link to="/" class="nav-item">
          <span class="icon">🧭</span> Discover
        </router-link>
        <router-link to="/map" class="nav-item">
          <span class="icon">🗺️</span> Explore Map
        </router-link>
        
        <template v-if="authStore.isAuthenticated">
          <router-link to="/my-events" class="nav-item">
            <span class="icon">📅</span> Calendar
          </router-link>
          <router-link to="/hosted" class="nav-item">
             <span class="icon">🎟️</span> Hosted Events
          </router-link>
          <router-link to="/my-messages" class="nav-item">
            <span class="icon">💬</span> Messages
            <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
          </router-link>
          <router-link to="/profile" class="nav-item">
            <span class="icon">⚙️</span> Settings
          </router-link>
          
          <router-link v-if="authStore.user?.role === 'admin'" to="/admin/users" class="nav-item">
            <span class="icon">🛡️</span> Admin Panel
          </router-link>
          <router-link v-if="authStore.user?.role === 'admin'" to="/admin/ai" class="nav-item">
            <span class="icon">🤖</span> eFinder.ai
          </router-link>
        </template>
      </nav>

      <div class="sidebar-footer">
        <button @click="themeStore.toggleTheme" class="nav-item theme-toggle-btn" style="width: 100%; border: none; background: transparent; text-align: left; cursor: pointer;">
          <span class="icon">{{ themeStore.activeTheme === 'dark' ? '☀️' : '🌙' }}</span> 
          Toggle Theme
        </button>
        <template v-if="authStore.isAuthenticated">
          <button @click="logout" class="btn-logout">Logout</button>
        </template>
        <template v-else>
          <router-link to="/login" class="nav-item login-link">Login / Register</router-link>
        </template>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="dashboard-header">
        <h2 class="page-title">{{ pageTitle }}</h2>
        
        <div class="header-controls">
          <div class="search-bar-container" v-if="route.path === '/' || route.path === '/map'">
            <span class="search-icon">🔍</span>
            <input type="text" v-model="uiStore.searchQuery" placeholder="Search events..." class="global-search" />
          </div>
          
          <template v-if="authStore.isAuthenticated">
            <button @click="themeStore.toggleTheme" class="btn btn-icon theme-header-btn" title="Toggle Theme" style="padding: 0.5rem; border: none; font-size: 1.2rem; cursor: pointer; background: transparent;">
               {{ themeStore.activeTheme === 'dark' ? '☀️' : '🌙' }}
            </button>
            <router-link to="/host-landing" class="btn btn-create">+ Create Event</router-link>
            <div class="user-profile-badge" @click="router.push('/profile')">
              <div class="avatar">{{ authStore.user?.username.charAt(0).toUpperCase() }}</div>
            </div>
          </template>
        </div>
      </header>

      <main class="main-content" :class="{ 'no-padding': route.path === '/map' }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  overflow: hidden;
  background-color: var(--bg-color);
}

/* Sidebar */
.sidebar {
  width: 250px;
  background-color: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  padding: 2rem 1.5rem;
  z-index: 100;
  overflow-y: hidden;
}

.logo {
  margin-bottom: 2.5rem;
  text-align: center;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo a {
  text-decoration: none;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.logo-img {
  width: 100%;
  max-width: 140px;
  height: auto;
  object-fit: contain;
  mix-blend-mode: screen;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.logo-img:hover {
  transform: scale(1.03);
  opacity: 0.9;
}

.nav-section-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 1rem;
  padding-left: 1rem;
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.nav-links::-webkit-scrollbar {
  width: 4px;
}
.nav-links::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-item .icon {
  font-size: 1.2rem;
  opacity: 0.8;
}

.nav-item:hover {
  background-color: var(--border-light);
  color: var(--text-main);
}

.nav-item.router-link-active {
  background-color: rgba(56, 189, 248, 0.15);
  color: var(--primary-color);
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.1) inset;
  transition: none;
}

.nav-item.router-link-active .icon {
  opacity: 1;
}

/* Sidebar Footer */
.sidebar-footer {
  margin-top: auto;
  border-top: 1px solid var(--border-light);
  padding-top: 1.5rem;
}

.btn-logout {
  width: 100%;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-muted);
  padding: 0.85rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  min-height: 48px;
}

.btn-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.login-link {
  justify-content: center;
  border: 1px solid var(--border-light);
}

/* Main Dashboard Area */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Top Dashboard Header */
.dashboard-header {
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 3rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  z-index: 50;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

/* Global Search Bar Placeholder */
.search-bar-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 0.9rem;
  opacity: 0.6;
}

.global-search {
  width: 250px;
  padding: 0.6rem 1rem 0.6rem 2.5rem;
  background-color: var(--input-bg);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  border-radius: 2rem;
  outline: none;
  font-family: inherit;
  transition: all 0.3s;
}

.global-search:focus {
  width: 300px;
  background-color: var(--border-light);
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);
}

/* Profile Badge */
.btn-create {
  padding: 0.6rem 1.2rem;
  font-size: 0.9rem;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.user-profile-badge {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.user-profile-badge:hover {
  transform: scale(1.05);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--btn-text-on-primary);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
}

/* Content Area */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 3rem;
}

.main-content.no-padding {
  padding: 0;
  overflow: hidden;
}

.main-content::-webkit-scrollbar {
  width: 8px;
}
.main-content::-webkit-scrollbar-track {
  background: transparent;
}
.main-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.main-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* --- Mobile Responsiveness --- */
.mobile-header {
  display: none;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-light);
  z-index: 101;
  gap: 0.75rem;
}

.mobile-logo {
  text-decoration: none;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo-img-mobile {
  height: 36px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: screen;
}

.mobile-page-title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.hamburger-btn {
  background: none;
  border: none;
  color: var(--text-main);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  z-index: 99;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .mobile-header {
    display: flex;
  }
  
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100svh;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 102;
    box-shadow: 5px 0 15px rgba(0,0,0,0.5);
    padding: 1.5rem 1.25rem;
  }
  
  .sidebar.active {
    transform: translateX(0);
  }
  
  .sidebar-overlay.active {
    display: block;
  }
  
  .logo {
    display: none;
  }
  
  .main-wrapper {
    overflow-y: auto;
  }
  
  /* Hide the redundant desktop dashboard header — title is already in mobile-header */
  .dashboard-header {
    height: auto;
    padding: 0.5rem 1rem;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
  }
  
  .page-title {
    display: none;
  }
  
  .header-controls {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 0.75rem;
    align-items: center;
  }

  .search-bar-container {
    flex: 1;
    order: 0;
    margin-top: 0;
  }

  .global-search {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    font-size: 0.85rem;
  }
  
  .global-search:focus {
    width: 100%;
  }

  .btn-create {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .avatar {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }
  
  .user-profile-badge {
    margin-left: 0;
  }
  
  .main-content {
    padding: 1rem 0.75rem;
  }
  .main-content.no-padding {
    padding: 0;
  }
}

.unread-badge {
  background-color: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  margin-left: auto;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
}
[data-theme="notion"] .logo-img,
[data-theme="notion"] .logo-img-mobile {
  filter: invert(1);
  mix-blend-mode: normal;
}
</style>
