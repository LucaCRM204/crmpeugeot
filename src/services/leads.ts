import { api } from "../api";

export type Lead = {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  fecha?: string;
  estado?: string;
  vendedor?: number | null;
  notas?: string;
  fuente?: string;
};

export const listLeads = async (): Promise<Lead[]> =>
  (await api.get("/leads")).data;

export const createLead = async (p: Partial<Lead>) =>
  (await api.post("/leads", p)).data;

export const updateLead = async (id: number, p: Partial<Lead>) =>
  (await api.put(`/leads/${id}`, p)).data;

export const deleteLead = async (id: number) =>
  (await api.delete(`/leads/${id}`)).data;
