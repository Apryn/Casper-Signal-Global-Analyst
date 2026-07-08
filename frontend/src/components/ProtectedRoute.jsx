import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg text-indigo-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent"></div>
        <span className="ml-3 text-lg font-medium">Loading session...</span>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page and keep the attempted URL for later redirection
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Role not authorized, redirect to home
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-dark-bg text-center p-6">
        <h1 className="text-4xl font-bold text-red-500 glow-text">403 - Access Denied</h1>
        <p className="mt-4 text-gray-400 max-w-md">
          You do not have the required permissions to access this page. Please contact your administrator.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-6 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
