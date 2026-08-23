// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import AuthService from '../api/auth.service';
import { decodeJwt, isTokenExpired } from '../utils/jwt';

const AuthContext = createContext(null);

const buildUserFromToken = (token, fallbackUsername = '') => {
  const payload = decodeJwt(token);
  return {
    username: payload?.sub || fallbackUsername,
    role: payload?.rol || 'LECTOR',
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay sesión guardada al cargar; el rol se decodifica del token
    // (fuente de verdad) para no quedar con un rol obsoleto en localStorage.
    if (token) {
      if (isTokenExpired(token)) {
        // Token vencido: la sesión ya no es válida, se limpia localmente.
        AuthService.logout();
        setToken(null);
        setUser(null);
      } else {
        const userInfo = buildUserFromToken(token);
        localStorage.setItem('user', JSON.stringify(userInfo));
        setUser(userInfo);
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (username, password) => {
    try {
      const data = await AuthService.login(username, password);
      localStorage.setItem('token', data.access_token);
      const userInfo = buildUserFromToken(data.access_token, username);
      localStorage.setItem('user', JSON.stringify(userInfo));

      setToken(data.access_token);
      setUser(userInfo);
      return true;
    } catch (error) {
      // Log sanitizado: solo el código de estado, sin volcar la respuesta completa.
      console.error("Login failed:", error?.response?.status ?? error?.message);
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