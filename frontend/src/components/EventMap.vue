<script setup>
import { onMounted, ref, watch } from 'vue'
import leaflet from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

const props = defineProps({
  events: {
    type: Array,
    required: true
  },
  pickerMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['markerClick', 'locationSelected'])
const mapContainer = ref(null)
let mapInstance = null
let markersGroup = null
let pickerMarker = null

const centerMap = (lat, lng, zoomLevel = 13) => {
  if (!mapInstance) return
  mapInstance.setView([lat, lng], zoomLevel)
}

const setPickerMarker = (lat, lng) => {
  if (!mapInstance) return
  if (pickerMarker) {
    pickerMarker.setLatLng([lat, lng])
  } else {
    pickerMarker = leaflet.marker([lat, lng]).addTo(mapInstance)
  }
  mapInstance.setView([lat, lng], 13)
}

defineExpose({
  setPickerMarker,
  centerMap
})

onMounted(() => {
  mapInstance = leaflet.map(mapContainer.value).setView([40.7128, -74.0060], 13) // Default NYC

  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapInstance)

  markersGroup = leaflet.markerClusterGroup({
    chunkedLoading: true,
    removeOutsideVisibleBounds: true
  }).addTo(mapInstance)

  if (props.pickerMode) {
    mapInstance.on('click', function(e) {
      if (!e.latlng) return;
      
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      if (pickerMarker) {
        pickerMarker.setLatLng([lat, lng])
      } else {
        pickerMarker = leaflet.marker([lat, lng]).addTo(mapInstance)
      }
      
      emit('locationSelected', { lat: lat, lng: lng })
    })
  } else {
    updateMarkers()
  }
})

watch(() => props.events, () => {
  if (!props.pickerMode) updateMarkers()
}, { deep: true })

const updateMarkers = () => {
  if (!markersGroup || !mapInstance) return
  markersGroup.clearLayers()
  
  if (props.events?.length > 0) {
    const bounds = leaflet.latLngBounds()
    let hasValidPoints = false

    const newMarkers = props.events.map(event => {
      if (!event.latitude || !event.longitude) return null
      
      const marker = leaflet.marker([event.latitude, event.longitude])
        .bindTooltip(event.title || 'Event')
        .on('click', () => emit('markerClick', event.id))
      
      bounds.extend([event.latitude, event.longitude])
      hasValidPoints = true
      return marker
    }).filter(m => m !== null)
    
    // Using addLayers (plural) is significantly faster for large batches
    markersGroup.addLayers(newMarkers)
    
    if (hasValidPoints) {
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }
}
</script>

<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  z-index: 1;
}
</style>
