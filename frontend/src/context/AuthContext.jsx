import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved token on startup
    const token = localStorage.getItem('casper_token');
    const storedUser = localStorage.getItem('casper_user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));

        // Verify token is still valid
        api.get('/auth/me')
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('casper_user', JSON.stringify(res.data));
          })
          .catch(() => {
            logout();
          });
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (activationCode) => {
    try {
      const res = await api.post('/auth/login', { activationCode });
      const { token, user: userData } = res.data;

      localStorage.setItem('casper_token', token);
      localStorage.setItem('casper_user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Kode aktivasi salah.';
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('casper_token');
    localStorage.removeItem('casper_user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
