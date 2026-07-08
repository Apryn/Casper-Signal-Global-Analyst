import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved token and user on startup
    const token = localStorage.getItem('casper_token');
    const storedUser = localStorage.getItem('casper_user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        
        // Optionally verify token with /auth/me
        api.get('/auth/me')
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('casper_user', JSON.stringify(res.data));
          })
          .catch((err) => {
            console.error('Failed to verify token on boot:', err);
            logout();
          });
      } catch (e) {
        console.error('Error parsing stored user:', e);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, user: userData } = res.data;
      
      localStorage.setItem('casper_token', token);
      localStorage.setItem('casper_user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (err) {
      console.error('Login error in AuthContext:', err);
      const errMsg = err.response?.data?.message || 'Login failed. Please check credentials.';
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('casper_token');
    localStorage.removeItem('casper_user');
    setUser(null);
  };

  const isAdmin = !!user;
  const isAnalyst = !!user;

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin,
    isAnalyst,
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
