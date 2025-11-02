/* Enhanced MarshalApp.jsx - Professional & Modernized */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, Timestamp, deleteDoc } from 'firebase/firestore';
import storage from '../../services/storage';
import './MarshalApp.css';

function MarshalApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [marshalRank, setMarshalRank] = useState('');
  const [marshalRole, setMarshalRole] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  const [marshalProfile, setMarshalProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        try {
          const q = query(collection(db, 'marshalls'), where('uid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const profile = querySnapshot.docs[0].data();

            // Check if marshal is approved
            if (!profile.approved) {
              setError('Your account is pending admin approval. Please contact an administrator.');
              await signOut(auth);
              setMarshalProfile(null);
              setInitialLoading(false);
              return;
            }

            setMarshalProfile({
              ...profile,
              docId: querySnapshot.docs[0].id
            });
          } else {
            setMarshalProfile(null);
          }
        } catch (error) {
          console.error('Error fetching marshal profile:', error);
          setMarshalProfile(null);
        }
      } else {
        setMarshalProfile(null);
      }
      setInitialLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!marshalRank || !marshalRole) {
      setError('Please select a rank and role');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Determine permissions based on role
      let permissions = ['view', 'record', 'manage']; // Default Marshal permissions
      if (marshalRole === 'Admin') {
        permissions = ['all'];
      } else if (marshalRole === 'Supervisor') {
        permissions = ['view', 'reports'];
      } else if (marshalRole === 'Marshal') {
        permissions = ['view', 'record', 'manage'];
      }

      // Admins are automatically approved, others require admin approval
      const isApproved = marshalRole === 'Admin';

      // Try to create marshal profile with error handling
      try {
        await addDoc(collection(db, 'marshalls'), {
          uid: newUser.uid,
          email: newUser.email,
          rank: marshalRank,
          role: marshalRole,
          permissions: permissions,
          approved: isApproved,
          createdAt: Timestamp.now()
        });
      } catch (firestoreError) {
        console.error('Firestore write error:', firestoreError);

        // If Firestore fails, still allow registration but show warning
        setError('Account created but requires admin approval. Please contact an administrator.');

        // Sign out the user since they need approval
        await signOut(auth);
        setLoading(false);
        return;
      }

      // Allow the user to stay logged in - they can access the system but may have limited functionality until approved
      setIsRegistering(false);
      setEmail('');
      setPassword('');
      setMarshalRank('');
      setMarshalRole('');

      alert('✅ Registration successful! Your account is pending admin approval. You can now log in, but some features may be restricted until an administrator approves your account.');
      
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please login instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError('Registration failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (initialLoading) {
    return (
      <div className="marshal-app">
        <div className="login-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="marshal-app">
        <header className="marshal-header">
          <Link to="/" className="back-btn">← Back to Home</Link>
          <h1>
            {isRegistering ? '🛡️ Marshal Registration' : '🛡️ Queue Marshal Login'}
          </h1>
        </header>

        <div className="login-container">
          <div className="login-box">
            <div className="login-icon">🔐</div>
            <h2>{isRegistering ? 'Register as a Marshal' : 'Sign In'}</h2>
            <p className="login-subtitle">
              {isRegistering ? 'Create your marshal account' : 'Enter your marshal credentials'}
            </p>

            {error && <div className="error-message">{error}</div>}

            {isRegistering ? (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marshal@taxihub.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label>Rank / Station</label>
                  <input
                    type="text"
                    value={marshalRank}
                    onChange={(e) => setMarshalRank(e.target.value)}
                    placeholder="Bree Taxi Rank"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={marshalRole}
                    onChange={(e) => setMarshalRole(e.target.value)}
                    className="select-input"
                    required
                  >
                    <option value="">-- Select Role --</option>
                    <option value="Admin">Admin (Full Access)</option>
                    <option value="Marshal">Marshal (Record & View)</option>
                    <option value="Supervisor">Supervisor (View & Reports)</option>
                  </select>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span> Registering...
                    </>
                  ) : (
                    'Register Account'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marshal@taxihub.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span> Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            )}

            <div 
              className="toggle-link" 
              onClick={() => { 
                setError(''); 
                setIsRegistering(!isRegistering); 
                setEmail('');
                setPassword('');
                setMarshalRank('');
                setMarshalRole('');
              }}
            >
              {isRegistering ? 'Already have an account? Sign In' : 'New marshal? Register here'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <MarshalDashboard user={user} marshalProfile={marshalProfile} onLogout={handleLogout} />;
}

function MarshalDashboard({ user, marshalProfile, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [taxis, setTaxis] = useState([]);
  const [taxiRanks, setTaxiRanks] = useState([]);
  const [loads, setLoads] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedTaxi, setSelectedTaxi] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchReg, setSearchReg] = useState('');
  const [showAddTaxiModal, setShowAddTaxiModal] = useState(false);
  const [showAddRankModal, setShowAddRankModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditTaxiModal, setShowEditTaxiModal] = useState(false);
  const [editingTaxi, setEditingTaxi] = useState(null);
  const [timeFilter, setTimeFilter] = useState('today');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvedMarshals, setApprovedMarshals] = useState([]);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    paidToday: 0,
    totalRevenue: 0,
    pendingPayments: 0
  });

  // Permission checker
  const hasPermission = (action) => {
    if (!marshalProfile) return false;
    if (marshalProfile.permissions?.includes('all')) return true;
    return marshalProfile.permissions?.includes(action) || false;
  };

  useEffect(() => {
    loadTaxis();
    loadTaxiRanks();
    loadLoads();
    loadPayments();
    if (hasPermission('all')) {
      loadPendingUsers();
      loadApprovedMarshals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, marshalProfile]);

  const loadTaxiRanks = async () => {
    try {
      let q = collection(db, 'taxiRanks');

      // Filter by marshal's rank only for supervisors
      if (marshalProfile && marshalProfile.rank && marshalProfile.role === 'Supervisor') {
        q = query(collection(db, 'taxiRanks'), where('name', '==', marshalProfile.rank));
      }

      const querySnapshot = await getDocs(q);
      const ranksList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTaxiRanks(ranksList);
    } catch (error) {
      console.error('Error loading taxi ranks:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let q = query(
        collection(db, 'payments'),
        where('paymentDate', '>=', Timestamp.fromDate(startOfMonth)),
        orderBy('paymentDate', 'desc')
      );

      // Filter by marshal's rank taxis if not admin
      if (marshalProfile && marshalProfile.rank && !hasPermission('all')) {
        const taxisQuery = query(
          collection(db, 'taxis'), 
          where('assignedRank.rankName', '==', marshalProfile.rank)
        );
        const taxisSnapshot = await getDocs(taxisQuery);
        const taxiIds = taxisSnapshot.docs.map(doc => doc.id);

        if (taxiIds.length > 0) {
          const batchSize = 10;
          const batches = [];
          for (let i = 0; i < taxiIds.length; i += batchSize) {
            batches.push(taxiIds.slice(i, i + batchSize));
          }

          const allPayments = [];
          for (const batch of batches) {
            const batchQuery = query(
              collection(db, 'payments'),
              where('paymentDate', '>=', Timestamp.fromDate(startOfMonth)),
              where('taxiId', 'in', batch),
              orderBy('paymentDate', 'desc')
            );
            const batchSnapshot = await getDocs(batchQuery);
            allPayments.push(...batchSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })));
          }
          
          setPayments(allPayments);
          calculateFinances(allPayments);
          return;
        } else {
          setPayments([]);
          calculateFinances([]);
          return;
        }
      }

      const querySnapshot = await getDocs(q);
      const paymentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPayments(paymentsList);
      calculateFinances(paymentsList);
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
      calculateFinances([]);
    }
  };

  const calculateFinances = (paymentsList) => {
    const totalRevenue = paymentsList.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingPayments = taxis.filter(t => !isMembershipValid(t)).length;

    setStats(prev => ({
      ...prev,
      totalRevenue,
      pendingPayments
    }));
  };

  const loadTaxis = async () => {
    try {
      let q = collection(db, 'taxis');
      
      // Filter by marshal's rank if not admin
      if (marshalProfile && marshalProfile.rank && !hasPermission('all')) {
        q = query(
          collection(db, 'taxis'), 
          where('assignedRank.rankName', '==', marshalProfile.rank)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const taxiList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTaxis(taxiList);
      calculateFinances(payments);
      calculateStats(loads, taxiList);
    } catch (error) {
      console.error('Error loading taxis:', error);
    }
  };

  const loadLoads = async () => {
    try {
      let startDate = new Date();

      if (timeFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (timeFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      } else if (timeFilter === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
      }

      let q = query(
        collection(db, 'loads'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      // Filter by marshal's rank taxis if not admin
      if (marshalProfile && marshalProfile.rank && !hasPermission('all')) {
        const taxisQuery = query(
          collection(db, 'taxis'), 
          where('assignedRank.rankName', '==', marshalProfile.rank)
        );
        const taxisSnapshot = await getDocs(taxisQuery);
        const taxiIds = taxisSnapshot.docs.map(doc => doc.id);

        if (taxiIds.length > 0) {
          const batchSize = 10;
          const batches = [];
          for (let i = 0; i < taxiIds.length; i += batchSize) {
            batches.push(taxiIds.slice(i, i + batchSize));
          }

          const allLoads = [];
          for (const batch of batches) {
            const batchQuery = query(
              collection(db, 'loads'),
              where('timestamp', '>=', Timestamp.fromDate(startDate)),
              where('taxiId', 'in', batch),
              orderBy('timestamp', 'desc')
            );
            const batchSnapshot = await getDocs(batchQuery);
            allLoads.push(...batchSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })));
          }
          
          setLoads(allLoads);
          calculateStats(allLoads, taxis);
          await storage.saveQueueData(allLoads);
          return;
        } else {
          setLoads([]);
          calculateStats([], taxis);
          return;
        }
      }

      const querySnapshot = await getDocs(q);
      const loadsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLoads(loadsList);
      calculateStats(loadsList, taxis);
      await storage.saveQueueData(loadsList);
    } catch (error) {
      console.error('Error loading loads:', error);
      setLoads([]);
      calculateStats([], taxis);
    }
  };

  const calculateStats = (loadsList, taxiList = taxis) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayLoads = loadsList.filter(load =>
      load.timestamp?.toDate() >= today
    );

    const weekLoads = loadsList.filter(load =>
      load.timestamp?.toDate() >= weekAgo
    );

    const monthLoads = loadsList.filter(load =>
      load.timestamp?.toDate() >= monthAgo
    );

    const paidToday = todayLoads.filter(load => {
      const taxi = taxiList.find(t => t.id === load.taxiId);
      return isMembershipValid(taxi);
    }).length;

    setStats(prev => ({
      ...prev,
      today: todayLoads.length,
      week: weekLoads.length,
      month: monthLoads.length,
      paidToday: paidToday
    }));
  };

  const loadPendingUsers = async () => {
    setLoadingPending(true);
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
    } finally {
      setLoadingPending(false);
    }
  };

  const loadApprovedMarshals = async () => {
    try {
      const q = query(collection(db, 'marshalls'), where('approved', '==', true));
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

  const approveMarshal = async (marshalId) => {
    try {
      const marshalRef = doc(db, 'marshalls', marshalId);
      await updateDoc(marshalRef, {
        approved: true,
        approvedAt: Timestamp.now(),
        approvedBy: user.email
      });
      alert('✅ Marshal approved successfully!');
      loadPendingUsers();
      loadApprovedMarshals();
    } catch (error) {
      console.error('Error approving marshal:', error);
      alert('❌ Failed to approve marshal');
    }
  };

  const rejectMarshal = async (marshalId) => {
    if (!window.confirm('Are you sure you want to reject this marshal? This will delete their account.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'marshalls', marshalId));
      alert('✅ Marshal rejected and account deleted');
      loadPendingUsers();
    } catch (error) {
      console.error('Error rejecting marshal:', error);
      alert('❌ Failed to reject marshal');
    }
  };

  const recordLoad = async () => {
    if (!selectedTaxi) {
      alert('Please select a taxi');
      return;
    }

    setLoading(true);
    try {
      const taxi = taxis.find(t => t.id === selectedTaxi);
      const nowTimestamp = Timestamp.now();

      await addDoc(collection(db, 'loads'), {
        taxiId: selectedTaxi,
        registration: taxi.registration,
        driverName: taxi.driverName,
        timestamp: nowTimestamp,
        marshalId: user.uid,
        marshalEmail: user.email,
        marshalRank: marshalProfile?.rank || 'Unknown'
      });

      const taxiRef = doc(db, 'taxis', selectedTaxi);
      await updateDoc(taxiRef, {
        totalLoads: (taxi.totalLoads || 0) + 1,
        lastLoad: nowTimestamp
      });

      alert('✅ Load recorded successfully!');
      setSelectedTaxi('');
      loadLoads();
      loadTaxis();
    } catch (error) {
      console.error('Error recording load:', error);
      alert('❌ Failed to record load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTaxi = async (taxiId) => {
    if (!hasPermission('all')) {
      alert('❌ You do not have permission to delete taxis');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this taxi? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'taxis', taxiId));
      alert('✅ Taxi deleted successfully');
      loadTaxis();
    } catch (error) {
      console.error('Error deleting taxi:', error);
      alert('❌ Failed to delete taxi');
    }
  };

  const handleEditTaxi = (taxi) => {
    setEditingTaxi(taxi);
    setShowEditTaxiModal(true);
  };

  const getTaxiLoadsByPeriod = (taxiId) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const taxiLoads = loads.filter(load => load.taxiId === taxiId);

    const dayCount = taxiLoads.filter(load => load.timestamp?.toDate() >= today).length;
    const weekCount = taxiLoads.filter(load => load.timestamp?.toDate() >= weekAgo).length;
    const monthCount = taxiLoads.filter(load => load.timestamp?.toDate() >= monthAgo).length;

    return { dayCount, weekCount, monthCount };
  };

  const getTaxiLoads = (taxiId) => {
    return loads.filter(load => load.taxiId === taxiId).length;
  };

  const isMembershipValid = (taxi) => {
    if (!taxi) return false;
    if (!taxi.membershipPaidUntil) return false;

    const now = new Date();
    const paidUntil = taxi.membershipPaidUntil.toDate ? taxi.membershipPaidUntil.toDate() : new Date(taxi.membershipPaidUntil);

    return (paidUntil.getMonth() === now.getMonth() && paidUntil.getFullYear() === now.getFullYear()) || paidUntil > now;
  };

  const getMembershipStatus = (taxi) => {
    if (!taxi || !taxi.membershipPaidUntil) return 'Not Paid';

    const paidUntil = taxi.membershipPaidUntil.toDate ? taxi.membershipPaidUntil.toDate() : new Date(taxi.membershipPaidUntil);
    const now = new Date();

    if (paidUntil < now) return 'Expired';
    if (paidUntil.getMonth() === now.getMonth() && paidUntil.getFullYear() === now.getFullYear()) {
      return 'Active';
    }
    return 'Expired';
  };

  const filteredTaxis = searchReg
    ? taxis.filter(taxi =>
        taxi.registration.toLowerCase().includes(searchReg.toLowerCase()) ||
        taxi.driverName.toLowerCase().includes(searchReg.toLowerCase())
      )
    : taxis;

  const getDueTaxis = () => taxis.filter(t => !isMembershipValid(t));

  // Tabs configuration with permissions
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', permission: 'view' },
    { id: 'record', label: 'Record Load', icon: '📦', permission: 'record' },
    { id: 'payments', label: 'Payments', icon: '💳', permission: 'manage' }, // Marshals & Admins
    { id: 'history', label: 'History', icon: '📜', permission: 'view' },
    { id: 'taxis', label: 'All Taxis', icon: '🚖', permission: 'view' },
    { id: 'ranks', label: 'Taxi Ranks', icon: '🚏', permission: 'view' },
    { id: 'manage', label: 'Manage', icon: '⚙️', permission: 'manage' }, // Marshals & Admins
    { id: 'reports', label: 'Reports', icon: '📄', permission: 'reports' }, // Supervisors only
    { id: 'admin', label: 'Admin', icon: '👑', permission: 'all' } // Admin only
  ];

  return (
    <div className="marshal-app">
      <header className="marshal-header">
        <div className="header-left">
          <h1>🛡️ Marshal Dashboard</h1>
          <p className="marshal-email">
            {user.email}
            <span className="marshal-role-badge">{marshalProfile?.role || 'Marshal'}</span>
          </p>
        </div>
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <div className="dashboard-container">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🚖</div>
            <div className="stat-content">
              <div className="stat-value">{taxis.length}</div>
              <div className="stat-label">Total Taxis</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-value">{stats.today}</div>
              <div className="stat-label">Today's Loads</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.week}</div>
              <div className="stat-label">This Week</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.month}</div>
              <div className="stat-label">This Month</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">R{(stats.totalRevenue || 0).toFixed(2)}</div>
              <div className="stat-label">Revenue (Month)</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingPayments || 0}</div>
              <div className="stat-label">Pending Payments</div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="tabs">
          {tabs.map(tab => {
            if (!hasPermission(tab.permission)) return null;
            return (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2>Dashboard Overview</h2>
            <OverviewTab stats={stats} taxis={taxis} loads={loads} payments={payments} />
          </div>
        )}

        {activeTab === 'record' && hasPermission('record') && (
          <div className="tab-content">
            <div className="record-section">
              <h2>Record New Load</h2>

              <div className="form-group">
                <label>Select Taxi</label>
                <select
                  value={selectedTaxi}
                  onChange={(e) => setSelectedTaxi(e.target.value)}
                  className="select-input"
                >
                  <option value="">-- Select Taxi --</option>
                  {taxis.map(taxi => {
                    const status = getMembershipStatus(taxi);
                    return (
                      <option key={taxi.id} value={taxi.id}>
                        {taxi.registration} - {taxi.driverName} [{status}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedTaxi && (
                <div className="membership-info">
                  {isMembershipValid(taxis.find(t => t.id === selectedTaxi)) ? (
                    <div className="info-box success">
                      ✅ Membership is valid for this month
                    </div>
                  ) : (
                    <div className="info-box warning">
                      ⚠️ Membership not paid for this month. Please collect payment.
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={recordLoad}
                className="record-btn"
                disabled={loading || !selectedTaxi}
              >
                {loading ? '⏳ Recording...' : '✓ Record Load'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="tab-content">
            <PaymentsTab
              payments={payments}
              taxis={taxis}
              stats={stats}
              getDueTaxis={getDueTaxis}
              getTaxiLoads={getTaxiLoads}
              setShowPaymentModal={setShowPaymentModal}
              hasPermission={hasPermission}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-content">
            <HistoryTab
              loads={loads}
              taxis={taxis}
              isMembershipValid={isMembershipValid}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
            />
          </div>
        )}

        {activeTab === 'taxis' && (
          <div className="tab-content">
            <TaxisTab
              taxis={filteredTaxis}
              searchReg={searchReg}
              setSearchReg={setSearchReg}
              getMembershipStatus={getMembershipStatus}
              getTaxiLoadsByPeriod={getTaxiLoadsByPeriod}
              handleEditTaxi={handleEditTaxi}
              handleDeleteTaxi={handleDeleteTaxi}
              hasPermission={hasPermission}
            />
          </div>
        )}

        {activeTab === 'ranks' && (
          <div className="tab-content">
            <RanksTab
              taxiRanks={taxiRanks}
              taxis={taxis}
              hasPermission={hasPermission}
            />
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="tab-content">
            <ManageTab
              setShowAddTaxiModal={setShowAddTaxiModal}
              setShowAddRankModal={setShowAddRankModal}
              setShowAssignModal={setShowAssignModal}
              hasPermission={hasPermission}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="tab-content">
            <ReportsTab
              taxis={taxis}
              loads={loads}
              payments={payments}
              stats={stats}
              marshalProfile={marshalProfile}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddTaxiModal && (
        <AddTaxiModal 
          onClose={() => setShowAddTaxiModal(false)} 
          onSuccess={loadTaxis} 
        />
      )}
      {showAddRankModal && (
        <AddRankModal 
          onClose={() => setShowAddRankModal(false)} 
          onSuccess={loadTaxiRanks}
        />
      )}
      {showPaymentModal && (
        <PaymentModal 
          onClose={() => setShowPaymentModal(false)} 
          taxis={taxis} 
          onSuccess={() => { 
            loadPayments(); 
            loadTaxis(); 
          }} 
          user={user} 
        />
      )}
      {showAssignModal && (
        <AssignTaxiModal 
          onClose={() => setShowAssignModal(false)} 
          taxis={taxis} 
          taxiRanks={taxiRanks} 
          onSuccess={loadTaxis} 
        />
      )}
      {showEditTaxiModal && editingTaxi && (
        <EditTaxiModal
          onClose={() => {
            setShowEditTaxiModal(false);
            setEditingTaxi(null);
          }}
          taxi={editingTaxi}
          onSuccess={loadTaxis}
        />
      )}
    </div>
  );
}

// ===================================
// OVERVIEW TAB COMPONENT
// ===================================
function OverviewTab({ stats, taxis, loads, payments }) {
  const recentLoads = loads.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  return (
    <div>
      <div className="manage-section">
        <div className="manage-card">
          <h3>📈 Performance</h3>
          <p>Track your daily targets and goals</p>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Daily Target</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>{stats.today}/40</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
                <div style={{ 
                  width: `${Math.min((stats.today / 40) * 100, 100)}%`, 
                  height: '100%', 
                  background: '#10b981', 
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>
        </div>

        <div className="manage-card">
          <h3>💳 Collections</h3>
          <p>Payment collection status</p>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Collection Rate</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>
                  {taxis.length > 0 ? Math.round(((taxis.length - stats.pendingPayments) / taxis.length) * 100) : 0}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
                <div style={{ 
                  width: `${taxis.length > 0 ? ((taxis.length - stats.pendingPayments) / taxis.length) * 100 : 0}%`, 
                  height: '100%', 
                  background: '#f59e0b', 
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          </div>
        </div>

        <div className="manage-card">
          <h3>📊 Activity</h3>
          <p>Recent system activity</p>
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '8px' }}>
              ✅ <strong>{recentLoads.length}</strong> recent loads
            </p>
            <p style={{ fontSize: '0.875rem', marginBottom: '8px' }}>
              💰 <strong>{recentPayments.length}</strong> recent payments
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              🚖 <strong>{taxis.length}</strong> registered taxis
            </p>
          </div>
        </div>
      </div>

      {recentLoads.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: '700' }}>Recent Loads</h3>
          <div className="loads-list">
            {recentLoads.map(load => (
              <div key={load.id} className="load-card">
                <div className="load-header">
                  <span className="load-reg">{load.registration}</span>
                </div>
                <div className="load-driver">{load.driverName}</div>
                <div className="load-time">
                  {load.timestamp?.toDate().toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===================================
// PAYMENTS TAB COMPONENT
// ===================================
function PaymentsTab({ payments, taxis, stats, getDueTaxis, getTaxiLoads, setShowPaymentModal, hasPermission }) {
  return (
    <div>
      <div className="payments-header">
        <h2>Membership Payments</h2>
        {hasPermission('all') && (
          <button onClick={() => setShowPaymentModal(true)} className="add-payment-btn">
            + Record Payment
          </button>
        )}
      </div>

      <div className="payments-summary">
        <div className="summary-card">
          <h3>This Month</h3>
          <div className="summary-amount">R{(stats.totalRevenue || 0).toFixed(2)}</div>
          <div className="summary-label">{payments.length} payments received</div>
        </div>

        <div className="summary-card warning">
          <h3>Pending</h3>
          <div className="summary-amount">{stats.pendingPayments || 0}</div>
          <div className="summary-label">taxis need to pay</div>
        </div>

        <div className="summary-card">
          <h3>Due this month</h3>
          <div className="summary-amount">{getDueTaxis().length}</div>
          <div className="summary-label">taxis flagged as due</div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">
          <p>No payments recorded this month</p>
        </div>
      ) : (
        <div className="payments-list">
          {payments.map(payment => (
            <div key={payment.id} className="payment-card">
              <div className="payment-header">
                <span className="payment-reg">{payment.registration}</span>
                <span className="payment-amount">R{payment.amount.toFixed(2)}</span>
              </div>
              <div className="payment-driver">{payment.driverName}</div>
              <div className="payment-details">
                <span>📅 Month: {payment.paymentMonth} {payment.paymentYear}</span>
                <span>💳 Type: {payment.paymentType}</span>
              </div>
              <div className="payment-date">
                {payment.paymentDate?.toDate().toLocaleDateString()} - {payment.marshalEmail}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3>Taxis due to pay this month</h3>
        {getDueTaxis().length === 0 ? (
          <div className="empty-state"><p>All taxis appear paid for this month ✅</p></div>
        ) : (
          <div className="taxis-list" style={{ marginTop: 12 }}>
            {getDueTaxis().map(t => (
              <div key={t.id} className="taxi-card">
                <div className="taxi-header">
                  <span className="taxi-reg">{t.registration}</span>
                  <span className="membership-status not-paid">✗ Not Paid</span>
                </div>
                <div className="taxi-driver">{t.driverName}</div>
                <div className="taxi-stats">
                  <span>Loads: {getTaxiLoads(t.id)} (all time)</span>
                  <span>Total: {t.totalLoads || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================================
// HISTORY TAB COMPONENT
// ===================================
function HistoryTab({ loads, taxis, isMembershipValid, timeFilter, setTimeFilter }) {
  return (
    <div>
      <div className="history-header">
        <h2>Load History</h2>
        <div className="time-filter">
          <button
            className={`filter-btn ${timeFilter === 'today' ? 'active' : ''}`}
            onClick={() => setTimeFilter('today')}
          >
            Today
          </button>
          <button
            className={`filter-btn ${timeFilter === 'week' ? 'active' : ''}`}
            onClick={() => setTimeFilter('week')}
          >
            This Week
          </button>
          <button
            className={`filter-btn ${timeFilter === 'month' ? 'active' : ''}`}
            onClick={() => setTimeFilter('month')}
          >
            This Month
          </button>
        </div>
      </div>

      {loads.length === 0 ? (
        <div className="empty-state">
          <p>No loads recorded for this period</p>
        </div>
      ) : (
        <div className="loads-list">
          {loads.map(load => {
            const taxi = taxis.find(t => t.id === load.taxiId);
            const paidNow = isMembershipValid(taxi);
            return (
              <div key={load.id} className="load-card">
                <div className="load-header">
                  <span className="load-reg">{load.registration}</span>
                  <span className={`membership-badge ${paidNow ? 'paid' : 'unpaid'}`}>
                    {paidNow ? '✓ Paid' : '✗ Unpaid'}
                  </span>
                </div>
                <div className="load-driver">{load.driverName}</div>
                <div className="load-time">
                  📅 {load.timestamp?.toDate().toLocaleString()}
                </div>
                {load.marshalEmail && (
                  <div className="load-time">
                    👤 Marshal: {load.marshalEmail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================================
// TAXIS TAB COMPONENT
// ===================================
function TaxisTab({ taxis, searchReg, setSearchReg, getMembershipStatus, getTaxiLoadsByPeriod, handleEditTaxi, handleDeleteTaxi, hasPermission }) {
  return (
    <div>
      <h2>All Registered Taxis</h2>

      <div className="search-box-marshal">
        <input
          type="text"
          placeholder="🔍 Search by registration or driver name..."
          value={searchReg}
          onChange={(e) => setSearchReg(e.target.value)}
          className="search-input-marshal"
        />
      </div>

      {taxis.length === 0 ? (
        <div className="empty-state">
          <p>No taxis found</p>
        </div>
      ) : (
        <div className="taxis-list">
          {taxis.map(taxi => {
            const membershipStatus = getMembershipStatus(taxi);
            const { dayCount, weekCount, monthCount } = getTaxiLoadsByPeriod(taxi.id);
            
            return (
              <div key={taxi.id} className="taxi-card">
                <div className="taxi-header">
                  <span className="taxi-reg">{taxi.registration}</span>
                  <span className={`membership-status ${membershipStatus.toLowerCase().replace(' ', '-')}`}>
                    {membershipStatus === 'Active' ? '✓' : '✗'} {membershipStatus}
                  </span>
                </div>
                <div className="taxi-driver">👤 {taxi.driverName}</div>
                {taxi.phoneNumber && (
                  <div className="taxi-driver" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    📞 {taxi.phoneNumber}
                  </div>
                )}
                <div className="taxi-stats">
                  <span>Today: {dayCount}</span>
                  <span>Week: {weekCount}</span>
                  <span>Month: {monthCount}</span>
                  <span>Total: {taxi.totalLoads || 0}</span>
                </div>
                {taxi.assignedRank && (
                  <div className="taxi-assignment">
                    📍 {taxi.assignedRank.rankName} - Aisle {taxi.assignedRank.aisleNumber}
                  </div>
                )}
                {taxi.membershipPaidUntil && (
                  <div className="membership-date">
                    Paid until: {taxi.membershipPaidUntil.toDate().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                  </div>
                )}
                
                {hasPermission('all') && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleEditTaxi(taxi)}
                      className="manage-btn"
                      style={{ flex: 1, padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTaxi(taxi.id)}
                      className="remove-btn"
                      style={{ flex: 1, padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================================
// RANKS TAB COMPONENT (NEW)
// ===================================
function RanksTab({ taxiRanks, taxis, hasPermission }) {
  const getTaxisAtRank = (rankId) => {
    return taxis.filter(taxi => taxi.assignedRank?.rankId === rankId);
  };

  const getTaxisAtAisle = (rankId, aisleNumber) => {
    return taxis.filter(taxi => 
      taxi.assignedRank?.rankId === rankId && 
      taxi.assignedRank?.aisleNumber === aisleNumber
    );
  };

  return (
    <div>
      <h2>Taxi Ranks & Routes</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        View all taxi ranks, their aisles, and assigned routes
      </p>

      {taxiRanks.length === 0 ? (
        <div className="empty-state">
          <p>No taxi ranks found</p>
        </div>
      ) : (
        <div className="manage-section">
          {taxiRanks.map(rank => {
            const taxisAtRank = getTaxisAtRank(rank.id);
            
            return (
              <div key={rank.id} className="manage-card" style={{ textAlign: 'left' }}>
                <h3 style={{ marginBottom: '12px' }}>🚏 {rank.name}</h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '16px' }}>
                  📍 {rank.address}
                </p>

                {rank.destinations && rank.destinations.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>
                      Main Destinations:
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
                      {rank.destinations.join(' • ')}
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
                    📊 Statistics:
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', background: '#e5e7eb', padding: '4px 12px', borderRadius: '12px' }}>
                      {rank.aisles?.length || 0} Aisles
                    </span>
                    <span style={{ fontSize: '0.875rem', background: '#dbeafe', padding: '4px 12px', borderRadius: '12px' }}>
                      {taxisAtRank.length} Taxis
                    </span>
                  </div>
                </div>

                {rank.aisles && rank.aisles.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
                      Aisles & Routes:
                    </p>
                    {rank.aisles.map(aisle => {
                      const taxisInAisle = getTaxisAtAisle(rank.id, aisle.number);
                      
                      return (
                        <div 
                          key={aisle.number} 
                          style={{ 
                            background: '#f9fafb', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            marginBottom: '8px',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                              Aisle {aisle.number}: {aisle.name}
                            </p>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              background: taxisInAisle.length > 0 ? '#d1fae5' : '#fee2e2', 
                              color: taxisInAisle.length > 0 ? '#065f46' : '#991b1b',
                              padding: '2px 8px', 
                              borderRadius: '10px',
                              fontWeight: '600'
                            }}>
                              {taxisInAisle.length} {taxisInAisle.length === 1 ? 'Taxi' : 'Taxis'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                            → {aisle.routes?.join(' • ') || 'No routes'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {rank.location && (
                  <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#9ca3af' }}>
                    📌 Coordinates: {rank.location.lat}, {rank.location.lng}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================================
// MANAGE TAB COMPONENT (UPDATED)
// ===================================
function ManageTab({ setShowAddTaxiModal, setShowAddRankModal, setShowAssignModal, hasPermission }) {
  const canManage = hasPermission('manage') || hasPermission('all');

  return (
    <div>
      <h2>System Management</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        Manage taxis, ranks, and system configuration
      </p>

      <div className="manage-section">
        <div className="manage-card">
          <h3>🚖 Add New Taxi</h3>
          <p>Register a new taxi to the system</p>
          {canManage ? (
            <button onClick={() => setShowAddTaxiModal(true)} className="manage-btn">
              Add Taxi
            </button>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '12px', fontStyle: 'italic' }}>
              ⚠️ Marshal or Admin permission required
            </p>
          )}
        </div>

        <div className="manage-card">
          <h3>🚏 Add Taxi Rank</h3>
          <p>Create a new taxi rank with routes and aisles</p>
          {canManage ? (
            <button onClick={() => setShowAddRankModal(true)} className="manage-btn">
              Add Rank
            </button>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '12px', fontStyle: 'italic' }}>
              ⚠️ Marshal or Admin permission required
            </p>
          )}
        </div>

        <div className="manage-card">
          <h3>📍 Assign to Rank</h3>
          <p>Assign taxis to specific ranks and aisles</p>
          {canManage ? (
            <button onClick={() => setShowAssignModal(true)} className="manage-btn">
              Assign Taxi
            </button>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '12px', fontStyle: 'italic' }}>
              ⚠️ Marshal or Admin permission required
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '32px', padding: '20px', background: '#f3f4f6', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '12px' }}>ℹ️ Permission Information</h3>
        <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: '#4b5563' }}>
          <p style={{ marginBottom: '8px' }}>
            <strong>👑 Admin:</strong> Full system access - Can manage everything across all ranks
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong>🛡️ Marshal:</strong> Can add/edit taxis, record loads, record payments, and manage ranks for their assigned station
          </p>
          <p>
            <strong>👁️ Supervisor:</strong> View-only access - Can view all data and generate reports for their assigned rank
          </p>
        </div>
      </div>
    </div>
  );
}

// ===================================
// REPORTS TAB COMPONENT (NEW FOR SUPERVISORS)
// ===================================
function ReportsTab({ taxis, loads, payments, stats, marshalProfile }) {
  const exportToCSV = (data, filename) => {
    const csvContent = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const generateTaxiReport = () => {
    const reportData = taxis.map(taxi => ({
      Registration: taxi.registration,
      Driver: taxi.driverName,
      Phone: taxi.phoneNumber || 'N/A',
      TotalLoads: taxi.totalLoads || 0,
      Status: taxi.membershipPaidUntil ? 'Active' : 'Inactive',
      Rank: taxi.assignedRank?.rankName || 'Unassigned'
    }));
    exportToCSV(reportData, `taxis_report_${new Date().toISOString().split('T')[0]}.csv`);
    alert('✅ Taxi report exported successfully!');
  };

  const generateLoadReport = () => {
    const reportData = loads.map(load => ({
      Date: load.timestamp?.toDate().toLocaleDateString() || 'N/A',
      Time: load.timestamp?.toDate().toLocaleTimeString() || 'N/A',
      Registration: load.registration,
      Driver: load.driverName,
      Marshal: load.marshalEmail || 'N/A'
    }));
    exportToCSV(reportData, `loads_report_${new Date().toISOString().split('T')[0]}.csv`);
    alert('✅ Loads report exported successfully!');
  };

  const generatePaymentReport = () => {
    const reportData = payments.map(payment => ({
      Date: payment.paymentDate?.toDate().toLocaleDateString() || 'N/A',
      Registration: payment.registration,
      Driver: payment.driverName,
      Amount: `R${payment.amount}`,
      Month: payment.paymentMonth,
      Year: payment.paymentYear,
      Type: payment.paymentType,
      Marshal: payment.marshalEmail || 'N/A'
    }));
    exportToCSV(reportData, `payments_report_${new Date().toISOString().split('T')[0]}.csv`);
    alert('✅ Payment report exported successfully!');
  };

  return (
    <div>
      <h2>📊 Reports & Analytics</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        Generate and export reports for {marshalProfile?.rank || 'your assigned rank'}
      </p>

      {/* Summary Cards */}
      <div className="payments-summary" style={{ marginBottom: '32px' }}>
        <div className="summary-card">
          <h3>Total Taxis</h3>
          <div className="summary-amount">{taxis.length}</div>
          <div className="summary-label">Registered vehicles</div>
        </div>

        <div className="summary-card">
          <h3>Total Loads</h3>
          <div className="summary-amount">{stats.month}</div>
          <div className="summary-label">This month</div>
        </div>

        <div className="summary-card">
          <h3>Total Revenue</h3>
          <div className="summary-amount">R{stats.totalRevenue.toFixed(2)}</div>
          <div className="summary-label">This month</div>
        </div>
      </div>

      {/* Export Reports */}
      <div className="manage-section">
        <div className="manage-card">
          <h3>🚖 Taxi Report</h3>
          <p>Export complete list of all registered taxis with their details</p>
          <button onClick={generateTaxiReport} className="manage-btn">
            📥 Export Taxi Report
          </button>
        </div>

        <div className="manage-card">
          <h3>📦 Loads Report</h3>
          <p>Export detailed load history with timestamps and marshal info</p>
          <button onClick={generateLoadReport} className="manage-btn">
            📥 Export Loads Report
          </button>
        </div>

        <div className="manage-card">
          <h3>💰 Payment Report</h3>
          <p>Export payment records with amounts and transaction details</p>
          <button onClick={generatePaymentReport} className="manage-btn">
            📥 Export Payment Report
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{ marginTop: '32px', padding: '24px', background: 'white', borderRadius: '16px', border: '2px solid #e5e7eb' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>📈 Performance Metrics</h3>
        
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Payment Collection Rate</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>
              {taxis.length > 0 ? Math.round(((taxis.length - stats.pendingPayments) / taxis.length) * 100) : 0}%
            </span>
          </div>
          <div style={{ width: '100%', height: '12px', background: '#e5e7eb', borderRadius: '6px' }}>
            <div style={{ 
              width: `${taxis.length > 0 ? ((taxis.length - stats.pendingPayments) / taxis.length) * 100 : 0}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #10b981, #059669)', 
              borderRadius: '6px',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Daily Load Target (40 loads)</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>{stats.today}/40</span>
          </div>
          <div style={{ width: '100%', height: '12px', background: '#e5e7eb', borderRadius: '6px' }}>
            <div style={{ 
              width: `${Math.min((stats.today / 40) * 100, 100)}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #f59e0b, #d97706)', 
              borderRadius: '6px',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <div className="taxi-stats" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px dashed #e5e7eb' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Today's Loads</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>{stats.today}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>This Week</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>{stats.week}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>This Month</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>{stats.month}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================
// ADMIN TAB COMPONENT (NEW FOR ADMINS)
// ===================================
function AdminTab({ pendingUsers, approvedMarshals, loadingPending, approveMarshal, rejectMarshal, loadPendingUsers, loadApprovedMarshals }) {
  return (
    <div>
      <h2>👑 Admin Panel</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        Manage marshal accounts and system approvals
      </p>

      <div className="manage-section">
        <div className="manage-card">
          <h3>⏳ Pending Approvals</h3>
          <p>Marshals waiting for admin approval</p>
          {loadingPending ? (
            <div className="loading-spinner"></div>
          ) : pendingUsers.length === 0 ? (
            <div className="empty-state">
              <p>No pending approvals</p>
            </div>
          ) : (
            <div className="pending-users-list">
              {pendingUsers.map(user => (
                <div key={user.id} className="user-card">
                  <div className="user-header">
                    <span className="user-email">{user.email}</span>
                    <span className="user-role">{user.role}</span>
                  </div>
                  <div className="user-details">
                    <span>Rank: {user.rank}</span>
                    <span>Created: {user.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => approveMarshal(user.id)}
                      className="manage-btn"
                      style={{ flex: 1, padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => rejectMarshal(user.id)}
                      className="remove-btn"
                      style={{ flex: 1, padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="manage-card">
          <h3>✅ Approved Marshals</h3>
          <p>Currently approved system users</p>
          {approvedMarshals.length === 0 ? (
            <div className="empty-state">
              <p>No approved marshals</p>
            </div>
          ) : (
            <div className="approved-users-list">
              {approvedMarshals.map(user => (
                <div key={user.id} className="user-card approved">
                  <div className="user-header">
                    <span className="user-email">{user.email}</span>
                    <span className="user-role">{user.role}</span>
                  </div>
                  <div className="user-details">
                    <span>Rank: {user.rank}</span>
                    <span>Approved: {user.approvedAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================================
// PAYMENT MODAL
// ===================================
function PaymentModal({ onClose, taxis, onSuccess, user }) {
  const [formData, setFormData] = useState({
    taxiId: '',
    amount: '150',
    paymentType: 'monthly_fee',
    paymentMonth: new Date().getMonth(),
    paymentYear: new Date().getFullYear(),
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedTaxi = taxis.find(t => t.id === formData.taxiId);

      await addDoc(collection(db, 'payments'), {
        taxiId: formData.taxiId,
        registration: selectedTaxi.registration,
        driverName: selectedTaxi.driverName,
        amount: parseFloat(formData.amount),
        paymentType: formData.paymentType,
        paymentMonth: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][formData.paymentMonth],
        paymentYear: formData.paymentYear,
        notes: formData.notes,
        paymentDate: Timestamp.now(),
        marshalId: user.uid,
        marshalEmail: user.email
      });

      const paidUntilDate = new Date(formData.paymentYear, formData.paymentMonth, 1);
      const taxiRef = doc(db, 'taxis', formData.taxiId);
      await updateDoc(taxiRef, {
        membershipPaidUntil: Timestamp.fromDate(paidUntilDate),
        lastPaymentAmount: parseFloat(formData.amount),
        lastPaymentDate: Timestamp.now()
      });

      alert('✅ Payment recorded successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('❌ Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Record Membership Payment</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Taxi *</label>
            <select
              value={formData.taxiId}
              onChange={(e) => setFormData({...formData, taxiId: e.target.value})}
              className="select-input"
              required
            >
              <option value="">-- Select Taxi --</option>
              {taxis.map(taxi => (
                <option key={taxi.id} value={taxi.id}>
                  {taxi.registration} - {taxi.driverName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount (R) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="150.00"
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Type *</label>
              <select
                value={formData.paymentType}
                onChange={(e) => setFormData({...formData, paymentType: e.target.value})}
                className="select-input"
                required
              >
                <option value="monthly_fee">Monthly Association Fee</option>
                <option value="registration">Registration Fee</option>
                <option value="penalty">Penalty</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Payment For Month *</label>
              <select
                value={formData.paymentMonth}
                onChange={(e) => setFormData({...formData, paymentMonth: parseInt(e.target.value)})}
                className="select-input"
                required
              >
                {months.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Year *</label>
              <select
                value={formData.paymentYear}
                onChange={(e) => setFormData({...formData, paymentYear: parseInt(e.target.value)})}
                className="select-input"
                required
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Optional notes..."
              rows="3"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================
// ASSIGN TAXI MODAL
// ===================================
function AssignTaxiModal({ onClose, taxis, taxiRanks, onSuccess }) {
  const [formData, setFormData] = useState({
    taxiId: '',
    rankId: '',
    aisleNumber: ''
  });
  const [selectedRank, setSelectedRank] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRankChange = (rankId) => {
    setFormData({...formData, rankId, aisleNumber: ''});
    const rank = taxiRanks.find(r => r.id === rankId);
    setSelectedRank(rank);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const taxi = taxis.find(t => t.id === formData.taxiId);
      const rank = taxiRanks.find(r => r.id === formData.rankId);
      const aisle = rank.aisles.find(a => a.number === parseInt(formData.aisleNumber));

      const taxiRef = doc(db, 'taxis', formData.taxiId);
      await updateDoc(taxiRef, {
        assignedRank: {
          rankId: formData.rankId,
          rankName: rank.name,
          aisleNumber: parseInt(formData.aisleNumber),
          aisleName: aisle.name,
          routes: aisle.routes
        },
        updatedAt: Timestamp.now()
      });

      alert(`✅ ${taxi.registration} assigned to ${rank.name} - Aisle ${aisle.number}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning taxi:', error);
      alert('❌ Failed to assign taxi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Assign Taxi to Rank</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Taxi *</label>
            <select
              value={formData.taxiId}
              onChange={(e) => setFormData({...formData, taxiId: e.target.value})}
              className="select-input"
              required
            >
              <option value="">-- Select Taxi --</option>
              {taxis.map(taxi => (
                <option key={taxi.id} value={taxi.id}>
                  {taxi.registration} - {taxi.driverName}
                  {taxi.assignedRank && ` (Currently at ${taxi.assignedRank.rankName})`}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Select Taxi Rank *</label>
            <select
              value={formData.rankId}
              onChange={(e) => handleRankChange(e.target.value)}
              className="select-input"
              required
            >
              <option value="">-- Select Rank --</option>
              {taxiRanks.map(rank => (
                <option key={rank.id} value={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRank && (
            <div className="form-group">
              <label>Select Aisle *</label>
              <select
                value={formData.aisleNumber}
                onChange={(e) => setFormData({...formData, aisleNumber: e.target.value})}
                className="select-input"
                required
              >
                <option value="">-- Select Aisle --</option>
                {selectedRank.aisles.map(aisle => (
                  <option key={aisle.number} value={aisle.number}>
                    Aisle {aisle.number}: {aisle.name} → {aisle.routes.join(', ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading || !selectedRank} className="submit-btn">
              {loading ? '⏳ Assigning...' : 'Assign Taxi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================
// ADD TAXI MODAL
// ===================================
function AddTaxiModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    registration: '',
    driverName: '',
    phoneNumber: '',
    paymentMonth: new Date().getMonth(),
    paymentYear: new Date().getFullYear()
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const paidUntilDate = new Date(formData.paymentYear, formData.paymentMonth, 1);

      await addDoc(collection(db, 'taxis'), {
        registration: formData.registration.toUpperCase(),
        driverName: formData.driverName,
        phoneNumber: formData.phoneNumber,
        membershipPaidUntil: Timestamp.fromDate(paidUntilDate),
        totalLoads: 0,
        lastLoad: null,
        createdAt: Timestamp.now()
      });

      alert('✅ Taxi added successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding taxi:', error);
      alert('❌ Failed to add taxi');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Taxi</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Registration Number *</label>
            <input
              type="text"
              value={formData.registration}
              onChange={(e) => setFormData({...formData, registration: e.target.value.toUpperCase()})}
              placeholder="ABC123GP"
              required
            />
          </div>

          <div className="form-group">
            <label>Driver Name *</label>
            <input
              type="text"
              value={formData.driverName}
              onChange={(e) => setFormData({...formData, driverName: e.target.value})}
              placeholder="John Modise"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              placeholder="+27123456789"
            />
          </div>

          <div className="membership-payment-section">
            <h3>Membership Payment</h3>
            <p className="hint">Select the month the membership is paid for</p>

            <div className="form-row">
              <div className="form-group">
                <label>Month *</label>
                <select
                  value={formData.paymentMonth}
                  onChange={(e) => setFormData({...formData, paymentMonth: parseInt(e.target.value)})}
                  className="select-input"
                  required
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Year *</label>
                <select
                  value={formData.paymentYear}
                  onChange={(e) => setFormData({...formData, paymentYear: parseInt(e.target.value)})}
                  className="select-input"
                  required
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Adding...' : 'Add Taxi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================
// EDIT TAXI MODAL
// ===================================
function EditTaxiModal({ onClose, taxi, onSuccess }) {
  const [formData, setFormData] = useState({
    registration: taxi.registration || '',
    driverName: taxi.driverName || '',
    phoneNumber: taxi.phoneNumber || '',
    paymentMonth: taxi.membershipPaidUntil ? taxi.membershipPaidUntil.toDate().getMonth() : new Date().getMonth(),
    paymentYear: taxi.membershipPaidUntil ? taxi.membershipPaidUntil.toDate().getFullYear() : new Date().getFullYear()
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const paidUntilDate = new Date(formData.paymentYear, formData.paymentMonth, 1);
      const taxiRef = doc(db, 'taxis', taxi.id);

      await updateDoc(taxiRef, {
        registration: formData.registration.toUpperCase(),
        driverName: formData.driverName,
        phoneNumber: formData.phoneNumber,
        membershipPaidUntil: Timestamp.fromDate(paidUntilDate),
        updatedAt: Timestamp.now()
      });

      alert('✅ Taxi updated successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating taxi:', error);
      alert('❌ Failed to update taxi');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Taxi</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Registration Number *</label>
            <input
              type="text"
              value={formData.registration}
              onChange={(e) => setFormData({...formData, registration: e.target.value.toUpperCase()})}
              placeholder="ABC123GP"
              required
            />
          </div>

          <div className="form-group">
            <label>Driver Name *</label>
            <input
              type="text"
              value={formData.driverName}
              onChange={(e) => setFormData({...formData, driverName: e.target.value})}
              placeholder="John Modise"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              placeholder="+27123456789"
            />
          </div>

          <div className="membership-payment-section">
            <h3>Update Membership</h3>
            <p className="hint">Update the membership payment month</p>

            <div className="form-row">
              <div className="form-group">
                <label>Month *</label>
                <select
                  value={formData.paymentMonth}
                  onChange={(e) => setFormData({...formData, paymentMonth: parseInt(e.target.value)})}
                  className="select-input"
                  required
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Year *</label>
                <select
                  value={formData.paymentYear}
                  onChange={(e) => setFormData({...formData, paymentYear: parseInt(e.target.value)})}
                  className="select-input"
                  required
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Updating...' : 'Update Taxi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================
// ADD RANK MODAL
// ===================================
function AddRankModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    destinations: '',
    aisles: [{ number: 1, name: '', routes: '' }],
    marshalEmail: '',
    marshalPassword: 'TempPass123!',
    supervisorEmail: '',
    supervisorPassword: 'TempPass123!'
  });
  const [loading, setLoading] = useState(false);

  const addAisle = () => {
    setFormData({
      ...formData,
      aisles: [...formData.aisles, { number: formData.aisles.length + 1, name: '', routes: '' }]
    });
  };

  const removeAisle = (index) => {
    const newAisles = formData.aisles.filter((_, i) => i !== index);
    // Renumber aisles
    const renumberedAisles = newAisles.map((aisle, idx) => ({
      ...aisle,
      number: idx + 1
    }));
    setFormData({ ...formData, aisles: renumberedAisles });
  };

  const updateAisle = (index, field, value) => {
    const newAisles = [...formData.aisles];
    newAisles[index][field] = value;
    setFormData({ ...formData, aisles: newAisles });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const rankData = {
        name: formData.name,
        address: formData.address,
        location: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        },
        destinations: formData.destinations.split(',').map(d => d.trim()).filter(d => d),
        aisles: formData.aisles.map(aisle => ({
          number: aisle.number,
          name: aisle.name,
          routes: aisle.routes.split(',').map(r => r.trim()).filter(r => r)
        })),
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'taxiRanks'), rankData);

      alert('✅ Taxi rank added successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding taxi rank:', error);
      alert('❌ Failed to add taxi rank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box large" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Taxi Rank</h2>
        <form onSubmit={handleSubmit} className="rank-form">
          <div className="form-group">
            <label>Rank Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Bree Taxi Rank"
              required
            />
          </div>

          <div className="form-group">
            <label>Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Bree Street, Johannesburg CBD"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude *</label>
              <input
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) => setFormData({...formData, lat: e.target.value})}
                placeholder="-26.2041"
                required
              />
            </div>

            <div className="form-group">
              <label>Longitude *</label>
              <input
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) => setFormData({...formData, lng: e.target.value})}
                placeholder="28.0473"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Destinations (comma separated) *</label>
            <input
              type="text"
              value={formData.destinations}
              onChange={(e) => setFormData({...formData, destinations: e.target.value})}
              placeholder="Soweto, Alexandra, Sandton, Randburg"
              required
            />
          </div>

          <div className="aisles-section">
            <div className="section-header">
              <h3>Aisles & Routes</h3>
              <button type="button" onClick={addAisle} className="add-aisle-btn">
                + Add Aisle
              </button>
            </div>

            {formData.aisles.map((aisle, index) => (
              <div key={index} className="aisle-form">
                <div className="aisle-header">
                  <h4>Aisle {aisle.number}</h4>
                  {formData.aisles.length > 1 && (
                    <button type="button" onClick={() => removeAisle(index)} className="remove-btn">
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Aisle Name *</label>
                  <input
                    type="text"
                    value={aisle.name}
                    onChange={(e) => updateAisle(index, 'name', e.target.value)}
                    placeholder="Soweto Line"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Routes (comma separated) *</label>
                  <input
                    type="text"
                    value={aisle.routes}
                    onChange={(e) => updateAisle(index, 'routes', e.target.value)}
                    placeholder="Orlando, Diepkloof, Meadowlands"
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Adding...' : 'Add Rank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MarshalApp;