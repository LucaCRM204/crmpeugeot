import { api } from '../api';

export async function login(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data;
}