import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Lobby from './pages/Lobby';
import MeetingRoom from './pages/MeetingRoom';
import MeetingsDashboard from './pages/MeetingsDashboard';
import WebinarsDashboard from './pages/WebinarsDashboard';
import WebinarRoom from './pages/WebinarRoom';
import RecordingsPage from './pages/RecordingsPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/room/:id/lobby" element={<Lobby />} />
            <Route path="/room/:id" element={<MeetingRoom />} />

            {/* Protected routes */}
            <Route path="/meetings" element={
              <ProtectedRoute><MeetingsDashboard /></ProtectedRoute>
            } />
            <Route path="/webinars" element={
              <ProtectedRoute><WebinarsDashboard /></ProtectedRoute>
            } />
            <Route path="/recordings" element={
              <ProtectedRoute><RecordingsPage /></ProtectedRoute>
            } />
            <Route path="/webinar/:id" element={
              <ProtectedRoute><WebinarRoom /></ProtectedRoute>
            } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
