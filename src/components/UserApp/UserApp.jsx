/* Enhanced UserApp.jsx - Modernized & Feature-Rich */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import storage from '../../services/storage';
import './UserApp.css';

function UserApp() {
  // State Management
  const [destination, setDestination] = useState('');
  const [taxiRanks, setTaxiRanks] = useState([]);
  const [filteredRanks, setFilteredRanks] = useState([]);
  const [selectedRank, setSelectedRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('distance');
  const [searchHistory, setSearchHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [maxDistance, setMaxDistance] = useState(10);

  // Load initial data
  useEffect(() => {
    loadTaxiRanks();
    getUserLocation();
    loadSearchHistory();
    loadFavorites();
  }, []);

  // Handle nearby ranks when location or mode changes
  useEffect(() => {
    if (viewMode === 'nearby' && userLocation && taxiRanks.length > 0) {
      showNearbyRanks();
    } else if (viewMode === 'favorites') {
      showFavoriteRanks();
    }
  }, [viewMode, userLocation, taxiRanks, maxDistance]);

  // Load taxi ranks from Firebase with offline support
  const loadTaxiRanks = async () => {
    try {
      // Try cache first for offline support
      const cached = await storage.getTaxiRanks();
      if (cached && cached.length > 0) {
        setTaxiRanks(cached);
        setLoading(false);
      }

      // Load fresh data
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

  // Get user's current location
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
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    
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

  // Enhanced search with multiple criteria
  const handleSearch = () => {
    if (!destination.trim()) {
      setFilteredRanks([]);
      return;
    }

    const searchTerm = destination.toLowerCase();
    const filtered = taxiRanks.filter(rank => {
      // Search in destinations
      const matchesDestinations = rank.destinations?.some(dest => 
        dest.toLowerCase().includes(searchTerm)
      );
      
      // Search in rank name
      const matchesName = rank.name?.toLowerCase().includes(searchTerm);
      
      // Search in address
      const matchesAddress = rank.address?.toLowerCase().includes(searchTerm);
      
      // Search in description
      const matchesDescription = rank.description?.toLowerCase().includes(searchTerm);
      
      // Search in aisle routes
      const matchesAisles = rank.aisles?.some(aisle => 
        aisle.name?.toLowerCase().includes(searchTerm) ||
        aisle.routes?.some(route => route.toLowerCase().includes(searchTerm))
      );

      return matchesDestinations || matchesName || matchesAddress || matchesDescription || matchesAisles;
    });

    const sorted = sortRanks(filtered);
    setFilteredRanks(sorted);
    
    // Save to search history
    saveSearchToHistory(destination);
  };

  // Show nearby ranks within specified distance
  const showNearbyRanks = () => {
    if (!userLocation) {
      alert('📍 Please enable location access to see nearby taxi ranks');
      setViewMode('list');
      return;
    }

    const nearby = taxiRanks.filter(rank => {
      if (!rank.location?.lat || !rank.location?.lng) return false;
      
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        rank.location.lat, rank.location.lng
      );
      return distance <= maxDistance;
    });

    const sorted = sortRanks(nearby);
    setFilteredRanks(sorted);
  };

  // Show favorite ranks
  const showFavoriteRanks = () => {
    const favoriteRanksList = taxiRanks.filter(rank => 
      favorites.includes(rank.id)
    );
    const sorted = sortRanks(favoriteRanksList);
    setFilteredRanks(sorted);
  };

  // Sort ranks by selected criteria
  const sortRanks = (ranks) => {
    const sorted = [...ranks];
    
    switch (sortBy) {
      case 'distance':
        if (userLocation) {
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
        }
        break;
      
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      
      case 'recent':
        sorted.sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        });
        break;
      
      case 'capacity':
        sorted.sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
        break;
      
      case 'routes':
        sorted.sort((a, b) => getTotalRoutes(b) - getTotalRoutes(a));
        break;
      
      default:
        break;
    }

    return sorted;
  };

  // Get distance to rank
  const getDistance = (rank) => {
    if (!userLocation || !rank.location) return null;
    const dist = calculateDistance(
      userLocation.lat, userLocation.lng,
      rank.location.lat, rank.location.lng
    );
    return dist.toFixed(1);
  };

  // Get total number of routes for a rank
  const getTotalRoutes = (rank) => {
    if (!rank.aisles || rank.aisles.length === 0) {
      return rank.destinations?.length || 0;
    }
    return rank.aisles.reduce((total, aisle) => 
      total + (aisle.routes?.length || 0), 0
    );
  };

  // Open rank location in Google Maps
  const openInMaps = (rank) => {
    if (!rank.location?.lat || !rank.location?.lng) {
      alert('⚠️ GPS coordinates not available for this rank');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${rank.location.lat},${rank.location.lng}`;
    window.open(url, '_blank');
  };

  // Share rank details
  const shareRank = async (rank) => {
    const shareData = {
      title: `🚖 ${rank.name}`,
      text: `${rank.name}\n📍 ${rank.address}\n🎯 Destinations: ${rank.destinations?.slice(0, 3).join(', ')}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.log('Error sharing:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      const text = `${shareData.title}\n${shareData.text}`;
      navigator.clipboard.writeText(text);
      alert('✅ Rank details copied to clipboard!');
    }
  };

  // Toggle favorite rank
  const toggleFavorite = (rankId) => {
    const newFavorites = favorites.includes(rankId)
      ? favorites.filter(id => id !== rankId)
      : [...favorites, rankId];
    
    setFavorites(newFavorites);
    storage.saveFavorites(newFavorites);
  };

  // Load favorites from storage
  const loadFavorites = async () => {
    const saved = await storage.getFavorites();
    if (saved) {
      setFavorites(saved);
    }
  };

  // Save search to history
  const saveSearchToHistory = async (search) => {
    if (!search.trim()) return;
    
    const newHistory = [
      search,
      ...searchHistory.filter(item => item !== search)
    ].slice(0, 10); // Keep last 10 searches
    
    setSearchHistory(newHistory);
    await storage.saveSearchHistory(newHistory);
  };

  // Load search history
  const loadSearchHistory = async () => {
    const history = await storage.getSearchHistory();
    if (history) {
      setSearchHistory(history);
    }
  };

  // Clear search
  const clearSearch = () => {
    setDestination('');
    setFilteredRanks([]);
    setViewMode('list');
  };

  // Handle sort change
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    if (filteredRanks.length > 0) {
      const sorted = sortRanks(filteredRanks);
      setFilteredRanks(sorted);
    }
  };

  // Show all ranks
  const showAllRanks = () => {
    setViewMode('list');
    const sorted = sortRanks(taxiRanks);
    setFilteredRanks(sorted);
  };

  // Get rank statistics
  const getRankStats = (rank) => {
    const stats = {
      routes: getTotalRoutes(rank),
      aisles: rank.aisles?.length || 0,
      capacity: rank.capacity || 0,
      distance: getDistance(rank)
    };
    return stats;
  };

  return (
    <div className="user-app">
      {/* Header */}
      <header className="user-header">
        <Link to="/" className="back-btn">
          <span className="back-icon">←</span>
          <span>Home</span>
        </Link>
        <h1>
          <span className="header-icon">🚖</span>
          Find Taxi Ranks
        </h1>
        {userLocation && (
          <div className="location-indicator">
            <span className="location-dot"></span>
            <span>Location Active</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="user-container">
        {/* Search Section */}
        <div className="search-section">
          {/* Search Bar */}
          <div className="search-box">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search destination, rank name, or route..."
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
            </div>
            <button onClick={handleSearch} className="search-btn">
              Search
            </button>
          </div>

          {/* Search History Suggestions */}
          {searchHistory.length > 0 && !destination && (
            <div className="search-suggestions">
              <span className="suggestions-label">Recent searches:</span>
              {searchHistory.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  className="suggestion-chip"
                  onClick={() => {
                    setDestination(item);
                    setTimeout(handleSearch, 100);
                  }}
                >
                  🕐 {item}
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="quick-actions">
            <button 
              className={`action-btn ${viewMode === 'nearby' ? 'active' : ''}`}
              onClick={() => setViewMode('nearby')}
              disabled={!userLocation}
              title={!userLocation ? 'Enable location to see nearby ranks' : 'Show nearby taxi ranks'}
            >
              <span className="btn-icon">📍</span>
              Nearby Ranks
            </button>
            <button 
              className={`action-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={showAllRanks}
            >
              <span className="btn-icon">📋</span>
              All Ranks
            </button>
            <button 
              className={`action-btn ${viewMode === 'favorites' ? 'active' : ''}`}
              onClick={() => setViewMode('favorites')}
              title="Show your favorite ranks"
            >
              <span className="btn-icon">⭐</span>
              Favorites
              {favorites.length > 0 && (
                <span className="badge">{favorites.length}</span>
              )}
            </button>
            <button 
              className="action-btn"
              onClick={getUserLocation}
              title="Refresh location"
            >
              <span className="btn-icon">🔄</span>
              Refresh Location
            </button>
          </div>

          {/* Filters */}
          <div className="filters-section">
            <button 
              className="filters-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              <span className="btn-icon">⚙️</span>
              Filters & Sort
              <span className="toggle-icon">{showFilters ? '▲' : '▼'}</span>
            </button>

            {showFilters && (
              <div className="filters-content">
                {/* Sort Options */}
                <div className="filter-group">
                  <label>Sort by:</label>
                  <div className="filter-options">
                    <button
                      className={`filter-option ${sortBy === 'distance' ? 'active' : ''}`}
                      onClick={() => handleSortChange('distance')}
                      disabled={!userLocation}
                    >
                      📏 Distance
                    </button>
                    <button
                      className={`filter-option ${sortBy === 'name' ? 'active' : ''}`}
                      onClick={() => handleSortChange('name')}
                    >
                      🔤 Name
                    </button>
                    <button
                      className={`filter-option ${sortBy === 'routes' ? 'active' : ''}`}
                      onClick={() => handleSortChange('routes')}
                    >
                      🛣️ Routes
                    </button>
                    <button
                      className={`filter-option ${sortBy === 'capacity' ? 'active' : ''}`}
                      onClick={() => handleSortChange('capacity')}
                    >
                      👥 Capacity
                    </button>
                    <button
                      className={`filter-option ${sortBy === 'recent' ? 'active' : ''}`}
                      onClick={() => handleSortChange('recent')}
                    >
                      🕐 Recent
                    </button>
                  </div>
                </div>

                {/* Distance Filter */}
                {viewMode === 'nearby' && userLocation && (
                  <div className="filter-group">
                    <label>Maximum distance: {maxDistance} km</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                      className="distance-slider"
                    />
                    <div className="slider-labels">
                      <span>1 km</span>
                      <span>25 km</span>
                      <span>50 km</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading taxi ranks...</p>
          </div>
        ) : (
          <>
            {filteredRanks.length === 0 && viewMode === 'list' && !destination ? (
              <div className="empty-state">
                <div className="empty-icon">🚖</div>
                <h3>Welcome to Taxi Finder!</h3>
                <p>Search for your destination or browse nearby ranks to get started</p>
                <div className="empty-actions">
                  <button onClick={() => setViewMode('nearby')} className="action-btn" disabled={!userLocation}>
                    📍 Show Nearby Ranks
                  </button>
                  <button onClick={showAllRanks} className="action-btn">
                    📋 Browse All Ranks
                  </button>
                </div>
              </div>
            ) : filteredRanks.length === 0 ? (
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <h3>No taxi ranks found</h3>
                {destination && <p>No matches for "{destination}"</p>}
                {viewMode === 'nearby' && <p>No ranks within {maxDistance} km</p>}
                {viewMode === 'favorites' && <p>You haven't added any favorites yet</p>}
                <p className="hint">Try adjusting your search or filters</p>
                <button onClick={clearSearch} className="retry-btn">
                  Clear & Try Again
                </button>
              </div>
            ) : (
              <div className="results-container">
                <div className="results-header">
                  <h2 className="results-title">
                    {viewMode === 'nearby' && '📍 Nearby Taxi Ranks'}
                    {viewMode === 'favorites' && '⭐ Your Favorite Ranks'}
                    {viewMode === 'list' && destination && `🔍 Search Results`}
                    {viewMode === 'list' && !destination && '📋 All Taxi Ranks'}
                  </h2>
                  <p className="results-subtitle">
                    Found {filteredRanks.length} rank{filteredRanks.length !== 1 ? 's' : ''}
                    {sortBy === 'distance' && userLocation && ' (sorted by distance)'}
                    {sortBy === 'name' && ' (sorted A-Z)'}
                    {sortBy === 'routes' && ' (sorted by routes)'}
                  </p>
                </div>

                {/* Ranks List */}
                <div className="ranks-list">
                  {filteredRanks.map(rank => {
                    const stats = getRankStats(rank);
                    const isFavorite = favorites.includes(rank.id);

                    return (
                      <div key={rank.id} className="rank-card">
                        {/* Card Header */}
                        <div className="rank-card-header">
                          <div className="rank-info">
                            <h3 onClick={() => setSelectedRank(rank)}>
                              {rank.name}
                            </h3>
                            {stats.distance && (
                              <span className="distance">{stats.distance} km away</span>
                            )}
                          </div>
                          <div className="rank-actions">
                            <button
                              className={`icon-btn ${isFavorite ? 'favorite-active' : ''}`}
                              onClick={() => toggleFavorite(rank.id)}
                              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {isFavorite ? '⭐' : '☆'}
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => openInMaps(rank)}
                              title="Get directions"
                            >
                              🗺️
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => shareRank(rank)}
                              title="Share rank"
                            >
                              📤
                            </button>
                          </div>
                        </div>

                        {/* Address */}
                        <p className="rank-address">📍 {rank.address}</p>

                        {/* Stats */}
                        <div className="rank-stats">
                          {stats.routes > 0 && (
                            <span className="stat-item">
                              🛣️ {stats.routes} route{stats.routes !== 1 ? 's' : ''}
                            </span>
                          )}
                          {stats.aisles > 0 && (
                            <span className="stat-item">
                              🚦 {stats.aisles} aisle{stats.aisles !== 1 ? 's' : ''}
                            </span>
                          )}
                          {stats.capacity > 0 && (
                            <span className="stat-item">
                              👥 Capacity: {stats.capacity}
                            </span>
                          )}
                        </div>

                        {/* Destinations */}
                        {rank.destinations && rank.destinations.length > 0 && (
                          <div className="rank-destinations">
                            <strong>Popular destinations:</strong>
                            <div className="destination-tags">
                              {rank.destinations.slice(0, 3).map((dest, index) => (
                                <span key={index} className="destination-tag">
                                  {dest}
                                </span>
                              ))}
                              {rank.destinations.length > 3 && (
                                <span className="destination-tag more">
                                  +{rank.destinations.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* View Details Button */}
                        <button
                          className="view-details-btn"
                          onClick={() => setSelectedRank(rank)}
                        >
                          View Full Details →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rank Details Modal */}
      {selectedRank && (
        <div className="rank-details-modal" onClick={() => setSelectedRank(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-btn"
              onClick={() => setSelectedRank(null)}
              title="Close"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="modal-header">
              <h2>{selectedRank.name}</h2>
              {getDistance(selectedRank) && (
                <span className="modal-distance">
                  {getDistance(selectedRank)} km away
                </span>
              )}
            </div>

            <p className="modal-address">📍 {selectedRank.address}</p>

            {/* Description */}
            {selectedRank.description && (
              <div className="modal-section">
                <h3>📝 About</h3>
                <p>{selectedRank.description}</p>
              </div>
            )}

            {/* All Destinations */}
            {selectedRank.destinations && selectedRank.destinations.length > 0 && (
              <div className="modal-section">
                <h3>🎯 Destinations</h3>
                <div className="modal-tags">
                  {selectedRank.destinations.map((dest, index) => (
                    <span key={index} className="modal-tag">
                      {dest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Aisles/Lanes */}
            {selectedRank.aisles && selectedRank.aisles.length > 0 && (
              <div className="modal-section">
                <h3>🚦 Aisles & Routes</h3>
                {selectedRank.aisles.map((aisle, index) => (
                  <div key={index} className="aisle-item">
                    <div className="aisle-header">
                      <span className="aisle-number">Aisle {aisle.aisleNumber || index + 1}</span>
                      <span className="aisle-name">{aisle.name}</span>
                    </div>
                    {aisle.capacity && (
                      <p className="aisle-capacity">👥 Capacity: {aisle.capacity} taxis</p>
                    )}
                    {aisle.routes && aisle.routes.length > 0 && (
                      <div className="aisle-routes">
                        <strong>Routes:</strong>
                        <div className="route-list">
                          {aisle.routes.map((route, idx) => (
                            <span key={idx} className="route-item">
                              → {route}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Rank Stats */}
            <div className="modal-section">
              <h3>📊 Information</h3>
              <div className="modal-stats">
                {selectedRank.capacity && (
                  <div className="modal-stat">
                    <span className="stat-label">Total Capacity:</span>
                    <span className="stat-value">{selectedRank.capacity} taxis</span>
                  </div>
                )}
                {selectedRank.aisles && selectedRank.aisles.length > 0 && (
                  <div className="modal-stat">
                    <span className="stat-label">Number of Aisles:</span>
                    <span className="stat-value">{selectedRank.aisles.length}</span>
                  </div>
                )}
                <div className="modal-stat">
                  <span className="stat-label">Total Routes:</span>
                  <span className="stat-value">{getTotalRoutes(selectedRank)}</span>
                </div>
                {selectedRank.createdAt && (
                  <div className="modal-stat">
                    <span className="stat-label">Added:</span>
                    <span className="stat-value">
                      {selectedRank.createdAt.toDate().toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button
                className="directions-btn primary"
                onClick={() => openInMaps(selectedRank)}
              >
                <span>🗺️</span>
                Get Directions
              </button>
              <button
                className="directions-btn secondary"
                onClick={() => shareRank(selectedRank)}
              >
                <span>📤</span>
                Share
              </button>
              <button
                className={`directions-btn secondary ${favorites.includes(selectedRank.id) ? 'favorite-active' : ''}`}
                onClick={() => toggleFavorite(selectedRank.id)}
              >
                <span>{favorites.includes(selectedRank.id) ? '⭐' : '☆'}</span>
                {favorites.includes(selectedRank.id) ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserApp;
