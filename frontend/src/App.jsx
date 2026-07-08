import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Leaderboard from './pages/Leaderboard';
import Streamers from './pages/Streamers';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Index */}
            <Route index element={<Dashboard />} />

            {/* Daily Reports Ledger (Admins & Analysts) */}
            <Route path="reports" element={<Reports />} />

            {/* Leaderboard (Admins & Analysts) */}
            <Route path="leaderboard" element={<Leaderboard />} />

            {/* Streamers Management (both roles) */}
            <Route
              path="streamers"
              element={
                <ProtectedRoute>
                  <Streamers />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
