import http from '../api/client';

export async function login(email: string, password: string) {
  await http.post('/api/auth/login', { email, password }); // Agregado /api/
  const { data } = await http.get('/api/auth/me');         // Agregado /api/
  return data;
}

export async function logout() {
  await http.post('/api/auth/logout'); // Agregado /api/
}