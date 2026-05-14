import axios from "axios";

const baseURL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export default api;
