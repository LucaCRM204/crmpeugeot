import { api } from '../api';

export const listPresupuestos = async () => {
  const res = await api.get('/presupuestos');
  return res.data?.plantillas || [];
};

export const getPresupuesto = async (id: number) => {
  const res = await api.get(`/presupuestos/${id}`);
  return res.data?.plantilla;
};

export const createPresupuesto = async (data: any) => {
  const res = await api.post('/presupuestos', data);
  return res.data?.plantilla;
};

export const updatePresupuesto = async (id: number, data: any) => {
  const res = await api.put(`/presupuestos/${id}`, data);
  return res.data?.plantilla;
};

export const deletePresupuesto = async (id: number) => {
  const res = await api.delete(`/presupuestos/${id}`);
  return res.data;
};