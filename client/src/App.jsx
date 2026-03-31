import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Lobby from './pages/Lobby';
import MeetingRoom from './pages/MeetingRoom';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:id/lobby" element={<Lobby />} />
          <Route path="/room/:id" element={<MeetingRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
