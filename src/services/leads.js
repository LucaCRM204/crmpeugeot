import { api } from "../api";
export const listLeads   = () => api.get("/leads").then(r => r.data);
export const createLead  = (p) => api.post("/leads", p).then(r => r.data);
export const updateLead  = (id, p) => api.put(`/leads/${id}`, p).then(r => r.data);
export const deleteLead  = (id) => api.delete(`/leads/${id}`).then(r => r.data);
