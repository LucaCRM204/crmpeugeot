// services/leads.js

import { api } from '../api';

// Obtener todos los leads
export const listLeads = async () => {
  try {
    const response = await api.get('/leads');
    return response.data.leads || [];
  } catch (error) {
    console.error('Error al obtener leads:', error);
    throw error;
  }
};

// Obtener un lead específico
export const getLead = async (id) => {
  try {
    const response = await api.get(`/leads/${id}`);
    return response.data.lead;
  } catch (error) {
    console.error('Error al obtener lead:', error);
    throw error;
  }
};

// Crear un nuevo lead
export const createLead = async (leadData) => {
  try {
    const response = await api.post('/leads', leadData);
    return response.data.lead;
  } catch (error) {
    console.error('Error al crear lead:', error);
    throw error;
  }
};

// Actualizar un lead existente
export const updateLead = async (id, updateData) => {
  try {
    const response = await api.put(`/leads/${id}`, updateData);
    return response.data.lead;
  } catch (error) {
    console.error('Error al actualizar lead:', error);
    throw error;
  }
};

// NUEVO: Eliminar un lead (solo para Owner y Director)
export const deleteLead = async (id) => {
  try {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error al eliminar lead:', error);
    
    // Manejar errores específicos
    if (error.response?.status === 403) {
      throw new Error(error.response.data.error || 'No tienes permisos para eliminar leads');
    } else if (error.response?.status === 404) {
      throw new Error('Lead no encontrado');
    } else {
      throw new Error(error.response?.data?.error || 'Error al eliminar lead');
    }
  }
};

// Crear lead desde webhook (para bots)
export const createLeadFromWebhook = async (equipo, leadData) => {
  try {
    const response = await api.post(`/leads/webhook/${equipo}`, leadData);
    return response.data.lead;
  } catch (error) {
    console.error('Error al crear lead desde webhook:', error);
    throw error;
  }
};

// Obtener estadísticas de leads
export const getLeadStats = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/leads/stats${params ? `?${params}` : ''}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener estadísticas de leads:', error);
    throw error;
  }
};