import axios from "axios";

export const api = axios.create({
  baseURL: "/api",       // relativo → se reescribe en Vercel
  withCredentials: true  // necesario si usás cookies
});
