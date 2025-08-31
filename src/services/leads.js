import { api } from '../api';

export const listLeads = async () => (await api.get('/leads')).data;
export const createLead = async (payload) => (await api.post('/leads', payload)).data;
export const updateLead = async (id, payload) => (await api.put(`/leads/${id}`, payload)).data;
export const deleteLead = async (id) => (await api.delete(`/leads/${id}`)).data;
