// src/api/auth.service.js
import apiClient from './client';

const AuthService = {
  login: async (username, password) => {
    // FastAPI requiere form-data para el token
    const data = new FormData();
    data.append('username', username);
    data.append('password', password);

    const response = await apiClient.post('/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export default AuthService;