import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
    const activeTheme = ref(localStorage.getItem('app-theme') || 'dark')

    const setTheme = (theme) => {
        activeTheme.value = theme
    }

    const toggleTheme = () => {
        activeTheme.value = activeTheme.value === 'dark' ? 'notion' : 'dark'
    }

    watch(activeTheme, (newTheme) => {
        localStorage.setItem('app-theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }, { immediate: true })

    return {
        activeTheme,
        setTheme,
        toggleTheme
    }
})
