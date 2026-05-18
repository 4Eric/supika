import { ref } from 'vue'
import axios from 'axios'

export function useGeolocation(sharedErrorRef) {
  const latitude = ref(null)
  const longitude = ref(null)
  const locationName = ref('')
  const errorMsg = sharedErrorRef || ref('')

  const handleLocationSelected = async (latlng) => {
    latitude.value = latlng.lat
    longitude.value = latlng.lng

    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: latlng.lat,
          lon: latlng.lng,
          format: 'json',
          'accept-language': 'en'
        }
      })
      
      if (res.data && res.data.display_name) {
        locationName.value = res.data.display_name
      }
    } catch (error) {
      console.error("Failed to reverse geocode:", error)
    }
  }

  const lookupAddress = async (eventMapRef) => {
    if (!locationName.value) return
    errorMsg.value = ''
    
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: locationName.value,
          format: 'json',
          limit: 1,
          'accept-language': 'en'
        }
      })
      
      if (res.data && res.data.length > 0) {
        const { lat, lon } = res.data[0]
        latitude.value = parseFloat(lat)
        longitude.value = parseFloat(lon)
        if (eventMapRef?.value) {
          eventMapRef.value.setPickerMarker(latitude.value, longitude.value)
        }
      } else {
        errorMsg.value = "Address not found."
      }
    } catch (error) {
      errorMsg.value = "Failed to lookup address."
    }
  }

  const resolveAddress = async (lat, lng) => {
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat, lon: lng, format: 'json', 'accept-language': 'en' }
      });
      if (res.data && res.data.display_name) {
        locationName.value = res.data.display_name;
      }
    } catch (e) {
      console.error("Reverse geocoding failed:", e);
    }
  };

  const getUserLocation = (eventMapRef) => {
    if (!navigator.geolocation) {
      errorMsg.value = "Geolocation is not supported by your browser.";
      return;
    }
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
    if (!isSecure && window.location.protocol !== 'https:') {
      errorMsg.value = "Mobile browsers require HTTPS for location features.";
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        latitude.value = lat;
        longitude.value = lng;
        if (eventMapRef?.value) eventMapRef.value.setPickerMarker(lat, lng);
        errorMsg.value = "";
        await resolveAddress(lat, lng);
      },
      (error) => {
        if (error.code === 1) {
          errorMsg.value = "Location permission denied. Please enable it in your browser settings.";
        } else {
          errorMsg.value = "Unable to retrieve location: " + error.message;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return {
    latitude,
    longitude,
    locationName,
    handleLocationSelected,
    lookupAddress,
    getUserLocation
  }
}
