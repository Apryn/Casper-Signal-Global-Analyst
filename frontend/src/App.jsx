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
import Performance from './pages/Performance';
import Targets from './pages/Targets';
import Contents from './pages/Contents';
import Schedules from './pages/Schedules';
import ImportPage from './pages/Import';
import Evaluations from './pages/Evaluations';


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

            {/* Performance Analytics (both roles) */}
            <Route path="performance" element={<Performance />} />

            {/* Daily Reports Ledger (both roles) */}
            <Route path="reports" element={<Reports />} />

            {/* Leaderboard (both roles) */}
            <Route path="leaderboard" element={<Leaderboard />} />

            {/* Target Tracking (both roles) */}
            <Route path="targets" element={<Targets />} />

            {/* Content Library (both roles) */}
            <Route path="contents" element={<Contents />} />

            {/* schedules (both roles) */}
            <Route path="schedules" element={<Schedules />} />

            {/* Batch Import (both roles) */}
            <Route path="import" element={<ImportPage />} />

            {/* Weekly Evaluations (both roles) */}
            <Route path="evaluations" element={<Evaluations />} />


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
