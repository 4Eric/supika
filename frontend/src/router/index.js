import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('@/views/Home.vue')
        },
        {
            path: '/map',
            name: 'map',
            component: () => import('@/views/MapView.vue')
        },
        {
            path: '/event/:id',
            name: 'event-detail',
            component: () => import('@/views/EventDetail.vue')
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('@/views/Register.vue')
        },
        {
            path: '/create',
            name: 'create-event',
            component: () => import('@/views/CreateEvent.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/my-messages',
            name: 'my-messages',
            component: () => import('@/views/MyMessages.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/profile',
            name: 'profile',
            component: () => import('@/views/ProfileView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/my-events',
            name: 'my-events',
            component: () => import('@/views/MyEvents.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/chat/:eventId/:otherUserId',
            name: 'chat',
            component: () => import('@/views/ChatView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/group-chat/:eventId',
            name: 'group-chat',
            component: () => import('@/views/GroupChatView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/hosted',
            name: 'hosted-events',
            component: () => import('@/views/CreatedEvents.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/event/:id/edit',
            name: 'edit-event',
            component: () => import('@/views/EditEvent.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/admin/users',
            name: 'admin-users',
            component: () => import('@/views/AdminUsers.vue'),
            meta: { requiresAuth: true, requiresAdmin: true }
        }
    ]
})

// Navigation Guard
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/login')
    } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
        next('/')
    } else {
        next()
    }
})

export default router

