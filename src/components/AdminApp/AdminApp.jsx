/* Enhanced AdminApp.jsx - Advanced Admin Interface with Taxi Rank Management */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, updateDoc, doc, 
  orderBy, Timestamp, deleteDoc, limit, getDoc, setDoc 
} from 'firebase/firestore';
import './AdminApp.css';

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'marshalls', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profile = docSnap.data();

            if (profile.role !== 'Admin') {
              setError('Access denied. Admin privileges required.');
              setAdminProfile(null);
              setLoading(false);
              return;
            }

            if (profile.suspended) {
              setError('Your account has been suspended. Please contact another administrator.');
              await signOut(auth);
              setAdminProfile(null);
              setLoading(false);
              return;
            }

            setAdminProfile({
              ...profile,
              docId: docSnap.id
            });
          } else {
            setError('Admin profile not found.');
            setAdminProfile(null);
          }
        } catch (error) {
          console.error('Error fetching admin profile:', error);
          setError('Failed to load admin profile.');
          setAdminProfile(null);
        }
      } else {
        setAdminProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        action: 'admin_logout',
        email: user.email,
        timestamp: Timestamp.now(),
        success: true
      });

      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="admin-app">
        <div className="login-container">
          <div className="loading-spinner"></div>
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || !adminProfile) {
    return (
      <div className="admin-app">
        <header className="admin-header">
          <Link to="/" className="back-btn">← Back to Home</Link>
          <h1>🛡️ TaxiHub Admin Panel 🔐</h1>
        </header>

        <div className="login-container">
          <div className="login-box">
            <div className="login-icon">🚫</div>
            <h2>Access Denied</h2>
            <p className="login-subtitle">
              {error || 'You do not have permission to access the admin panel.'}
            </p>
            <Link to="/marshal" className="back-to-marshal-btn">
              Go to Marshal Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard user={user} adminProfile={adminProfile} onLogout={handleLogout} />;
}

function AdminDashboard({ user, adminProfile, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedMarshals, setApprovedMarshals] = useState([]);
  const [taxiRanks, setTaxiRanks] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPendingUsers(),
        loadApprovedMarshals(),
        loadTaxiRanks(),
        loadActivityLogs(),
        loadReports()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadPendingUsers = async () => {
    try {
      const q = query(collection(db, 'marshalls'), where('approved', '==', false));
      const querySnapshot = await getDocs(q);
      const pending = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingUsers(pending);
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  };

  const loadApprovedMarshals = async () => {
    try {
      const q = query(
        collection(db, 'marshalls'),
        where('approved', '==', true),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const approved = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApprovedMarshals(approved);
    } catch (error) {
      console.error('Error loading approved marshals:', error);
    }
  };

  const loadTaxiRanks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'taxiRanks'));
      const ranksList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTaxiRanks(ranksList);
    } catch (error) {
      console.error('Error loading taxi ranks:', error);
    }
  };

  const loadActivityLogs = async () => {
    try {
      const q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActivityLogs(logs);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  };

  const loadReports = async () => {
    try {
      const reportsData = {
        totalUsers: approvedMarshals.length + pendingUsers.length,
        approvedUsers: approvedMarshals.length,
        pendingUsers: pendingUsers.length,
        totalRanks: taxiRanks.length,
        activeAdmins: approvedMarshals.filter(m => m.role === 'Admin' && !m.suspended).length,
        activeSupervisors: approvedMarshals.filter(m => m.role === 'Supervisor' && !m.suspended).length,
        activeMarshals: approvedMarshals.filter(m => m.role === 'Marshal' && !m.suspended).length,
        suspendedUsers: approvedMarshals.filter(m => m.suspended).length
      };
      setReports(reportsData);
    } catch (error) {
      console.error('Error generating reports:', error);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="logo-icon">🚕</div>
          <h2>TaxiHub Admin</h2>
        </div>

        <nav className="admin-menu">
          <ul>
            <li>
              <a 
                href="#overview" 
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
              >
                <span className="admin-menu-icon">📊</span>
                Overview
              </a>
            </li>
            <li>
              <a 
                href="#users" 
                className={activeTab === 'users' ? 'active' : ''}
                onClick={() => setActiveTab('users')}
              >
                <span className="admin-menu-icon">👥</span>
                User Management
                {pendingUsers.length > 0 && (
                  <span className="admin-menu-badge">{pendingUsers.length}</span>
                )}
              </a>
            </li>
            <li>
              <a 
                href="#ranks" 
                className={activeTab === 'ranks' ? 'active' : ''}
                onClick={() => setActiveTab('ranks')}
              >
                <span className="admin-menu-icon">🚖</span>
                Taxi Ranks
              </a>
            </li>
            <li>
              <a 
                href="#activity" 
                className={activeTab === 'activity' ? 'active' : ''}
                onClick={() => setActiveTab('activity')}
              >
                <span className="admin-menu-icon">📋</span>
                Activity Logs
              </a>
            </li>
            <li>
              <a 
                href="#reports" 
                className={activeTab === 'reports' ? 'active' : ''}
                onClick={() => setActiveTab('reports')}
              >
                <span className="admin-menu-icon">📈</span>
                Reports
              </a>
            </li>
            <li>
              <a 
                href="#settings" 
                className={activeTab === 'settings' ? 'active' : ''}
                onClick={() => setActiveTab('settings')}
              >
                <span className="admin-menu-icon">⚙️</span>
                Settings
              </a>
            </li>
          </ul>
        </nav>

        <div className="admin-profile-section">
          <div className="admin-profile-info">
            <div className="admin-avatar">
              {adminProfile.fullName?.charAt(0) || '👤'}
            </div>
            <div>
              <div className="admin-profile-name">{adminProfile.fullName || 'Admin'}</div>
              <div className="admin-profile-role">{adminProfile.role}</div>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Notification */}
        {notification && (
          <div className={`admin-notification ${notification.type}`}>
            <div className="admin-notification-header">
              <span className="admin-notification-title">
                {notification.type === 'success' ? '✅ Success' : '❌ Error'}
              </span>
              <button 
                className="admin-notification-close"
                onClick={() => setNotification(null)}
              >
                ×
              </button>
            </div>
            <p className="admin-notification-message">{notification.message}</p>
          </div>
        )}

        {/* Page Header */}
        <div className="admin-page-header">
          <h1 className="admin-page-title">
            {activeTab === 'overview' && '📊 Dashboard Overview'}
            {activeTab === 'users' && '👥 User Management'}
            {activeTab === 'ranks' && '🚖 Taxi Rank Management'}
            {activeTab === 'activity' && '📋 Activity Logs'}
            {activeTab === 'reports' && '📈 System Reports'}
            {activeTab === 'settings' && '⚙️ Settings'}
          </h1>
          <div className="admin-breadcrumb">
            <a href="#home">Home</a>
            <span>/</span>
            <span>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewPanel 
            reports={reports} 
            pendingUsers={pendingUsers}
            taxiRanks={taxiRanks}
            activityLogs={activityLogs}
          />
        )}

        {activeTab === 'users' && (
          <UserManagementPanel 
            pendingUsers={pendingUsers}
            approvedMarshals={approvedMarshals}
            onUpdate={loadData}
            showNotification={showNotification}
            adminEmail={user.email}
          />
        )}

        {activeTab === 'ranks' && (
          <TaxiRankManagementPanel 
            taxiRanks={taxiRanks}
            onUpdate={loadData}
            showNotification={showNotification}
            adminEmail={user.email}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLogsPanel activityLogs={activityLogs} />
        )}

        {activeTab === 'reports' && (
          <ReportsPanel reports={reports} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel 
            adminProfile={adminProfile}
            showNotification={showNotification}
          />
        )}
      </main>
    </div>
  );
}

// Overview Panel Component
function OverviewPanel({ reports, pendingUsers, taxiRanks, activityLogs }) {
  return (
    <div className="overview-panel">
      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-title">Total Users</div>
            <div className="admin-stat-icon">👥</div>
          </div>
          <div className="admin-stat-value">{reports.totalUsers || 0}</div>
          <div className="admin-stat-footer">
            {reports.pendingUsers > 0 && (
              <span className="admin-stat-change positive">
                +{reports.pendingUsers} pending approval
              </span>
            )}
          </div>
        </div>

        <div className="admin-stat-card success">
          <div className="admin-stat-header">
            <div className="admin-stat-title">Active Marshals</div>
            <div className="admin-stat-icon">🎯</div>
          </div>
          <div className="admin-stat-value">{reports.activeMarshals || 0}</div>
          <div className="admin-stat-footer">
            Operational staff
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-title">Taxi Ranks</div>
            <div className="admin-stat-icon">🚖</div>
          </div>
          <div className="admin-stat-value">{reports.totalRanks || 0}</div>
          <div className="admin-stat-footer">
            Registered locations
          </div>
        </div>

        <div className="admin-stat-card danger">
          <div className="admin-stat-header">
            <div className="admin-stat-title">Suspended</div>
            <div className="admin-stat-icon">⛔</div>
          </div>
          <div className="admin-stat-value">{reports.suspendedUsers || 0}</div>
          <div className="admin-stat-footer">
            Inactive accounts
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="admin-activity-feed">
        <h3>📋 Recent Activity</h3>
        <div className="activity-list">
          {activityLogs.slice(0, 5).map(log => (
            <div key={log.id} className="activity-item">
              <div className="activity-icon">
                {getActionIcon(log.action)}
              </div>
              <div className="activity-content">
                <div className="activity-title">{log.action.replace(/_/g, ' ')}</div>
                <div className="activity-meta">
                  {log.performedBy || 'System'} • {log.timestamp?.toDate().toLocaleString() || 'Unknown'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="action-grid">
          <button className="action-btn">
            <span>👥</span>
            <span>Approve Pending Users</span>
          </button>
          <button className="action-btn">
            <span>🚖</span>
            <span>Add New Taxi Rank</span>
          </button>
          <button className="action-btn">
            <span>📊</span>
            <span>Generate Report</span>
          </button>
          <button className="action-btn">
            <span>📋</span>
            <span>View All Logs</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// User Management Panel Component
function UserManagementPanel({ pendingUsers, approvedMarshals, onUpdate, showNotification, adminEmail }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const handleApproveUser = async (userId, userEmail) => {
    try {
      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        approved: true,
        approvedAt: Timestamp.now(),
        approvedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_approved',
        targetUser: userEmail,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`User ${userEmail} approved successfully!`);
      onUpdate();
    } catch (error) {
      console.error('Error approving user:', error);
      showNotification('Failed to approve user', 'error');
    }
  };

  const handleRejectUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to reject ${userEmail}?`)) return;

    try {
      await deleteDoc(doc(db, 'marshalls', userId));

      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_rejected',
        targetUser: userEmail,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`User ${userEmail} rejected`);
      onUpdate();
    } catch (error) {
      console.error('Error rejecting user:', error);
      showNotification('Failed to reject user', 'error');
    }
  };

  const handleSuspendUser = async (userId, userEmail, currentStatus) => {
    try {
      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        suspended: !currentStatus,
        suspendedAt: !currentStatus ? Timestamp.now() : null,
        suspendedBy: !currentStatus ? adminEmail : null
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: currentStatus ? 'user_unsuspended' : 'user_suspended',
        targetUser: userEmail,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`User ${currentStatus ? 'unsuspended' : 'suspended'} successfully!`);
      onUpdate();
    } catch (error) {
      console.error('Error updating user suspension:', error);
      showNotification('Failed to update user status', 'error');
    }
  };

  const handleChangeRole = async (newRole) => {
    if (!selectedUser) return;

    try {
      const userRef = doc(db, 'marshalls', selectedUser.id);
      await updateDoc(userRef, {
        role: newRole,
        roleUpdatedAt: Timestamp.now(),
        roleUpdatedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'role_changed',
        targetUser: selectedUser.email,
        oldRole: selectedUser.role,
        newRole: newRole,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Role updated to ${newRole} successfully!`);
      setShowRoleModal(false);
      setSelectedUser(null);
      onUpdate();
    } catch (error) {
      console.error('Error changing role:', error);
      showNotification('Failed to change role', 'error');
    }
  };

  const filteredUsers = approvedMarshals.filter(user => {
    const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && !user.suspended) ||
                         (filterStatus === 'suspended' && user.suspended);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="user-management-panel">
      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="admin-users-container">
          <h3 className="admin-users-title">
            ⏳ Pending Approvals ({pendingUsers.length})
          </h3>
          <div className="admin-user-grid">
            {pendingUsers.map(user => (
              <div key={user.id} className="admin-user-card pending">
                <div className="admin-user-header">
                  <div className="admin-user-avatar">
                    {user.fullName?.charAt(0) || '👤'}
                  </div>
                  <div className="admin-user-info">
                    <h4>{user.fullName || 'Unknown'}</h4>
                    <p>{user.email}</p>
                  </div>
                </div>
                <div className="admin-user-details">
                  <div className="detail-item">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value">{user.role}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{user.phoneNumber || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Requested:</span>
                    <span className="detail-value">
                      {user.createdAt?.toDate().toLocaleDateString() || 'Unknown'}
                    </span>
                  </div>
                </div>
                <div className="admin-user-actions">
                  <button 
                    className="approve-btn"
                    onClick={() => handleApproveUser(user.id, user.email)}
                  >
                    ✅ Approve
                  </button>
                  <button 
                    className="reject-btn"
                    onClick={() => handleRejectUser(user.id, user.email)}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Users */}
      <div className="admin-users-container">
        <div className="admin-users-header">
          <h3 className="admin-users-title">
            ✅ Approved Users ({filteredUsers.length})
          </h3>
          <div className="admin-users-actions">
            <div className="admin-search-bar">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="admin-filter-btn"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="Admin">Admins</option>
              <option value="Supervisor">Supervisors</option>
              <option value="Marshal">Marshals</option>
            </select>
            <select 
              className="admin-filter-btn"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="admin-user-grid">
          {filteredUsers.map(user => (
            <div key={user.id} className={`admin-user-card ${user.suspended ? 'suspended' : ''}`}>
              <div className="admin-user-header">
                <div className="admin-user-avatar">
                  {user.fullName?.charAt(0) || '👤'}
                </div>
                <div className="admin-user-info">
                  <h4>{user.fullName || 'Unknown'}</h4>
                  <p>{user.email}</p>
                  <span className={`role-badge ${user.role.toLowerCase()}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <div className="admin-user-details">
                <div className="detail-item">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">{user.phoneNumber || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Rank:</span>
                  <span className="detail-value">{user.rankName || 'Unassigned'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className={`status-badge ${user.suspended ? 'suspended' : 'active'}`}>
                    {user.suspended ? '⛔ Suspended' : '✅ Active'}
                  </span>
                </div>
              </div>
              <div className="admin-user-actions">
                <button 
                  className="role-btn"
                  onClick={() => {
                    setSelectedUser(user);
                    setShowRoleModal(true);
                  }}
                >
                  👑 Change Role
                </button>
                <button 
                  className={user.suspended ? 'unsuspend-btn' : 'suspend-btn'}
                  onClick={() => handleSuspendUser(user.id, user.email, user.suspended)}
                >
                  {user.suspended ? '✅ Unsuspend' : '⛔ Suspend'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Change Role for {selectedUser.fullName}</h3>
              <button 
                className="admin-role-modal-close"
                onClick={() => setShowRoleModal(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-role-options">
              <div 
                className={`admin-role-option ${selectedUser.role === 'Admin' ? 'selected' : ''}`}
                onClick={() => handleChangeRole('Admin')}
              >
                <div className="admin-role-option-header">
                  <div className="admin-role-option-icon admin">👑</div>
                  <div>
                    <div className="admin-role-option-title">Admin</div>
                    <div className="admin-role-option-description">
                      Full system access and control
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className={`admin-role-option ${selectedUser.role === 'Supervisor' ? 'selected' : ''}`}
                onClick={() => handleChangeRole('Supervisor')}
              >
                <div className="admin-role-option-header">
                  <div className="admin-role-option-icon supervisor">👔</div>
                  <div>
                    <div className="admin-role-option-title">Supervisor</div>
                    <div className="admin-role-option-description">
                      Manage marshals and oversee operations
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className={`admin-role-option ${selectedUser.role === 'Marshal' ? 'selected' : ''}`}
                onClick={() => handleChangeRole('Marshal')}
              >
                <div className="admin-role-option-header">
                  <div className="admin-role-option-icon marshal">🎯</div>
                  <div>
                    <div className="admin-role-option-title">Marshal</div>
                    <div className="admin-role-option-description">
                      Basic operational staff access
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// NEW: Taxi Rank Management Panel with CRUD Operations
function TaxiRankManagementPanel({ taxiRanks, onUpdate, showNotification, adminEmail }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRank, setSelectedRank] = useState(null);
  const [availableMarshals, setAvailableMarshals] = useState([]);
  const [assignedMarshals, setAssignedMarshals] = useState([]);
  const [showMarshalModal, setShowMarshalModal] = useState(false);
  const [selectedRankForAssignment, setSelectedRankForAssignment] = useState(null);
  const [showFareModal, setShowFareModal] = useState(false);
  const [editingFare, setEditingFare] = useState(null);
  const [fareFormData, setFareFormData] = useState({
    route: '',
    price: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: '',
    province: '',
    city: '',
    coordinates: {
      latitude: '',
      longitude: ''
    },
    operatingHours: {
      opening: '06:00',
      closing: '20:00'
    },
    facilities: [],
    status: 'active',
    fares: []
  });

  const facilities = ['Shelter', 'Restrooms', 'Security', 'CCTV', 'Parking', 'Lighting'];

  useEffect(() => {
    loadAvailableMarshals();
  }, []);

  const loadAvailableMarshals = async () => {
    try {
      const q = query(
        collection(db, 'marshalls'),
        where('approved', '==', true),
        where('role', '==', 'Marshal'),
        where('suspended', '==', false)
      );
      const querySnapshot = await getDocs(q);
      const marshals = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableMarshals(marshals);
    } catch (error) {
      console.error('Error loading marshals:', error);
    }
  };

  const loadAssignedMarshals = async (rankId) => {
    try {
      const assigned = availableMarshals.filter(marshal =>
        marshal.assignedRankId === rankId
      );
      setAssignedMarshals(assigned);
    } catch (error) {
      console.error('Error loading assigned marshals:', error);
    }
  };

  const handleAssignMarshal = async (marshalId, marshalName, rankName) => {
    try {
      const marshalRef = doc(db, 'marshalls', marshalId);
      await updateDoc(marshalRef, {
        assignedRankId: selectedRank.id,
        assignedRankName: rankName,
        assignedAt: Timestamp.now(),
        assignedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'marshal_assigned',
        marshalName: marshalName,
        rankName: rankName,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Marshal ${marshalName} assigned to ${rankName} successfully!`);
      loadAvailableMarshals();
      loadAssignedMarshals(selectedRank.id);
    } catch (error) {
      console.error('Error assigning marshal:', error);
      showNotification('Failed to assign marshal', 'error');
    }
  };

  const handleUnassignMarshal = async (marshalId, marshalName, rankName) => {
    try {
      const marshalRef = doc(db, 'marshalls', marshalId);
      await updateDoc(marshalRef, {
        assignedRankId: null,
        assignedRankName: null,
        assignedAt: null,
        assignedBy: null
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'marshal_unassigned',
        marshalName: marshalName,
        rankName: rankName,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Marshal ${marshalName} unassigned from ${rankName} successfully!`);
      loadAvailableMarshals();
      loadAssignedMarshals(selectedRank.id);
    } catch (error) {
      console.error('Error unassigning marshal:', error);
      showNotification('Failed to unassign marshal', 'error');
    }
  };

  const openMarshalAssignmentModal = (rank) => {
    setSelectedRank(rank);
    setSelectedRankForAssignment(rank);
    loadAssignedMarshals(rank.id);
    setShowMarshalModal(true);
  };

  const openFareManagementModal = (rank) => {
    setSelectedRank(rank);
    setFareFormData({
      route: '',
      price: ''
    });
    setEditingFare(null);
    setShowFareModal(true);
  };

  const handleAddFare = async () => {
    if (!selectedRank) return;

    try {
      const rankRef = doc(db, 'taxiRanks', selectedRank.id);
      const newFare = {
        id: Date.now().toString(),
        route: fareFormData.route,
        price: parseFloat(fareFormData.price)
      };
      const updatedFares = [...(selectedRank.fares || []), newFare];

      await updateDoc(rankRef, {
        fares: updatedFares,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'fare_added',
        rankName: selectedRank.name,
        route: fareFormData.route,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Fare added to ${selectedRank.name} successfully!`);
      setFareFormData({ route: '', price: '' });
      onUpdate();
    } catch (error) {
      console.error('Error adding fare:', error);
      showNotification('Failed to add fare', 'error');
    }
  };

  const handleEditFare = async () => {
    if (!selectedRank || !editingFare) return;

    try {
      const rankRef = doc(db, 'taxiRanks', selectedRank.id);
      const updatedFares = (selectedRank.fares || []).map(fare =>
        fare.id === editingFare.id ? { ...fare, route: fareFormData.route, price: parseFloat(fareFormData.price) } : fare
      );

      await updateDoc(rankRef, {
        fares: updatedFares,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'fare_updated',
        rankName: selectedRank.name,
        route: fareFormData.route,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Fare updated successfully!`);
      setEditingFare(null);
      setFareFormData({ route: '', price: '' });
      onUpdate();
    } catch (error) {
      console.error('Error updating fare:', error);
      showNotification('Failed to update fare', 'error');
    }
  };

  const handleDeleteFare = async (fareId, route) => {
    if (!selectedRank) return;

    try {
      const rankRef = doc(db, 'taxiRanks', selectedRank.id);
      const updatedFares = (selectedRank.fares || []).filter(fare => fare.id !== fareId);

      await updateDoc(rankRef, {
        fares: updatedFares,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail
      });

      await addDoc(collection(db, 'activityLogs'), {
        action: 'fare_deleted',
        rankName: selectedRank.name,
        route: route,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Fare deleted successfully!`);
      onUpdate();
    } catch (error) {
      console.error('Error deleting fare:', error);
      showNotification('Failed to delete fare', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      capacity: '',
      province: '',
      city: '',
      coordinates: {
        latitude: '',
        longitude: ''
      },
      operatingHours: {
        opening: '06:00',
        closing: '20:00'
      },
      facilities: [],
      status: 'active'
    });
  };

  const handleAddRank = async (e) => {
    e.preventDefault();
    
    try {
      const rankData = {
        ...formData,
        capacity: parseInt(formData.capacity) || 0,
        coordinates: {
          latitude: parseFloat(formData.coordinates.latitude) || 0,
          longitude: parseFloat(formData.coordinates.longitude) || 0
        },
        createdAt: Timestamp.now(),
        createdBy: adminEmail,
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'taxiRanks'), rankData);

      await addDoc(collection(db, 'activityLogs'), {
        action: 'taxi_rank_created',
        rankName: formData.name,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Taxi rank "${formData.name}" created successfully!`);
      setShowAddModal(false);
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error adding taxi rank:', error);
      showNotification('Failed to create taxi rank', 'error');
    }
  };

  const handleEditRank = async (e) => {
    e.preventDefault();
    if (!selectedRank) return;

    try {
      const rankRef = doc(db, 'taxiRanks', selectedRank.id);
      const updateData = {
        ...formData,
        capacity: parseInt(formData.capacity) || 0,
        coordinates: {
          latitude: parseFloat(formData.coordinates.latitude) || 0,
          longitude: parseFloat(formData.coordinates.longitude) || 0
        },
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail
      };

      await updateDoc(rankRef, updateData);

      await addDoc(collection(db, 'activityLogs'), {
        action: 'taxi_rank_updated',
        rankName: formData.name,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Taxi rank "${formData.name}" updated successfully!`);
      setShowEditModal(false);
      setSelectedRank(null);
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error updating taxi rank:', error);
      showNotification('Failed to update taxi rank', 'error');
    }
  };

  const handleDeleteRank = async (rankId, rankName) => {
    if (!confirm(`Are you sure you want to delete "${rankName}"? This action cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'taxiRanks', rankId));

      await addDoc(collection(db, 'activityLogs'), {
        action: 'taxi_rank_deleted',
        rankName: rankName,
        performedBy: adminEmail,
        timestamp: Timestamp.now()
      });

      showNotification(`Taxi rank "${rankName}" deleted successfully!`);
      onUpdate();
    } catch (error) {
      console.error('Error deleting taxi rank:', error);
      showNotification('Failed to delete taxi rank', 'error');
    }
  };

  const openEditModal = (rank) => {
    setSelectedRank(rank);
    setFormData({
      name: rank.name || '',
      location: rank.location || '',
      capacity: rank.capacity?.toString() || '',
      province: rank.province || '',
      city: rank.city || '',
      coordinates: {
        latitude: rank.coordinates?.latitude?.toString() || '',
        longitude: rank.coordinates?.longitude?.toString() || ''
      },
      operatingHours: {
        opening: rank.operatingHours?.opening || '06:00',
        closing: rank.operatingHours?.closing || '20:00'
      },
      facilities: rank.facilities || [],
      status: rank.status || 'active'
    });
    setShowEditModal(true);
  };

  const toggleFacility = (facility) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...prev.facilities, facility]
    }));
  };

  const filteredRanks = taxiRanks.filter(rank =>
    rank.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rank.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rank.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="taxi-rank-panel">
      <div className="admin-users-container">
        <div className="admin-users-header">
          <h3 className="admin-users-title">
            🚖 Taxi Ranks ({filteredRanks.length})
          </h3>
          <div className="admin-users-actions">
            <div className="admin-search-bar">
              <input
                type="text"
                placeholder="Search taxi ranks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="add-rank-btn"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              ➕ Add New Rank
            </button>
          </div>
        </div>

        {/* Taxi Ranks Grid */}
        <div className="ranks-grid">
          {filteredRanks.map(rank => (
            <div key={rank.id} className="rank-card">
              <div className="card-header">
                <div className="card-icon">🚖</div>
                <div className="card-info">
                  <h4 className="card-title">{rank.name}</h4>
                  <p className="card-subtitle">📍 {rank.location || 'Location not set'}</p>
                </div>
                <span className={`badge badge-${rank.status === 'active' ? 'success' : 'danger'}`}>
                  {rank.status === 'active' ? '✅' : '⛔'} {rank.status || 'Active'}
                </span>
              </div>

              <div className="rank-details">
                <p><strong>City:</strong> {rank.city || 'N/A'}</p>
                <p><strong>Province:</strong> {rank.province || 'N/A'}</p>
                <p><strong>Capacity:</strong> {rank.capacity || 0} taxis</p>
                <p><strong>Operating Hours:</strong> {rank.operatingHours?.opening || '06:00'} - {rank.operatingHours?.closing || '20:00'}</p>

                {rank.facilities && rank.facilities.length > 0 && (
                  <div className="rank-facilities">
                    <strong>Facilities:</strong>
                    <div className="facility-badges">
                      {rank.facilities.map((facility, idx) => (
                        <span key={idx} className="badge badge-info">{facility}</span>
                      ))}
                    </div>
                  </div>
                )}

                {rank.coordinates && (rank.coordinates.latitude || rank.coordinates.longitude) && (
                  <div className="rank-coordinates">
                    <strong>📍 GPS:</strong> {rank.coordinates.latitude?.toFixed(4)}, {rank.coordinates.longitude?.toFixed(4)}
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="assign-marshals-btn"
                  onClick={() => openMarshalAssignmentModal(rank)}
                >
                  👥 Assign Marshals
                </button>
                <button
                  className="manage-fares-btn"
                  onClick={() => openFareManagementModal(rank)}
                >
                  💰 Manage Fares
                </button>
                <button
                  className="edit-rank-btn"
                  onClick={() => openEditModal(rank)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="delete-rank-btn"
                  onClick={() => handleDeleteRank(rank.id, rank.name)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRanks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🚖</div>
            <h3>No Taxi Ranks Found</h3>
            <p>Start by adding a new taxi rank to the system</p>
            <button 
              className="add-rank-btn"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              ➕ Add Your First Rank
            </button>
          </div>
        )}
      </div>

      {/* Add Rank Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>➕ Add New Taxi Rank</h3>
              <button 
                className="admin-role-modal-close"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddRank} className="rank-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Rank Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Sandton Taxi Rank"
                  />
                </div>

                <div className="form-group">
                  <label>Location/Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Corner 5th & Main Street"
                  />
                </div>

                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="e.g., Johannesburg"
                  />
                </div>

                <div className="form-group">
                  <label>Province *</label>
                  <select
                    required
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                  >
                    <option value="">Select Province</option>
                    <option value="Gauteng">Gauteng</option>
                    <option value="Western Cape">Western Cape</option>
                    <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                    <option value="Eastern Cape">Eastern Cape</option>
                    <option value="Limpopo">Limpopo</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                    <option value="North West">North West</option>
                    <option value="Northern Cape">Northern Cape</option>
                    <option value="Free State">Free State</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Capacity (Number of Taxis) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Under Maintenance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Opening Time</label>
                  <input
                    type="time"
                    value={formData.operatingHours.opening}
                    onChange={(e) => setFormData({
                      ...formData,
                      operatingHours: {...formData.operatingHours, opening: e.target.value}
                    })}
                  />
                </div>

                <div className="form-group">
                  <label>Closing Time</label>
                  <input
                    type="time"
                    value={formData.operatingHours.closing}
                    onChange={(e) => setFormData({
                      ...formData,
                      operatingHours: {...formData.operatingHours, closing: e.target.value}
                    })}
                  />
                </div>

                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.latitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      coordinates: {...formData.coordinates, latitude: e.target.value}
                    })}
                    placeholder="e.g., -26.2041"
                  />
                </div>

                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.longitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      coordinates: {...formData.coordinates, longitude: e.target.value}
                    })}
                    placeholder="e.g., 28.0473"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Facilities</label>
                <div className="facilities-checkbox-grid">
                  {facilities.map(facility => (
                    <label key={facility} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.facilities.includes(facility)}
                        onChange={() => toggleFacility(facility)}
                      />
                      <span>{facility}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  ➕ Create Taxi Rank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rank Modal */}
      {showEditModal && selectedRank && (
        <div className="admin-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>✏️ Edit Taxi Rank: {selectedRank.name}</h3>
              <button 
                className="admin-role-modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRank(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditRank} className="rank-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Rank Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Sandton Taxi Rank"
                  />
                </div>

                <div className="form-group">
                  <label>Location/Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Corner 5th & Main Street"
                  />
                </div>

                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="e.g., Johannesburg"
                  />
                </div>

                <div className="form-group">
                  <label>Province *</label>
                  <select
                    required
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                  >
                    <option value="">Select Province</option>
                    <option value="Gauteng">Gauteng</option>
                    <option value="Western Cape">Western Cape</option>
                    <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                    <option value="Eastern Cape">Eastern Cape</option>
                    <option value="Limpopo">Limpopo</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                    <option value="North West">North West</option>
                    <option value="Northern Cape">Northern Cape</option>
                    <option value="Free State">Free State</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Capacity (Number of Taxis) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Under Maintenance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Opening Time</label>
                  <input
                    type="time"
                    value={formData.operatingHours.opening}
                    onChange={(e) => setFormData({
                      ...formData,
                      operatingHours: {...formData.operatingHours, opening: e.target.value}
                    })}
                  />
                </div>

                <div className="form-group">
                  <label>Closing Time</label>
                  <input
                    type="time"
                    value={formData.operatingHours.closing}
                    onChange={(e) => setFormData({
                      ...formData,
                      operatingHours: {...formData.operatingHours, closing: e.target.value}
                    })}
                  />
                </div>

                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.latitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      coordinates: {...formData.coordinates, latitude: e.target.value}
                    })}
                    placeholder="e.g., -26.2041"
                  />
                </div>

                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.longitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      coordinates: {...formData.coordinates, longitude: e.target.value}
                    })}
                    placeholder="e.g., 28.0473"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Facilities</label>
                <div className="facilities-checkbox-grid">
                  {facilities.map(facility => (
                    <label key={facility} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.facilities.includes(facility)}
                        onChange={() => toggleFacility(facility)}
                      />
                      <span>{facility}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRank(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  ✅ Update Taxi Rank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Marshal Assignment Modal */}
      {showMarshalModal && selectedRankForAssignment && (
        <div className="admin-modal-overlay" onClick={() => setShowMarshalModal(false)}>
          <div className="admin-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>👥 Assign Marshals to {selectedRankForAssignment.name}</h3>
              <button
                className="admin-role-modal-close"
                onClick={() => {
                  setShowMarshalModal(false);
                  setSelectedRankForAssignment(null);
                  setAssignedMarshals([]);
                }}
              >
                ×
              </button>
            </div>

            <div className="marshal-assignment-content">
              <div className="marshal-section">
                <h4>Available Marshals</h4>
                <div className="marshal-list">
                  {availableMarshals.filter(marshal => !marshal.assignedRankId).map(marshal => (
                    <div key={marshal.id} className="marshal-item">
                      <div className="marshal-info">
                        <div className="marshal-avatar">
                          {marshal.fullName?.charAt(0) || '👤'}
                        </div>
                        <div>
                          <div className="marshal-name">{marshal.fullName}</div>
                          <div className="marshal-email">{marshal.email}</div>
                        </div>
                      </div>
                      <button
                        className="assign-btn"
                        onClick={() => handleAssignMarshal(marshal.id, marshal.fullName, selectedRankForAssignment.name)}
                      >
                        ➕ Assign
                      </button>
                    </div>
                  ))}
                  {availableMarshals.filter(marshal => !marshal.assignedRankId).length === 0 && (
                    <div className="empty-marshals">
                      <p>No available marshals to assign</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="marshal-section">
                <h4>Assigned Marshals ({assignedMarshals.length})</h4>
                <div className="marshal-list">
                  {assignedMarshals.map(marshal => (
                    <div key={marshal.id} className="marshal-item assigned">
                      <div className="marshal-info">
                        <div className="marshal-avatar">
                          {marshal.fullName?.charAt(0) || '👤'}
                        </div>
                        <div>
                          <div className="marshal-name">{marshal.fullName}</div>
                          <div className="marshal-email">{marshal.email}</div>
                          <div className="marshal-assigned-date">
                            Assigned: {marshal.assignedAt?.toDate().toLocaleDateString() || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <button
                        className="unassign-btn"
                        onClick={() => handleUnassignMarshal(marshal.id, marshal.fullName, selectedRankForAssignment.name)}
                      >
                        ➖ Unassign
                      </button>
                    </div>
                  ))}
                  {assignedMarshals.length === 0 && (
                    <div className="empty-marshals">
                      <p>No marshals assigned to this rank</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fare Management Modal */}
      {showFareModal && selectedRank && (
        <div className="admin-modal-overlay" onClick={() => setShowFareModal(false)}>
          <div className="admin-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>💰 Manage Fares for {selectedRank.name}</h3>
              <button
                className="admin-role-modal-close"
                onClick={() => {
                  setShowFareModal(false);
                  setSelectedRank(null);
                  setFareFormData({ route: '', price: '' });
                  setEditingFare(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="fare-management-content">
              <div className="fare-section">
                <h4>Current Fares</h4>
                <div className="fare-list">
                  {(selectedRank.fares || []).map(fare => (
                    <div key={fare.id} className="fare-item">
                      <div className="fare-info">
                        <div className="fare-route">{fare.route}</div>
                        <div className="fare-price">R{fare.price?.toFixed(2)}</div>
                      </div>
                      <div className="fare-actions">
                        <button
                          className="edit-fare-btn"
                          onClick={() => {
                            setEditingFare(fare);
                            setFareFormData({ route: fare.route, price: fare.price.toString() });
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="delete-fare-btn"
                          onClick={() => handleDeleteFare(fare.id, fare.route)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {(selectedRank.fares || []).length === 0 && (
                    <div className="empty-fares">
                      <p>No fares set for this rank</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="fare-section">
                <h4>{editingFare ? 'Edit Fare' : 'Add New Fare'}</h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingFare) {
                      handleEditFare();
                    } else {
                      handleAddFare();
                    }
                  }}
                  className="fare-form"
                >
                  <div className="form-group">
                    <label>Route *</label>
                    <input
                      type="text"
                      required
                      value={fareFormData.route}
                      onChange={(e) => setFareFormData({...fareFormData, route: e.target.value})}
                      placeholder="e.g., Sandton to Johannesburg CBD"
                    />
                  </div>

                  <div className="form-group">
                    <label>Price (R) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      value={fareFormData.price}
                      onChange={(e) => setFareFormData({...fareFormData, price: e.target.value})}
                      placeholder="e.g., 25.00"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => {
                        setEditingFare(null);
                        setFareFormData({ route: '', price: '' });
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="submit-btn">
                      {editingFare ? '✅ Update Fare' : '➕ Add Fare'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Activity Logs Panel Component
function ActivityLogsPanel({ activityLogs }) {
  const [filterAction, setFilterAction] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = activityLogs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesSearch = log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.performedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.targetUser?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const getActionIcon = (action) => {
    const icons = {
      'user_approved': '✅',
      'user_rejected': '❌',
      'user_suspended': '⛔',
      'user_unsuspended': '✅',
      'role_changed': '👑',
      'taxi_rank_created': '➕',
      'taxi_rank_updated': '✏️',
      'taxi_rank_deleted': '🗑️',
      'admin_login': '🔐',
      'admin_logout': '🚪'
    };
    return icons[action] || '📋';
  };

  const getActionDescription = (log) => {
    if (log.action === 'role_changed') {
      return `${log.targetUser} role changed from ${log.oldRole} to ${log.newRole}`;
    }
    if (log.action === 'taxi_rank_created') {
      return `New taxi rank "${log.rankName}" was created`;
    }
    if (log.action === 'taxi_rank_updated') {
      return `Taxi rank "${log.rankName}" was updated`;
    }
    if (log.action === 'taxi_rank_deleted') {
      return `Taxi rank "${log.rankName}" was deleted`;
    }
    if (log.targetUser) {
      return `Action performed on ${log.targetUser}`;
    }
    return log.description || 'Activity logged';
  };

  return (
    <div className="activity-logs-panel">
      <div className="admin-users-container">
        <div className="admin-users-header">
          <h3 className="admin-users-title">
            📋 Activity Logs ({filteredLogs.length})
          </h3>
          <div className="admin-users-actions">
            <div className="admin-search-bar">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="admin-filter-btn"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="user_approved">User Approved</option>
              <option value="user_rejected">User Rejected</option>
              <option value="user_suspended">User Suspended</option>
              <option value="role_changed">Role Changed</option>
              <option value="taxi_rank_created">Rank Created</option>
              <option value="taxi_rank_updated">Rank Updated</option>
              <option value="taxi_rank_deleted">Rank Deleted</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Description</th>
                <th>Performed By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td>
                    <span className="action-icon">{getActionIcon(log.action)}</span>
                    <span className="action-text">{log.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{getActionDescription(log)}</td>
                  <td>{log.performedBy || 'System'}</td>
                  <td>
                    {log.timestamp?.toDate().toLocaleString() || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="empty-state">
            <p>No activity logs found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Reports Panel Component
function ReportsPanel({ reports }) {
  const [reportType, setReportType] = useState('summary');

  const generateDetailedReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      period: 'All Time',
      summary: reports,
      recommendations: []
    };

    if (reports.pendingUsers > 0) {
      report.recommendations.push('Review pending user approvals');
    }

    if (reports.suspendedUsers > 0) {
      report.recommendations.push('Review suspended user accounts');
    }

    if (reports.activeMarshals === 0) {
      report.recommendations.push('Assign marshals to taxi ranks');
    }

    if (reports.totalRanks === 0) {
      report.recommendations.push('Create taxi ranks for marshal assignments');
    }

    return report;
  };

  const detailedReport = generateDetailedReport();

  return (
    <div className="reports-panel">
      <h2>📈 System Reports</h2>

      <div className="report-selector">
        <button
          className={reportType === 'summary' ? 'active' : ''}
          onClick={() => setReportType('summary')}
        >
          📊 Summary Report
        </button>
        <button
          className={reportType === 'detailed' ? 'active' : ''}
          onClick={() => setReportType('detailed')}
        >
          📋 Detailed Report
        </button>
      </div>

      {reportType === 'summary' && (
        <div className="report-content">
          <div className="report-header">
            <h3>System Summary Report</h3>
            <p>Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <div className="report-stats">
            <div className="stat-section">
              <h4>👥 User Statistics</h4>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Users:</span>
                  <span className="stat-value">{reports.totalUsers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Approved Users:</span>
                  <span className="stat-value">{reports.approvedUsers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Pending Approval:</span>
                  <span className="stat-value">{reports.pendingUsers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Suspended Users:</span>
                  <span className="stat-value">{reports.suspendedUsers}</span>
                </div>
              </div>
            </div>

            <div className="stat-section">
              <h4>🚕 Rank Statistics</h4>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Ranks:</span>
                  <span className="stat-value">{reports.totalRanks}</span>
                </div>
              </div>
            </div>

            <div className="stat-section">
              <h4>👑 Role Distribution</h4>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">Active Admins:</span>
                  <span className="stat-value">{reports.activeAdmins}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Supervisors:</span>
                  <span className="stat-value">{reports.activeSupervisors}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Marshals:</span>
                  <span className="stat-value">{reports.activeMarshals}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'detailed' && (
        <div className="report-content">
          <div className="report-header">
            <h3>Detailed System Report</h3>
            <p>Generated on {new Date(detailedReport.generatedAt).toLocaleDateString()}</p>
          </div>

          <div className="detailed-sections">
            <div className="report-section">
              <h4>📊 Current System Status</h4>
              <ul>
                <li><strong>Total Users:</strong> {detailedReport.summary.totalUsers}</li>
                <li><strong>Approved Users:</strong> {detailedReport.summary.approvedUsers}</li>
                <li><strong>Pending Approvals:</strong> {detailedReport.summary.pendingUsers}</li>
                <li><strong>Suspended Users:</strong> {detailedReport.summary.suspendedUsers}</li>
                <li><strong>Total Taxi Ranks:</strong> {detailedReport.summary.totalRanks}</li>
                <li><strong>Active Admins:</strong> {detailedReport.summary.activeAdmins}</li>
                <li><strong>Active Supervisors:</strong> {detailedReport.summary.activeSupervisors}</li>
                <li><strong>Active Marshals:</strong> {detailedReport.summary.activeMarshals}</li>
              </ul>
            </div>

            {detailedReport.recommendations.length > 0 && (
              <div className="report-section">
                <h4>💡 Recommendations</h4>
                <ul>
                  {detailedReport.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="report-section">
              <h4>📈 System Health Indicators</h4>
              <div className="health-indicators">
                <div className="indicator">
                  <span className="indicator-label">User Approval Rate:</span>
                  <span className={`indicator-value ${detailedReport.summary.totalUsers > 0 && detailedReport.summary.pendingUsers / detailedReport.summary.totalUsers < 0.1 ? 'good' : 'warning'}`}>
                    {detailedReport.summary.totalUsers > 0
                      ? `${((detailedReport.summary.approvedUsers / detailedReport.summary.totalUsers) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </span>
                </div>

                <div className="indicator">
                  <span className="indicator-label">Suspension Rate:</span>
                  <span className={`indicator-value ${detailedReport.summary.approvedUsers > 0 && detailedReport.summary.suspendedUsers / detailedReport.summary.approvedUsers < 0.1 ? 'good' : 'warning'}`}>
                    {detailedReport.summary.approvedUsers > 0
                      ? `${((detailedReport.summary.suspendedUsers / detailedReport.summary.approvedUsers) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </span>
                </div>

                <div className="indicator">
                  <span className="indicator-label">Rank Coverage:</span>
                  <span className={`indicator-value ${detailedReport.summary.activeMarshals > 0 && detailedReport.summary.totalRanks > 0 ? 'good' : 'warning'}`}>
                    {detailedReport.summary.activeMarshals > 0 && detailedReport.summary.totalRanks > 0 ? 'Good' : 'Needs Attention'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Settings Panel Component
function SettingsPanel({ adminProfile, showNotification }) {
  return (
    <div className="settings-panel">
      <div className="admin-settings-grid">
        <div className="admin-settings-card">
          <div className="admin-settings-header">
            <div className="admin-settings-icon">👤</div>
            <h3 className="admin-settings-title">Profile Information</h3>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Full Name:</span>
            <span className="admin-settings-value">{adminProfile.fullName || 'N/A'}</span>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Email:</span>
            <span className="admin-settings-value">{adminProfile.email || 'N/A'}</span>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Role:</span>
            <span className="admin-settings-value">{adminProfile.role || 'N/A'}</span>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Phone:</span>
            <span className="admin-settings-value">{adminProfile.phoneNumber || 'N/A'}</span>
          </div>
        </div>

        <div className="admin-settings-card">
          <div className="admin-settings-header">
            <div className="admin-settings-icon">⚙️</div>
            <h3 className="admin-settings-title">System Settings</h3>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Notifications:</span>
            <label className="admin-toggle">
              <input type="checkbox" defaultChecked />
              <span className="admin-toggle-slider"></span>
            </label>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Email Alerts:</span>
            <label className="admin-toggle">
              <input type="checkbox" defaultChecked />
              <span className="admin-toggle-slider"></span>
            </label>
          </div>
          <div className="admin-settings-item">
            <span className="admin-settings-label">Auto-Approve:</span>
            <label className="admin-toggle">
              <input type="checkbox" />
              <span className="admin-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function
function getActionIcon(action) {
  const icons = {
    'user_approved': '✅',
    'user_rejected': '❌',
    'user_suspended': '⛔',
    'user_unsuspended': '✅',
    'role_changed': '👑',
    'taxi_rank_created': '➕',
    'taxi_rank_updated': '✏️',
    'taxi_rank_deleted': '🗑️',
    'admin_login': '🔐',
    'admin_logout': '🚪'
  };
  return icons[action] || '📋';
}

export default AdminApp;