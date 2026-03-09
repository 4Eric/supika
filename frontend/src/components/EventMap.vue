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
  },
  immersive: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['markerClick', 'locationSelected', 'eventPreview'])
const mapContainer = ref(null)
let mapInstance = null
let markersGroup = null
let pickerMarker = null
let activeMarkerRef = null

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

const locateUser = () => {
  if (!mapInstance) return
  mapInstance.locate({ setView: true, maxZoom: 15 })
}

defineExpose({
  setPickerMarker,
  centerMap,
  locateUser
})

// Custom branded marker icon
const createCustomIcon = (isInstant) => {
  return leaflet.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-dot ${isInstant ? 'instant' : 'standard'}">
             <div class="marker-pulse"></div>
           </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

const createActiveIcon = () => {
  return leaflet.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-dot active">
             <div class="marker-pulse active-pulse"></div>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  })
}

onMounted(() => {
  const tileUrl = props.immersive
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  
  const tileAttribution = props.immersive
    ? '&copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; OpenStreetMap contributors'

  mapInstance = leaflet.map(mapContainer.value, {
    zoomControl: false // We'll add custom position
  }).setView([40.7128, -74.0060], 13)

  // Add zoom control to bottom-right
  leaflet.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

  leaflet.tileLayer(tileUrl, {
    attribution: tileAttribution,
    maxZoom: 19
  }).addTo(mapInstance)

  // Style the cluster markers for dark mode
  markersGroup = leaflet.markerClusterGroup({
    chunkedLoading: true,
    removeOutsideVisibleBounds: true,
    iconCreateFunction: props.immersive ? (cluster) => {
      const count = cluster.getChildCount()
      let size = 'small'
      if (count > 10) size = 'medium'
      if (count > 50) size = 'large'
      return leaflet.divIcon({
        html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
        className: 'custom-cluster',
        iconSize: [44, 44]
      })
    } : undefined
  }).addTo(mapInstance)

  // User location indicator
  if (props.immersive) {
    mapInstance.on('locationfound', (e) => {
      leaflet.circleMarker(e.latlng, {
        radius: 8,
        fillColor: '#38bdf8',
        fillOpacity: 1,
        color: '#fff',
        weight: 3
      }).addTo(mapInstance)
      // Pulsing ring
      leaflet.circleMarker(e.latlng, {
        radius: 24,
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        color: '#38bdf8',
        weight: 1,
        opacity: 0.4
      }).addTo(mapInstance)
    })
  }

  if (props.pickerMode) {
    mapInstance.on('click', function(e) {
      if (!e.latlng) return
      const lat = e.latlng.lat
      const lng = e.latlng.lng
      if (pickerMarker) {
        pickerMarker.setLatLng([lat, lng])
      } else {
        pickerMarker = leaflet.marker([lat, lng]).addTo(mapInstance)
      }
      emit('locationSelected', { lat, lng })
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
  activeMarkerRef = null
  
  if (props.events?.length > 0) {
    const bounds = leaflet.latLngBounds()
    let hasValidPoints = false

    const newMarkers = props.events.map(event => {
      if (!event.latitude || !event.longitude) return null
      
      const isInstant = !event.requiresApproval
      const icon = props.immersive ? createCustomIcon(isInstant) : undefined
      
      const markerOptions = icon ? { icon } : {}
      const marker = leaflet.marker([event.latitude, event.longitude], markerOptions)
      
      if (!props.immersive) {
        marker.bindTooltip(event.title || 'Event')
      }
      
      marker.on('click', () => {
        if (props.immersive) {
          // Reset previous active marker
          if (activeMarkerRef) {
            const prevIsInstant = !activeMarkerRef._eventData?.requiresApproval
            activeMarkerRef.setIcon(createCustomIcon(prevIsInstant))
          }
          marker.setIcon(createActiveIcon())
          activeMarkerRef = marker
          marker._eventData = event
          emit('eventPreview', event)
        } else {
          emit('markerClick', event.id)
        }
      })
      
      bounds.extend([event.latitude, event.longitude])
      hasValidPoints = true
      return marker
    }).filter(m => m !== null)
    
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

<style>
.map-container {
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Custom Marker Styles */
.custom-marker {
  background: none !important;
  border: none !important;
}

.marker-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.marker-dot.standard {
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  border: 3px solid rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.5);
}

.marker-dot.instant {
  background: linear-gradient(135deg, #34d399, #38bdf8);
  border: 3px solid rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(52, 211, 153, 0.5);
}

.marker-dot.active {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f472b6, #38bdf8);
  border: 3px solid #fff;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
  transform: scale(1.2);
}

.marker-pulse {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: inherit;
  opacity: 0;
  animation: markerPulse 2s infinite;
}

.active-pulse {
  animation: markerPulse 1.5s infinite;
}

@keyframes markerPulse {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}

/* Custom Cluster Styles */
.custom-cluster {
  background: none !important;
  border: none !important;
}

.cluster-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
  font-family: 'Outfit', sans-serif;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.cluster-small {
  width: 40px; height: 40px;
  background: linear-gradient(135deg, rgba(56,189,248,0.85), rgba(129,140,248,0.85));
  border: 2px solid rgba(255,255,255,0.3);
}

.cluster-medium {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, rgba(56,189,248,0.9), rgba(168,85,247,0.9));
  border: 2px solid rgba(255,255,255,0.4);
}

.cluster-large {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, rgba(244,114,182,0.9), rgba(56,189,248,0.9));
  border: 3px solid rgba(255,255,255,0.5);
  font-size: 1rem;
}
</style>
