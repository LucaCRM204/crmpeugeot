import http from '../api/client';

export const authService = {
  async login(email: string, password: string) {
    const response = await http.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  
  getToken() {
    return localStorage.getItem('token');
  },
  
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }
};

export default authService;
