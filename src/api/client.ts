import axios from 'axios';
export const API_BASE = import.meta.env.VITE_API_URL;

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,              // << CLAVE
  headers: { 'Content-Type': 'application/json' }
});

export default http;
