import { api } from "../api";
export const listUsers   = () => api.get("/users").then(r => r.data);
export const createUser  = (p) => api.post("/users", p).then(r => r.data);
export const updateUser  = (id, p) => api.put(`/users/${id}`, p).then(r => r.data);
export const deleteUser  = (id) => api.delete(`/users/${id}`).then(r => r.data);
