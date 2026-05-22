// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import AuthService from '../api/auth.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay sesión guardada al cargar
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [token]);

  const login = async (username, password) => {
    try {
      const data = await AuthService.login(username, password);
      localStorage.setItem('token', data.access_token);
      // FastAPI suele devolver el user info en el token o puedes pedirlo aparte.
      // Aquí simulamos guardar el username como user básico
      const userInfo = { username, role: 'ADMIN' }; // Ajustar según respuesta real
      localStorage.setItem('user', JSON.stringify(userInfo));
      
      setToken(data.access_token);
      setUser(userInfo);
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };

  const logout = () => {
    AuthService.logout();
    setToken(null);
    setUser(null);
  };

  const value = { user, token, login, logout, isAuthenticated: !!token, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);