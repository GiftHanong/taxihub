import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import storage from '../../services/storage';
import './UserApp.css';

function UserApp() {
  const [destination, setDestination] = useState('');
  const [taxiRanks, setTaxiRanks] = useState([]);
  const [filteredRanks, setFilteredRanks] = useState([]);
  const [selectedRank, setSelectedRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'nearby'
  const [sortBy, setSortBy] = useState('distance'); // 'distance', 'name', 'recent'

  useEffect(() => {
    loadTaxiRanks();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (viewMode === 'nearby' && userLocation && taxiRanks.length > 0) {
      showNearbyRanks();
    }
  }, [viewMode, userLocation, taxiRanks]);

  const loadTaxiRanks = async () => {
    try {
      // Try to load from cache first for offline support
      const cached = await storage.getTaxiRanks();
      if (cached && cached.length > 0) {
        setTaxiRanks(cached);
        setLoading(false);
      }

      // Load fresh data from Firebase
      const q = query(collection(db, 'taxiRanks'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ranks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (ranks.length > 0) {
        setTaxiRanks(ranks);
        await storage.saveTaxiRanks(ranks);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading taxi ranks:', error);
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSearch = () => {
    if (!destination.trim()) {
      setFilteredRanks([]);
      return;
    }

    const searchTerm = destination.toLowerCase();
    const filtered = taxiRanks.filter(rank => 
      rank.destinations?.some(dest => 
        dest.toLowerCase().includes(searchTerm)
      ) ||
      rank.name?.toLowerCase().includes(searchTerm) ||
      rank.address?.toLowerCase().includes(searchTerm) ||
      rank.aisles?.some(aisle => 
        aisle.routes?.some(route => route.toLowerCase().includes(searchTerm))
      )
    );

    sortRanks(filtered);
    setFilteredRanks(filtered);
    storage.saveLastSearch(destination);
  };

  const showNearbyRanks = () => {
    if (!userLocation) {
      alert('Please enable location to see nearby taxi ranks');
      setViewMode('list');
      return;
    }

    // Show all ranks within 10km
    const nearby = taxiRanks.filter(rank => {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        rank.location?.lat, rank.location?.lng
      );
      return distance <= 10;
    });

    sortRanks(nearby);
    setFilteredRanks(nearby);
  };

  const sortRanks = (ranks) => {
    const sorted = [...ranks];
    
    if (sortBy === 'distance' && userLocation) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(
          userLocation.lat, userLocation.lng,
          a.location?.lat || 0, a.location?.lng || 0
        );
        const distB = calculateDistance(
          userLocation.lat, userLocation.lng,
          b.location?.lat || 0, b.location?.lng || 0
        );
        return distA - distB;
      });
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
    }

    return sorted;
  };

  const getDistance = (rank) => {
    if (!userLocation || !rank.location) return null;
    const dist = calculateDistance(
      userLocation.lat, userLocation.lng,
      rank.location.lat, rank.location.lng
    );
    return dist.toFixed(1);
  };

  const getTotalRoutes = (rank) => {
    if (!rank.aisles) return 0;
    return rank.aisles.reduce((total, aisle) => total + (aisle.routes?.length || 0), 0);
  };

  const openInMaps = (rank) => {
    if (!rank.location) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${rank.location.lat},${rank.location.lng}`;
    window.open(url, '_blank');
  };

  const shareRank = async (rank) => {
    const shareData = {
      title: rank.name,
      text: `${rank.name} - ${rank.address}\nDestinations: ${rank.destinations?.join(', ')}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
      alert('Rank details copied to clipboard!');
    }
  };

  const clearSearch = () => {
    setDestination('');
    setFilteredRanks([]);
    setViewMode('list');
  };

  return (
    <div className="user-app">
      <header className="user-header">
        <Link to="/" className="back-btn">← Back</Link>
        <h1>🚖 Find Your Taxi</h1>
        {userLocation && (
          <div className="location-indicator">
            <span className="location-dot"></span>
            Location Active
          </div>
        )}
      </header>

      <div className="user-container">
        <div className="search-section">
          {/* Search Bar */}
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by destination, rank name, or route..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="search-input"
            />
            {destination && (
              <button onClick={clearSearch} className="clear-btn" title="Clear search">
                ✕
              </button>
            )}
            <button onClick={handleSearch} className="search-btn">
              🔍 Search
            </button>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button 
              className={`action-btn ${viewMode === 'nearby' ? 'active' : ''}`}
              onClick={() => setViewMode('nearby')}
              disabled={!userLocation}
            >
              📍 Nearby Ranks
            </button>
            <button 
              className="action-btn"
              onClick={() => {
                setViewMode('list');
                setFilteredRanks(taxiRanks);
              }}
            >
              📋 View All
            </button>
          </div>

          {/* Sort Options */}
          {filteredRanks.length > 0 && (
            <div className="sort-section">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setFilteredRanks(sortRanks(filteredRanks));
                }}
                className="sort-select"
              >
                <option value="distance">Distance (Nearest First)</option>
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recently Added</option>
              </select>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading taxi ranks...</p>
            </div>
          )}

          {/* No Ranks Available */}
          {!loading && taxiRanks.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🚏</div>
              <h3>No Taxi Ranks Yet</h3>
              <p>Taxi ranks will appear here once marshals add them to the system.</p>
            </div>
          )}

          {/* Search Results */}
          {filteredRanks.length > 0 && (
            <div className="results">
              <div className="results-header">
                <h2 className="results-title">
                  {viewMode === 'nearby' ? '📍 ' : ''}
                  Found {filteredRanks.length} taxi rank{filteredRanks.length !== 1 ? 's' : ''}
                </h2>
                {viewMode === 'nearby' && (
                  <span className="results-subtitle">Within 10km of your location</span>
                )}
              </div>
              
              <div className="ranks-list">
                {filteredRanks.map(rank => (
                  <div
                    key={rank.id}
                    className="rank-card"
                  >
                    <div className="rank-card-header">
                      <div className="rank-info">
                        <h3 onClick={() => setSelectedRank(rank)}>{rank.name}</h3>
                        {getDistance(rank) && (
                          <span className="distance">
                            📍 {getDistance(rank)} km away
                          </span>
                        )}
                      </div>
                      <div className="rank-actions">
                        <button 
                          onClick={() => openInMaps(rank)}
                          className="icon-btn"
                          title="Get directions"
                        >
                          🗺️
                        </button>
                        <button 
                          onClick={() => shareRank(rank)}
                          className="icon-btn"
                          title="Share"
                        >
                          📤
                        </button>
                      </div>
                    </div>

                    <p className="rank-address">{rank.address}</p>
                    
                    <div className="rank-stats">
                      <span className="stat-item">
                        🚏 {rank.aisles?.length || 0} Aisles
                      </span>
                      <span className="stat-item">
                        🛣️ {getTotalRoutes(rank)} Routes
                      </span>
                      <span className="stat-item">
                        📍 {rank.destinations?.length || 0} Destinations
                      </span>
                    </div>

                    <div className="rank-destinations">
                      <strong>Destinations:</strong>
                      <div className="destination-tags">
                        {rank.destinations?.slice(0, 4).map((dest, idx) => (
                          <span key={idx} className="destination-tag">{dest}</span>
                        ))}
                        {rank.destinations?.length > 4 && (
                          <span className="destination-tag more">
                            +{rank.destinations.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => setSelectedRank(rank)}
                      className="view-details-btn"
                    >
                      View Aisles & Routes →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {destination && filteredRanks.length === 0 && !loading && taxiRanks.length > 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>No matches found</h3>
              <p>No taxi ranks found for "{destination}"</p>
              <p className="hint">Try searching for a different destination, route, or rank name</p>
              <button onClick={clearSearch} className="retry-btn">
                Clear Search
              </button>
            </div>
          )}
        </div>

        {/* Detailed Modal */}
        {selectedRank && (
          <div className="rank-details-modal" onClick={() => setSelectedRank(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedRank(null)}>×</button>
              
              <div className="modal-header">
                <h2>{selectedRank.name}</h2>
                {getDistance(selectedRank) && (
                  <span className="modal-distance">
                    📍 {getDistance(selectedRank)} km away
                  </span>
                )}
              </div>
              
              <p className="modal-address">📍 {selectedRank.address}</p>

              {/* Destinations */}
              <div className="modal-section">
                <h3>🎯 Destinations Served</h3>
                <div className="modal-tags">
                  {selectedRank.destinations?.map((dest, idx) => (
                    <span key={idx} className="modal-tag">{dest}</span>
                  ))}
                </div>
              </div>
              
              {/* Aisles & Routes */}
              <div className="modal-section">
                <h3>🚏 Aisles & Routes</h3>
                {selectedRank.aisles?.length > 0 ? (
                  selectedRank.aisles.map((aisle, idx) => (
                    <div key={idx} className="aisle-item">
                      <div className="aisle-header">
                        <span className="aisle-number">Aisle {aisle.number}</span>
                        <span className="aisle-name">{aisle.name}</span>
                      </div>
                      <div className="aisle-routes">
                        <strong>Routes:</strong>
                        <div className="route-list">
                          {aisle.routes?.map((route, rIdx) => (
                            <span key={rIdx} className="route-item">→ {route}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No aisle information available</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="modal-actions">
                <button
                  className="directions-btn primary"
                  onClick={() => openInMaps(selectedRank)}
                >
                  🗺️ Get Directions
                </button>
                <button
                  className="directions-btn secondary"
                  onClick={() => shareRank(selectedRank)}
                >
                  📤 Share Rank
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserApp;