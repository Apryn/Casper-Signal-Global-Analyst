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

// ============================================================
// ERROR BOUNDARY — prevents full-app crash on component errors
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080b11',
          color: '#f3f4f6',
          fontFamily: 'Outfit, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f87171' }}>
            Terjadi Kesalahan
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'Sesuatu yang tidak terduga terjadi. Silahkan muat ulang halaman.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
