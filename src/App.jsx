import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UserApp from './components/UserApp/UserApp';
import MarshalApp from './components/MarshalApp/MarshalApp';
import './App.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      <div className="app">
        {!isOnline && (
          <div className="offline-banner">
            📴 You're offline. Some features may be limited.
          </div>
        )}
        
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/user/*" element={<UserApp />} />
          <Route path="/marshal/*" element={<MarshalApp />} />
        </Routes>
      </div>
    </Router>
  );
}

function HomePage() {
  return (
    <div className="home-page">
      <div className="home-container">
        <h1 className="home-title">🚖 TaxiHub</h1>
        <p className="home-subtitle">Your guide to taxi ranks and routes</p>
        
        <div className="home-cards">
          <Link to="/user" className="home-card user-card">
            <div className="card-icon">🧭</div>
            <h2>Find a Taxi</h2>
            <p>Find the nearest taxi rank and get directions</p>
          </Link>
          
          <Link to="/marshal" className="home-card marshal-card">
            <div className="card-icon">👮</div>
            <h2>Queue Marshal</h2>
            <p>Manage taxi queues and track loads</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;