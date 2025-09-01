import http from '../api/client';

export async function login(email: string, password: string) {
  await http.post('/auth/login', { email, password }); // SIN /api/
  const { data } = await http.get('/auth/me');         // SIN /api/
  return data;
}

export async function logout() {
  await http.post('/auth/logout'); // SIN /api/
}