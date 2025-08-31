import axios from "axios";
export const api = axios.create({
  baseURL: "/api",      // Vercel reescribe al backend
  withCredentials: true
});
