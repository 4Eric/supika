// Helper to resolve image URLs - handles both Cloudinary (full URL) and local filenames
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:5000'

export function getImageUrl(imageUrl) {
    if (!imageUrl || imageUrl === 'default_event.png') {
        return `${API_URL}/uploads/default_event.png`
    }
    // If it's already a full URL (Cloudinary), return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl
    }
    // Otherwise it's a local filename
    return `${API_URL}/uploads/${imageUrl}`
}
