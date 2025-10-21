// services/leads.ts

import { api } from '../api';

// Tipos para los datos de leads
export interface LeadData {
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  notas?: string;
  estado?: string;
  fuente?: string;
  fecha?: string;
  vendedor?: number | null;
  equipo?: string;
  infoUsado?: string;
  entrega?: boolean;
}

export interface Lead extends LeadData {
  id: number;
  assigned_to?: number | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
}

export interface LeadResponse {
  lead: Lead;
  message?: string;
}

export interface LeadsListResponse {
  leads: Lead[];
  total?: number;
}

export interface DeleteResponse {
  message: string;
  success: boolean;
}

export interface LeadStats {
  total: number;
  vendidos: number;
  conversion: number;
  bySource: Record<string, number>;
  byEstado: Record<string, number>;
}

// Tipo para errores de API
interface ApiError {
  response?: {
    status: number;
    data: {
      error?: string;
    };
  };
  message?: string;
}

// Obtener todos los leads
export const listLeads = async (): Promise<Lead[]> => {
  try {
    const response = await api.get('/leads');
    
    // 🔍 DEBUG: Ver qué está llegando del backend
    console.log('📥 Respuesta completa del backend:', response.data);
    console.log('📥 Tipo de response.data:', typeof response.data, 'Es array?', Array.isArray(response.data));
    
    // ✅ Manejar ambos formatos posibles:
    // 1. Array directo: [lead1, lead2, lead3]
    // 2. Objeto con propiedad: { leads: [lead1, lead2], total: 150 }
    const leads = Array.isArray(response.data) 
      ? response.data 
      : (response.data.leads || []);
    
    console.log('📥 listLeads procesó:', leads.length, 'leads');
    
    if (leads.length > 0) {
      console.log('📥 Primer lead de ejemplo:', leads[0]);
    }
    
    return leads;
  } catch (error) {
    console.error('❌ Error al obtener leads:', error);
    throw error;
  }
};

// Obtener un lead específico
export const getLead = async (id: number): Promise<Lead> => {
  try {
    const response = await api.get<Lead>(`/leads/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener lead:', error);
    throw error;
  }
};

// Crear un nuevo lead
export const createLead = async (leadData: LeadData): Promise<Lead> => {
  try {
    const response = await api.post<Lead>('/leads', leadData);
    return response.data;
  } catch (error) {
    console.error('Error al crear lead:', error);
    throw error;
  }
};

// Actualizar un lead existente
export const updateLead = async (id: number, updateData: Partial<LeadData>): Promise<Lead> => {
  try {
    const response = await api.put<Lead>(`/leads/${id}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Error al actualizar lead:', error);
    throw error;
  }
};

// NUEVO: Eliminar un lead (solo para Owner y Director)
export const deleteLead = async (id: number): Promise<DeleteResponse> => {
  try {
    const response = await api.delete<DeleteResponse>(`/leads/${id}`);
    return response.data;
  } catch (error: unknown) {
    console.error('Error al eliminar lead:', error);
    
    const apiError = error as ApiError;
    
    // Manejar errores específicos
    if (apiError.response?.status === 403) {
      throw new Error(apiError.response.data.error || 'No tienes permisos para eliminar leads');
    } else if (apiError.response?.status === 404) {
      throw new Error('Lead no encontrado');
    } else {
      throw new Error(apiError.response?.data?.error || apiError.message || 'Error al eliminar lead');
    }
  }
};

// Crear lead desde webhook (para bots)
export const createLeadFromWebhook = async (equipo: string, leadData: LeadData): Promise<Lead> => {
  try {
    const response = await api.post<Lead>(`/leads/webhook/${equipo}`, leadData);
    return response.data;
  } catch (error) {
    console.error('Error al crear lead desde webhook:', error);
    throw error;
  }
};

// Obtener estadísticas de leads
export const getLeadStats = async (filters: Record<string, string> = {}): Promise<LeadStats> => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get<LeadStats>(`/leads/stats${params ? `?${params}` : ''}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener estadísticas de leads:', error);
    throw error;
  }
};