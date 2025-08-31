import { api } from '../api';

export async function login({ email, password, useCookie = true }) {
  const { data } = await api.post('/auth/login', { email, password, useCookie });
  if (data.token) localStorage.setItem('ALLUMA_TOKEN', data.token); // solo si usás Bearer
  return data.user || null;
}

export async function logout() {
  await api.post('/auth/logout');
  localStorage.removeItem('ALLUMA_TOKEN'); // por si estabas usando Bearer
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data;
}
