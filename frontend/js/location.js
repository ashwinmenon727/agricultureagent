const LOCATION_KEY = "agriguide_location";

export function getStoredLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredLocation(loc) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

export async function searchPlaces(query, language) {
  const res = await fetch(
    `/api/geocode/search?q=${encodeURIComponent(query)}&language=${language}`
  );
  if (!res.ok) throw new Error("Geocode failed");
  const data = await res.json();
  return data.results || [];
}

export function detectCountryCode(location) {
  return (location?.country_code || "IN").toUpperCase();
}

export function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let country_code = "IN";
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data = await res.json();
            if (data.country_code) country_code = data.country_code;
          }
        } catch {}
        resolve({
          latitude: lat,
          longitude: lon,
          elevation: null,
          label: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
          country_code,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}
