import axios from "axios";

const baseURL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// In-memory PIN2 cache: { value, expires_at }
let pin2Cache = null;
const PIN2_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function setPin2(pin) {
  pin2Cache = { value: pin, expiresAt: Date.now() + PIN2_TTL_MS };
}

export function getPin2() {
  if (!pin2Cache) return null;
  if (Date.now() > pin2Cache.expiresAt) {
    pin2Cache = null;
    return null;
  }
  return pin2Cache.value;
}

export function clearPin2() {
  pin2Cache = null;
}

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Auto-inject X-PIN2 header on requests that need it
api.interceptors.request.use((config) => {
  const pin = getPin2();
  if (pin) {
    config.headers = { ...(config.headers || {}), "X-PIN2": pin };
  }
  return config;
});

// On 403 PIN2_REQUIRED, clear cached pin so user is reprompted next time
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 403 && err?.response?.data?.detail === "PIN2_REQUIRED") {
      clearPin2();
    }
    return Promise.reject(err);
  }
);

export default api;
