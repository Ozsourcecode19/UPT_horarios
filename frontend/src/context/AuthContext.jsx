// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../api/auth.service';
import { decodeJwt, isTokenExpired } from '../utils/jwt';
import { clasificarErrorLogin } from '../utils/errors';
import { LS_KEYS } from '../constants';
import { setNavigate } from '../api/redirect';

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
  const [token, setToken] = useState(localStorage.getItem(LS_KEYS.token));
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
        localStorage.setItem(LS_KEYS.user, JSON.stringify(userInfo));
        setUser(userInfo);
      }
    }
    setLoading(false);
  }, [token]);

  const clearSession = () => {
    setToken(null);
    setUser(null);
  };

  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate, clearSession); }, [navigate]);

  const login = async (username, password) => {
    try {
      const data = await AuthService.login(username, password);
      localStorage.setItem(LS_KEYS.token, data.access_token);
      const userInfo = buildUserFromToken(data.access_token, username);
      localStorage.setItem(LS_KEYS.user, JSON.stringify(userInfo));

      setToken(data.access_token);
      setUser(userInfo);
      return { ok: true, codigo: null };
    } catch (error) {
      // Se clasifica el fallo para no culpar al usuario de un problema de
      // infraestructura: un 401 (credenciales) y un backend inaccesible
      // (sin respuesta) son fallos distintos y merecen mensajes distintos
      // (ver `clasificarErrorLogin`).
      const codigo = clasificarErrorLogin(error);
      // Log sanitizado: solo el código y el estado, sin volcar la respuesta.
      console.error("Login failed:", codigo, error?.response?.status ?? error?.message);
      return { ok: false, codigo };
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