import { api } from '../api';

export async function login(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  
  // Si el backend devuelve un token, configurarlo en el cliente API
  if (response.data.token) {
    // Configurar el token para futuras requests
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
  }
  
  return response.data; // Devolver {ok: true, token: "...", user: {...}}
}

export async function logout() {
  await api.post('/auth/logout');
  // Limpiar el token
  delete api.defaults.headers.common['Authorization'];
}