/* Enhanced MarshalApp.jsx - Fixed Role-Based Access Control */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, Timestamp, deleteDoc, limit, getDoc, setDoc } from 'firebase/firestore';
import './MarshalApp.css';

function MarshalApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [marshalName, setMarshalName] = useState('');
  const [marshalPhone, setMarshalPhone] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [marshalProfile, setMarshalProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        try {
          // Use direct document access instead of query - this matches Firebase security rules
          const docRef = doc(db, 'marshalls', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const profile = docSnap.data();

            // Check if marshal is approved
            if (!profile.approved) {
              setError('Your account is pending admin approval. Please contact an administrator.');
              setMarshalProfile(null);
              setInitialLoading(false);
              return;
            }

            // Check if account is suspended
            if (profile.suspended) {
              setError('Your account has been suspended. Please contact an administrator.');
              await signOut(auth);
              setMarshalProfile(null);
              setInitialLoading(false);
              return;
            }

            setMarshalProfile({
              ...profile,
              docId: docSnap.id
            });
          } else {
            // Profile doesn't exist - user needs to complete registration or wait for approval
            setMarshalProfile(null);
          }
        } catch (error) {
          // Only log non-permission errors
          if (error.code !== 'permission-denied') {
            console.error('Error fetching marshal profile:', error);
          }
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
      
      // Log login activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'login',
        email: email,
        timestamp: Timestamp.now(),
        success: true
      });
    } catch (err) {
      // Log failed login attempt
      await addDoc(collection(db, 'activityLogs'), {
        action: 'login_failed',
        email: email,
        timestamp: Timestamp.now(),
        success: false,
        error: err.code
      });
      
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!marshalName || !marshalPhone) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    let newUser = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      newUser = userCredential.user;

      // New users are created without role - admin will assign
      // Use setDoc with user.uid as document ID to match security rules
      await setDoc(doc(db, 'marshalls', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        name: marshalName,
        phone: marshalPhone,
        role: null, // No role assigned initially
        rank: null, // No rank assigned initially
        permissions: [], // No permissions initially
        approved: false, // Requires admin approval
        suspended: false,
        createdAt: Timestamp.now(),
        lastLogin: null,
        loginCount: 0
      });

      // Log registration activity
      try {
        await addDoc(collection(db, 'activityLogs'), {
          action: 'registration',
          email: newUser.email,
          name: marshalName,
          timestamp: Timestamp.now(),
          success: true
        });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
        // Continue even if logging fails
      }

      // Sign out the user since they need approval
      await signOut(auth);
      
      alert('✅ Registration successful! Your account is pending admin approval. An administrator will review your account and assign you a role and taxi rank.');
      setIsRegistering(false);
      setEmail('');
      setPassword('');
      setMarshalName('');
      setMarshalPhone('');
      
    } catch (err) {
      // If anything fails, make sure to sign out the user
      if (newUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error('Failed to sign out after error:', signOutError);
        }
      }
      
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please login instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (err.code === 'permission-denied') {
        setError('Permission denied. Please check your internet connection and try again.');
      } else {
        setError('Registration failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Log logout activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'logout',
        email: user.email,
        timestamp: Timestamp.now(),
        success: true
      });
      
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

  if (!user || !marshalProfile) {
    return (
      <div className="marshal-app">
        <header className="marshal-header">
          <Link to="/" className="back-btn">← Back to Home</Link>
          <h1>🛡️ TaxiHub Marshal Login 🔐</h1>
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
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={marshalName}
                    onChange={(e) => setMarshalName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marshal@taxihub.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    value={marshalPhone}
                    onChange={(e) => setMarshalPhone(e.target.value)}
                    placeholder="+27 12 345 6789"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div className="info-box" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <strong>Note:</strong> After registration, an administrator will review your account and assign you a role (Marshal or Supervisor). Admin roles are created directly by existing administrators only.
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
                setMarshalName('');
                setMarshalPhone('');
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
  const [meetings, setMeetings] = useState([]);
  const [selectedTaxi, setSelectedTaxi] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchReg, setSearchReg] = useState('');
  const [showAddTaxiModal, setShowAddTaxiModal] = useState(false);
  const [showAddRankModal, setShowAddRankModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [timeFilter, setTimeFilter] = useState('today');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedMarshals, setApprovedMarshals] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    paidToday: 0,
    totalRevenue: 0,
    pendingPayments: 0
  });

  // Role-based permission checker
  const hasPermission = (action) => {
    if (!marshalProfile || !marshalProfile.role) return false;

    const permissions = {
      'Admin': ['view', 'approve_users', 'assign_roles', 'manage_users', 'view_reports', 'system_settings', 'add_ranks'],
      'Supervisor': ['view', 'view_reports'],
      'Marshal': ['view', 'add_taxis', 'record_loads', 'record_payments', 'manage_meetings']
    };

    return permissions[marshalProfile.role]?.includes(action) || false;
  };

  // Set initial tab based on role
  useEffect(() => {
    if (marshalProfile?.role === 'Admin') {
      setActiveTab('admin');
    } else if (marshalProfile?.role === 'Supervisor') {
      setActiveTab('reports');
    } else if (marshalProfile?.role === 'Marshal') {
      setActiveTab('overview');
    }
  }, [marshalProfile]);

  useEffect(() => {
    loadData();
  }, [marshalProfile, timeFilter]);

  const loadData = async () => {
    if (!marshalProfile) return;

    // Load data based on role
    if (marshalProfile.role === 'Admin') {
      loadPendingUsers();
      loadApprovedMarshals();
      loadActivityLogs();
      loadReports();
      loadTaxiRanks(); // Add this so admins can see and manage taxi ranks
    } else if (marshalProfile.role === 'Supervisor') {
      loadReports();
      loadTaxis();
      loadLoads();
    } else if (marshalProfile.role === 'Marshal') {
      loadTaxis();
      loadTaxiRanks();
      loadLoads();
      loadPayments();
      loadMeetings();
    }

    // Update last login
    if (marshalProfile?.docId) {
      const marshalRef = doc(db, 'marshalls', marshalProfile.docId);
      await updateDoc(marshalRef, {
        lastLogin: Timestamp.now(),
        loginCount: (marshalProfile.loginCount || 0) + 1
      });
    }
  };

  const loadTaxis = async () => {
    try {
      let q = collection(db, 'taxis');
      
      // Filter by marshal's rank if assigned
      if (marshalProfile?.rank && marshalProfile.role !== 'Admin') {
        q = query(
          collection(db, 'taxis'), 
          where('assignedRank', '==', marshalProfile.rank)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const taxiList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTaxis(taxiList);
    } catch (error) {
      console.error('Error loading taxis:', error);
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

  const loadLoads = async () => {
    try {
      let startDate = new Date();

      if (timeFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (timeFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeFilter === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      let q = query(
        collection(db, 'loads'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const loadsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLoads(loadsList);
      calculateStats(loadsList);
    } catch (error) {
      console.error('Error loading loads:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'payments'),
        where('paymentDate', '>=', Timestamp.fromDate(startOfMonth)),
        orderBy('paymentDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const paymentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPayments(paymentsList);
      calculateFinances(paymentsList);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const loadMeetings = async () => {
    try {
      const q = query(
        collection(db, 'meetings'),
        orderBy('meetingDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const meetingsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMeetings(meetingsList);
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
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
      // Generate reports from existing data
      const reportsData = {
        dailyLoads: loads.filter(l => {
          const loadDate = l.timestamp?.toDate();
          const today = new Date();
          return loadDate?.toDateString() === today.toDateString();
        }).length,
        weeklyRevenue: payments.reduce((sum, p) => {
          const paymentDate = p.paymentDate?.toDate();
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return paymentDate > weekAgo ? sum + (p.amount || 0) : sum;
        }, 0),
        activeMarshals: approvedMarshals.filter(m => {
          const lastLogin = m.lastLogin?.toDate();
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return lastLogin > dayAgo;
        }).length,
        totalTaxis: taxis.length
      };
      setReports(reportsData);
    } catch (error) {
      console.error('Error generating reports:', error);
    }
  };

  const calculateStats = (loadsList) => {
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

    setStats(prev => ({
      ...prev,
      today: todayLoads.length,
      week: weekLoads.length,
      month: monthLoads.length
    }));
  };

  const calculateFinances = (paymentsList) => {
    const totalRevenue = paymentsList.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    setStats(prev => ({
      ...prev,
      totalRevenue,
      paidToday: paymentsList.filter(p => {
        const paymentDate = p.paymentDate?.toDate();
        const today = new Date();
        return paymentDate?.toDateString() === today.toDateString();
      }).length
    }));
  };

  // Admin Functions
  const approveUser = async (userId, role, rank) => {
    if (!hasPermission('approve_users')) {
      alert('❌ You do not have permission to approve users');
      return;
    }

    try {
      // Set permissions based on role
      let permissions = [];
      if (role === 'Admin') {
        permissions = ['view', 'approve_users', 'assign_roles', 'manage_users', 'view_reports', 'system_settings'];
      } else if (role === 'Supervisor') {
        permissions = ['view', 'view_reports'];
      } else if (role === 'Marshal') {
        permissions = ['view', 'add_taxis', 'record_loads', 'record_payments', 'manage_meetings'];
      }

      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        approved: true,
        approvedAt: Timestamp.now(),
        approvedBy: user.email,
        role: role,
        rank: rank,
        permissions: permissions
      });

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_approved',
        userId: userId,
        role: role,
        rank: rank,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ User approved successfully!');
      loadPendingUsers();
      loadApprovedMarshals();
    } catch (error) {
      console.error('Error approving user:', error);
      alert('❌ Failed to approve user');
    }
  };

  const rejectUser = async (userId) => {
    if (!hasPermission('approve_users')) {
      alert('❌ You do not have permission to reject users');
      return;
    }

    if (!window.confirm('Are you sure you want to reject this user? This will delete their account.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'marshalls', userId));

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_rejected',
        userId: userId,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ User rejected and account deleted');
      loadPendingUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('❌ Failed to reject user');
    }
  };

  // Admin Creation Function
  const createAdmin = async (adminData) => {
    if (!hasPermission('approve_users')) {
      alert('❌ You do not have permission to create admin accounts');
      return;
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
      const newUser = userCredential.user;

      // Add to marshalls collection with Admin role
      await setDoc(doc(db, 'marshalls', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        name: adminData.name,
        phone: adminData.phone,
        role: 'Admin',
        rank: null, // Admins don't have assigned ranks
        permissions: ['view', 'approve_users', 'assign_roles', 'manage_users', 'view_reports', 'system_settings'],
        approved: true, // Admins are auto-approved
        suspended: false,
        createdAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        approvedBy: user.email,
        lastLogin: null,
        loginCount: 0
      });

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'admin_created',
        newAdminEmail: newUser.email,
        newAdminName: adminData.name,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ Admin account created successfully!');
      loadApprovedMarshals();
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        alert('❌ This email is already registered');
      } else if (error.code === 'auth/weak-password') {
        alert('❌ Password is too weak. Please use at least 6 characters');
      } else {
        console.error('Error creating admin:', error);
        alert('❌ Failed to create admin account: ' + error.message);
      }
    }
  };

  // Edit Taxi Rank Function
  const editTaxiRank = async (rankId, rankData) => {
    if (!hasPermission('approve_users')) {
      alert('❌ You do not have permission to edit taxi ranks');
      return;
    }

    try {
      const rankRef = doc(db, 'taxiRanks', rankId);
      await updateDoc(rankRef, {
        ...rankData,
        updatedAt: Timestamp.now(),
        updatedBy: user.email
      });

      // If rank name changed, update all assigned users
      if (rankData.name !== rankToEdit?.name) {
        const assignedUsers = approvedMarshals.filter(m =>
          rankToEdit?.assignedMarshals?.includes(m.id) || m.rank === rankToEdit?.name
        );

        for (const user of assignedUsers) {
          const userRef = doc(db, 'marshalls', user.id);
          await updateDoc(userRef, {
            rank: rankData.name,
            updatedAt: Timestamp.now()
          });
        }
      }

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'rank_edited',
        rankId: rankId,
        rankName: rankData.name,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ Taxi rank updated successfully!');
      loadTaxiRanks();
      loadApprovedMarshals();
    } catch (error) {
      console.error('Error editing rank:', error);
      alert('❌ Failed to update taxi rank: ' + error.message);
    }
  };

  // Edit User Function
  const editUser = async (userId, userData) => {
    if (!hasPermission('manage_users')) {
      alert('❌ You do not have permission to edit users');
      return;
    }

    try {
      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        ...userData,
        updatedAt: Timestamp.now(),
        updatedBy: user.email
      });

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_edited',
        userId: userId,
        userEmail: userData.email,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ User updated successfully!');
      loadApprovedMarshals();
    } catch (error) {
      console.error('Error editing user:', error);
      alert('❌ Failed to update user: ' + error.message);
    }
  };

  // Suspend/Unsuspend User Function
  const toggleUserSuspension = async (userId, currentStatus) => {
    if (!hasPermission('manage_users')) {
      alert('❌ You do not have permission to manage user status');
      return;
    }

    const action = currentStatus ? 'unsuspend' : 'suspend';
    const confirmMessage = currentStatus
      ? 'Are you sure you want to unsuspend this user? They will be able to log in again.'
      : 'Are you sure you want to suspend this user? They will not be able to log in until unsuspended.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        suspended: !currentStatus,
        suspendedAt: Timestamp.now(),
        suspendedBy: user.email
      });

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: action,
        userId: userId,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert(`✅ User ${action}ed successfully!`);
      loadApprovedMarshals();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`❌ Failed to ${action} user: ` + error.message);
    }
  };

  // Delete User Function
  const deleteUser = async (userId, userEmail) => {
    if (!hasPermission('manage_users')) {
      alert('❌ You do not have permission to delete users');
      return;
    }

    // Check if this is the last admin
    const adminCount = approvedMarshals.filter(m => m.role === 'Admin').length;
    const userToDelete = approvedMarshals.find(m => m.id === userId);

    if (userToDelete?.role === 'Admin' && adminCount <= 1) {
      alert('❌ Cannot delete the last admin account. Create another admin first.');
      return;
    }

    const confirmation = prompt(`⚠️ DANGER ZONE ⚠️\n\nYou are about to permanently delete user: ${userEmail}\n\nThis action cannot be undone and will:\n- Delete all user data\n- Remove from all assigned ranks\n- Delete login history\n\nType "YES" to confirm deletion:`);

    if (confirmation !== 'YES') {
      alert('Deletion cancelled');
      return;
    }

    try {
      // Remove user from all assigned ranks
      const ranksToUpdate = taxiRanks.filter(rank =>
        rank.assignedMarshals?.includes(userId)
      );

      for (const rank of ranksToUpdate) {
        const rankRef = doc(db, 'taxiRanks', rank.id);
        const updatedMarshals = rank.assignedMarshals.filter(id => id !== userId);
        await updateDoc(rankRef, {
          assignedMarshals: updatedMarshals,
          updatedAt: Timestamp.now()
        });
      }

      // Delete user document
      await deleteDoc(doc(db, 'marshalls', userId));

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'user_deleted',
        deletedUserEmail: userEmail,
        performedBy: user.email,
        timestamp: Timestamp.now()
      });

      alert('✅ User permanently deleted!');
      loadApprovedMarshals();
      loadTaxiRanks();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('❌ Failed to delete user: ' + error.message);
    }
  };

  // Marshal Functions
  const addTaxiRank = async (rankData) => {
    if (!hasPermission('add_ranks')) {
      alert('❌ You do not have permission to add taxi ranks');
      return;
    }

    try {
      await addDoc(collection(db, 'taxiRanks'), {
        ...rankData,
        createdBy: user.email,
        createdAt: Timestamp.now()
      });

      alert('✅ Taxi rank added successfully!');
      loadTaxiRanks();
    } catch (error) {
      console.error('Error adding taxi rank:', error);
      alert('❌ Failed to add taxi rank');
    }
  };

  const addTaxi = async (taxiData) => {
    if (!hasPermission('add_taxis')) {
      alert('❌ You do not have permission to add taxis');
      return;
    }

    try {
      await addDoc(collection(db, 'taxis'), {
        ...taxiData,
        assignedRank: marshalProfile.rank,
        createdBy: user.email,
        createdAt: Timestamp.now(),
        totalLoads: 0
      });

      alert('✅ Taxi added successfully!');
      loadTaxis();
    } catch (error) {
      console.error('Error adding taxi:', error);
      alert('❌ Failed to add taxi');
    }
  };

  const recordLoad = async () => {
    if (!hasPermission('record_loads')) {
      alert('❌ You do not have permission to record loads');
      return;
    }

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
      
      // Update stats immediately
      setStats(prev => ({
        ...prev,
        today: prev.today + 1
      }));
    } catch (error) {
      console.error('Error recording load:', error);
      alert('❌ Failed to record load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const recordPayment = async (paymentData) => {
    if (!hasPermission('record_payments')) {
      alert('❌ You do not have permission to record payments');
      return;
    }

    try {
      await addDoc(collection(db, 'payments'), {
        ...paymentData,
        recordedBy: user.email,
        recordedAt: Timestamp.now()
      });

      alert('✅ Payment recorded successfully!');
      loadPayments();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('❌ Failed to record payment');
    }
  };

  const createMeeting = async (meetingData) => {
    if (!hasPermission('manage_meetings')) {
      alert('❌ You do not have permission to create meetings');
      return;
    }

    try {
      await addDoc(collection(db, 'meetings'), {
        ...meetingData,
        createdBy: user.email,
        createdAt: Timestamp.now()
      });

      alert('✅ Meeting created successfully!');
      loadMeetings();
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('❌ Failed to create meeting');
    }
  };

  return (
    <div className="marshal-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🛡️ TaxiHub Marshal Portal</h1>
          <div className="user-info">
            <span className="user-role">{marshalProfile?.role || 'Loading...'}</span>
            {marshalProfile?.rank && <span className="user-rank">📍 {marshalProfile.rank}</span>}
            <span className="user-email">{user.email}</span>
            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="dashboard-nav">
        <div className="nav-tabs">
          {/* Admin Tabs */}
          {hasPermission('approve_users') && (
            <button
              className={activeTab === 'admin' ? 'active' : ''}
              onClick={() => setActiveTab('admin')}
            >
              👥 User Management
            </button>
          )}
          
          {/* Supervisor Tabs */}
          {hasPermission('view_reports') && (
            <button
              className={activeTab === 'reports' ? 'active' : ''}
              onClick={() => setActiveTab('reports')}
            >
              📊 Reports
            </button>
          )}
          
          {/* Marshal Tabs */}
          {marshalProfile?.role === 'Marshal' && (
            <>
              <button
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
              >
                🏠 Overview
              </button>
              <button
                className={activeTab === 'ranks' ? 'active' : ''}
                onClick={() => setActiveTab('ranks')}
              >
                📍 Taxi Ranks
              </button>
              <button
                className={activeTab === 'taxis' ? 'active' : ''}
                onClick={() => setActiveTab('taxis')}
              >
                🚖 Taxis
              </button>
              <button
                className={activeTab === 'loads' ? 'active' : ''}
                onClick={() => setActiveTab('loads')}
              >
                📦 Loads
              </button>
              <button
                className={activeTab === 'payments' ? 'active' : ''}
                onClick={() => setActiveTab('payments')}
              >
                💰 Payments
              </button>
              <button
                className={activeTab === 'meetings' ? 'active' : ''}
                onClick={() => setActiveTab('meetings')}
              >
                📅 Meetings
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Content Area */}
      <div className="dashboard-content">
        {/* Admin Panel */}
        {activeTab === 'admin' && hasPermission('approve_users') && (
          <AdminPanel
            pendingUsers={pendingUsers}
            approvedMarshals={approvedMarshals}
            taxiRanks={taxiRanks}
            onApproveUser={approveUser}
            onRejectUser={rejectUser}
            activityLogs={activityLogs}
            createAdmin={createAdmin}
            reloadTaxiRanks={loadTaxiRanks}
            reloadApprovedMarshals={loadApprovedMarshals}
          />
        )}

        {/* Reports Panel */}
        {activeTab === 'reports' && hasPermission('view_reports') && (
          <ReportsPanel
            reports={reports}
            loads={loads}
            payments={payments}
            taxis={taxis}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
          />
        )}

        {/* Marshal Panels */}
        {marshalProfile?.role === 'Marshal' && (
          <>
            {activeTab === 'overview' && (
              <OverviewPanel
                stats={stats}
                taxis={taxis}
                selectedTaxi={selectedTaxi}
                setSelectedTaxi={setSelectedTaxi}
                onRecordLoad={recordLoad}
                loading={loading}
              />
            )}

            {activeTab === 'ranks' && (
              <TaxiRanksPanel
                taxiRanks={taxiRanks}
                onAddRank={addTaxiRank}
                showAddModal={showAddRankModal}
                setShowAddModal={setShowAddRankModal}
              />
            )}

            {activeTab === 'taxis' && (
              <TaxisPanel
                taxis={taxis}
                onAddTaxi={addTaxi}
                showAddModal={showAddTaxiModal}
                setShowAddModal={setShowAddTaxiModal}
                searchReg={searchReg}
                setSearchReg={setSearchReg}
                taxiRanks={taxiRanks}
              />
            )}

            {activeTab === 'loads' && (
              <LoadsPanel
                loads={loads}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsPanel
                payments={payments}
                taxis={taxis}
                onRecordPayment={recordPayment}
                showPaymentModal={showPaymentModal}
                setShowPaymentModal={setShowPaymentModal}
              />
            )}

            {activeTab === 'meetings' && (
              <MeetingsPanel
                meetings={meetings}
                onCreateMeeting={createMeeting}
                showMeetingModal={showMeetingModal}
                setShowMeetingModal={setShowMeetingModal}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Admin Panel Component
function AdminPanel({ pendingUsers, approvedMarshals, taxiRanks, onApproveUser, onRejectUser, activityLogs, createAdmin, reloadTaxiRanks, reloadApprovedMarshals }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignedRole, setAssignedRole] = useState('');
  const [assignedRank, setAssignedRank] = useState('');
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  
  // Taxi Rank Management
  const [showRankModal, setShowRankModal] = useState(false);
  const [showEditRankModal, setShowEditRankModal] = useState(false);
  const [showAssignRankModal, setShowAssignRankModal] = useState(false);
  const [showManageRankModal, setShowManageRankModal] = useState(false);
  const [newRankName, setNewRankName] = useState('');
  const [newRankLocation, setNewRankLocation] = useState('');
  const [newRankDescription, setNewRankDescription] = useState('');
  const [newRankLatitude, setNewRankLatitude] = useState('');
  const [newRankLongitude, setNewRankLongitude] = useState('');
  const [newRankRoutes, setNewRankRoutes] = useState([{ departure: '', destination: '', fare: '' }]);
  const [selectedRankId, setSelectedRankId] = useState('');
  const [selectedMarshalIds, setSelectedMarshalIds] = useState([]);
  const [rankToManage, setRankToManage] = useState(null);
  const [rankToEdit, setRankToEdit] = useState(null);
  const [editRankName, setEditRankName] = useState('');
  const [editRankLocation, setEditRankLocation] = useState('');
  const [editRankDescription, setEditRankDescription] = useState('');
  const [editRankLatitude, setEditRankLatitude] = useState('');
  const [editRankLongitude, setEditRankLongitude] = useState('');
  const [editRankDestinations, setEditRankDestinations] = useState(['']);
  const [editRankAisles, setEditRankAisles] = useState([]);
  const [editNumberOfAisles, setEditNumberOfAisles] = useState('');

  // User Management
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserRank, setEditUserRank] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkAction, setBulkAction] = useState('');

  const handleApproval = () => {
    if (!selectedUser || !assignedRole) {
      alert('Please select a user and assign a role');
      return;
    }
    
    if (assignedRole === 'Marshal' && !assignedRank) {
      alert('Please assign a taxi rank for Marshal role');
      return;
    }

    onApproveUser(selectedUser.id, assignedRole, assignedRank);
    setSelectedUser(null);
    setAssignedRole('');
    setAssignedRank('');
  };

  const handleCreateRank = async () => {
    if (!newRankName || !newRankLocation) {
      alert('Please fill in rank name and address');
      return;
    }

    if (!newRankLatitude || !newRankLongitude) {
      alert('Please enter GPS coordinates so users can find this rank');
      return;
    }

    // Validate coordinates
    const lat = parseFloat(newRankLatitude);
    const lng = parseFloat(newRankLongitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates (numbers only)');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Latitude must be between -90 and 90');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      alert('Longitude must be between -180 and 180');
      return;
    }

    try {
      const rankData = {
        name: newRankName,
        address: newRankLocation, // Store address as string
        location: { // Store coordinates for maps
          lat: lat,
          lng: lng
        },
        description: newRankDescription,
        createdAt: Timestamp.now(),
        assignedMarshals: [],
        status: 'active',
        destinations: [], // Keep for backward compatibility
        routes: newRankRoutes.filter(route => route.departure && route.destination && route.fare), // Save routes with fares
        aisles: [] // Initialize empty aisles array
      };

      await addDoc(collection(db, 'taxiRanks'), rankData);

      alert('✅ Taxi rank created successfully! It will now appear in the user app.');
      setShowRankModal(false);
      setNewRankName('');
      setNewRankLocation('');
      setNewRankDescription('');
      setNewRankLatitude('');
      setNewRankLongitude('');
      
      // Reload ranks using callback
      if (reloadTaxiRanks) {
        await reloadTaxiRanks();
      }
    } catch (error) {
      console.error('Error creating rank:', error);
      alert('Failed to create rank: ' + error.message);
    }
  };

  const handleAssignMarshalsToRank = async () => {
    if (!selectedRankId) {
      alert('Please select a taxi rank');
      return;
    }

    if (selectedMarshalIds.length === 0) {
      alert('Please select at least one marshal or supervisor');
      return;
    }

    try {
      // Update the rank with assigned marshals
      const rankRef = doc(db, 'taxiRanks', selectedRankId);
      await updateDoc(rankRef, {
        assignedMarshals: selectedMarshalIds,
        updatedAt: Timestamp.now()
      });

      // Update each selected marshal's rank
      // Get the rank name first
      const rankSnapshot = await getDoc(rankRef);
      const rankName = rankSnapshot.data()?.name;

      for (const marshalId of selectedMarshalIds) {
        const marshalRef = doc(db, 'marshalls', marshalId);
        await updateDoc(marshalRef, {
          rank: rankName, // Store rank name instead of ID for compatibility
          updatedAt: Timestamp.now()
        });
      }

      alert('✅ Marshals assigned to rank successfully!');
      setShowAssignRankModal(false);
      setSelectedRankId('');
      setSelectedMarshalIds([]);
      
      // Reload data using callbacks
      if (reloadTaxiRanks) {
        await reloadTaxiRanks();
      }
      if (reloadApprovedMarshals) {
        await reloadApprovedMarshals();
      }
    } catch (error) {
      console.error('Error assigning marshals:', error);
      alert('Failed to assign marshals: ' + error.message);
    }
  };

  const toggleMarshalSelection = (marshalId) => {
    setSelectedMarshalIds(prev => 
      prev.includes(marshalId) 
        ? prev.filter(id => id !== marshalId)
        : [...prev, marshalId]
    );
  };

  const handleDeleteRank = async (rankId) => {
    if (!window.confirm('Are you sure you want to delete this taxi rank? Marshals assigned to it will need to be reassigned.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'taxiRanks', rankId));
      alert('✅ Taxi rank deleted successfully!');
      
      // Reload ranks using callback
      if (reloadTaxiRanks) {
        await reloadTaxiRanks();
      }
    } catch (error) {
      console.error('Error deleting rank:', error);
      alert('Failed to delete rank: ' + error.message);
    }
  };

  const handleRemoveUserFromRank = async (userId, rankId, rankName) => {
    if (!window.confirm('Remove this user from the rank?')) {
      return;
    }

    try {
      // Get the rank document
      const rankRef = doc(db, 'taxiRanks', rankId);
      const rankSnapshot = await getDoc(rankRef);
      const currentAssignedMarshals = rankSnapshot.data()?.assignedMarshals || [];

      // Remove user from rank's assignedMarshals array
      const updatedMarshals = currentAssignedMarshals.filter(id => id !== userId);
      await updateDoc(rankRef, {
        assignedMarshals: updatedMarshals,
        updatedAt: Timestamp.now()
      });

      // Clear the rank from user's profile
      const userRef = doc(db, 'marshalls', userId);
      await updateDoc(userRef, {
        rank: null,
        updatedAt: Timestamp.now()
      });

      alert('✅ User removed from rank successfully!');
      
      // Reload data
      if (reloadTaxiRanks) {
        await reloadTaxiRanks();
      }
      if (reloadApprovedMarshals) {
        await reloadApprovedMarshals();
      }
    } catch (error) {
      console.error('Error removing user from rank:', error);
      alert('Failed to remove user: ' + error.message);
    }
  };

  const handleOpenManageRank = (rank) => {
    // Get currently assigned users for this rank
    const assignedUsers = approvedMarshals.filter(m => 
      rank.assignedMarshals?.includes(m.id) || m.rank === rank.name
    );
    
    setRankToManage({
      ...rank,
      assignedUsers: assignedUsers
    });
    
    // Pre-select currently assigned users
    setSelectedMarshalIds(assignedUsers.map(u => u.id));
    setShowManageRankModal(true);
  };

  const handleReassignUsers = async () => {
    if (!rankToManage) return;

    try {
      // Get currently assigned user IDs
      const currentlyAssigned = rankToManage.assignedUsers.map(u => u.id);
      
      // Find users to add and remove
      const usersToAdd = selectedMarshalIds.filter(id => !currentlyAssigned.includes(id));
      const usersToRemove = currentlyAssigned.filter(id => !selectedMarshalIds.includes(id));

      // Update the rank document
      const rankRef = doc(db, 'taxiRanks', rankToManage.id);
      await updateDoc(rankRef, {
        assignedMarshals: selectedMarshalIds,
        updatedAt: Timestamp.now()
      });

      // Update users being added
      for (const userId of usersToAdd) {
        const userRef = doc(db, 'marshalls', userId);
        await updateDoc(userRef, {
          rank: rankToManage.name,
          updatedAt: Timestamp.now()
        });
      }

      // Update users being removed
      for (const userId of usersToRemove) {
        const userRef = doc(db, 'marshalls', userId);
        await updateDoc(userRef, {
          rank: null,
          updatedAt: Timestamp.now()
        });
      }

      alert(`✅ Rank assignments updated!\nAdded: ${usersToAdd.length}\nRemoved: ${usersToRemove.length}`);
      setShowManageRankModal(false);
      setRankToManage(null);
      setSelectedMarshalIds([]);
      
      // Reload data
      if (reloadTaxiRanks) {
        await reloadTaxiRanks();
      }
      if (reloadApprovedMarshals) {
        await reloadApprovedMarshals();
      }
    } catch (error) {
      console.error('Error reassigning users:', error);
      alert('Failed to update assignments: ' + error.message);
    }
  };

  return (
    <div className="admin-panel">
      {/* Pending Users */}
      <div className="admin-section">
        <h2>📋 Pending User Approvals ({pendingUsers.length})</h2>
        {pendingUsers.length > 0 ? (
          <div className="users-grid">
            {pendingUsers.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-header">
                  <h3>{user.name}</h3>
                  <span className="user-date">
                    {user.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <div className="user-details">
                  <p>📧 {user.email}</p>
                  <p>📱 {user.phone}</p>
                </div>
                <div className="user-actions">
                  <button
                    className="approve-btn"
                    onClick={() => setSelectedUser(user)}
                  >
                    Assign Role
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => onRejectUser(user.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No pending approvals</p>
          </div>
        )}
      </div>

      {/* Role Assignment Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Assign Role to {selectedUser.name}</h3>
            
            <div className="form-group">
              <label>Select Role *</label>
              <select
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
              >
                <option value="">-- Select Role --</option>
                <option value="Admin">Admin - Full system access</option>
                <option value="Supervisor">Supervisor - View reports only</option>
                <option value="Marshal">Marshal - Manage taxi operations</option>
              </select>
            </div>

            {assignedRole === 'Marshal' && (
              <div className="form-group">
                <label>Assign Taxi Rank *</label>
                <select
                  value={assignedRank}
                  onChange={(e) => setAssignedRank(e.target.value)}
                >
                  <option value="">-- Select Taxi Rank --</option>
                  {taxiRanks.map(rank => (
                    <option key={rank.id} value={rank.name}>
                      {rank.name} - {rank.address || (typeof rank.location === 'string' ? rank.location : 'Location not set')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleApproval}>
                Approve & Assign
              </button>
              <button className="secondary-btn" onClick={() => setSelectedUser(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Account Creation */}
      <div className="admin-section">
        <div className="section-header">
          <h2>👑 Admin Account Management</h2>
          <button
            className="create-admin-btn"
            onClick={() => setShowCreateAdminModal(true)}
          >
            ➕ Create New Admin
          </button>
        </div>
        <div className="info-box" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '8px', fontSize: '0.875rem' }}>
          <strong>Admin Creation:</strong> Only existing administrators can create new admin accounts. This ensures secure admin role management.
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreateAdminModal && (
        <div className="modal-overlay" onClick={() => setShowCreateAdminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Admin Account</h3>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@taxihub.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={newAdminPhone}
                onChange={(e) => setNewAdminPhone(e.target.value)}
                placeholder="+27 12 345 6789"
                required
              />
            </div>

            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div className="info-box" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '0.875rem' }}>
              <strong>Note:</strong> New admin accounts are automatically approved and have full system access. They can create additional admin accounts.
            </div>

            <div className="modal-actions">
              <button
                className="primary-btn"
                onClick={async () => {
                  if (!newAdminName || !newAdminEmail || !newAdminPhone || !newAdminPassword) {
                    alert('Please fill in all required fields');
                    return;
                  }

                  setCreatingAdmin(true);
                  try {
                    await onCreateAdmin({
                      name: newAdminName,
                      email: newAdminEmail,
                      phone: newAdminPhone,
                      password: newAdminPassword
                    });

                    setNewAdminName('');
                    setNewAdminEmail('');
                    setNewAdminPhone('');
                    setNewAdminPassword('');
                    setShowCreateAdminModal(false);
                  } catch (error) {
                    // Error handling is done in createAdmin function
                  } finally {
                    setCreatingAdmin(false);
                  }
                }}
                disabled={creatingAdmin}
              >
                {creatingAdmin ? 'Creating...' : 'Create Admin Account'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowCreateAdminModal(false)}
                disabled={creatingAdmin}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Taxi Rank Management */}
      <div className="admin-section">
        <div className="section-header">
          <h2>🚕 Taxi Rank Management</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="create-admin-btn"
              onClick={() => setShowRankModal(true)}
            >
              ➕ Create New Rank
            </button>
            <button
              className="create-admin-btn"
              onClick={() => setShowAssignRankModal(true)}
              style={{ backgroundColor: '#4CAF50' }}
            >
              👥 Assign Users to Rank
            </button>
          </div>
        </div>

        {taxiRanks.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank Name</th>
                  <th>Address</th>
                  <th>Coordinates</th>
                  <th>Assigned Users</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxiRanks.map(rank => {
                  const assignedUsers = approvedMarshals.filter(m => 
                    rank.assignedMarshals?.includes(m.id) || m.rank === rank.name
                  );
                  return (
                    <tr key={rank.id}>
                      <td><strong>{rank.name}</strong></td>
                      <td>
                        {rank.address || (typeof rank.location === 'string' ? rank.location : '-')}
                        {rank.description && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                            {rank.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {rank.location?.lat && rank.location?.lng ? (
                          <div style={{ fontSize: '0.75rem' }}>
                            <div>📍 {rank.location.lat.toFixed(4)}, {rank.location.lng.toFixed(4)}</div>
                            <a 
                              href={`https://www.google.com/maps?q=${rank.location.lat},${rank.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#2196F3', textDecoration: 'none', fontSize: '0.7rem' }}
                            >
                              View on Map →
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: '#ff9800', fontSize: '0.75rem' }}>⚠️ No coordinates</span>
                        )}
                      </td>
                      <td>
                        {assignedUsers.length > 0 ? (
                          <div style={{ fontSize: '0.875rem' }}>
                            {assignedUsers.map(user => (
                              <div key={user.id} style={{ 
                                marginBottom: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '4px 8px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px'
                              }}>
                                <div>
                                  <span className={`role-badge role-${user.role?.toLowerCase()}`}>
                                    {user.role}
                                  </span> {user.name}
                                </div>
                                <button
                                  onClick={() => handleRemoveUserFromRank(user.id, rank.id, rank.name)}
                                  style={{
                                    backgroundColor: '#ff5252',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                    marginLeft: '8px'
                                  }}
                                  title="Remove from rank"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>No users assigned</span>
                        )}
                      </td>
                      <td>{rank.createdAt?.toDate().toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            className="approve-btn"
                            onClick={() => handleOpenManageRank(rank)}
                            style={{ fontSize: '0.75rem', padding: '4px 8px', backgroundColor: '#2196F3' }}
                          >
                            👥 Manage Users
                          </button>
                          <button
                            className="reject-btn"
                            onClick={() => handleDeleteRank(rank.id)}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            🗑️ Delete Rank
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No taxi ranks created yet. Create one to get started!</p>
          </div>
        )}
      </div>

      {/* Create Rank Modal */}
      {showRankModal && (
        <div className="modal-overlay" onClick={() => setShowRankModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Taxi Rank</h3>

            <div className="form-group">
              <label>Rank Name *</label>
              <input
                type="text"
                value={newRankName}
                onChange={(e) => setNewRankName(e.target.value)}
                placeholder="e.g., Central Station Rank"
                required
              />
            </div>

            <div className="form-group">
              <label>Location / Address *</label>
              <input
                type="text"
                value={newRankLocation}
                onChange={(e) => setNewRankLocation(e.target.value)}
                placeholder="e.g., Main Street, Cape Town"
                required
              />
              <small style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginTop: '4px' }}>
                Enter the physical address of the taxi rank
              </small>
            </div>

            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '15px', 
              backgroundColor: '#f9f9f9',
              marginBottom: '15px'
            }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                📍 GPS Coordinates (Required for User App)
              </label>
              <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px' }}>
                Add coordinates so users can find this rank and get directions
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label>Latitude *</label>
                  <input
                    type="text"
                    value={newRankLatitude}
                    onChange={(e) => setNewRankLatitude(e.target.value)}
                    placeholder="-33.9249"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label>Longitude *</label>
                  <input
                    type="text"
                    value={newRankLongitude}
                    onChange={(e) => setNewRankLongitude(e.target.value)}
                    placeholder="18.4241"
                    required
                  />
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setNewRankLatitude(position.coords.latitude.toString());
                        setNewRankLongitude(position.coords.longitude.toString());
                        alert('✅ Current location captured!');
                      },
                      (error) => {
                        alert('Unable to get location. Please enter coordinates manually.');
                      }
                    );
                  } else {
                    alert('Geolocation is not supported by your browser');
                  }
                }}
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📍 Use My Current Location
              </button>
              
              <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '8px' }}>
                Tip: You can find coordinates on Google Maps by right-clicking a location
              </p>
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                value={newRankDescription}
                onChange={(e) => setNewRankDescription(e.target.value)}
                placeholder="Additional details about this rank..."
                rows="3"
              />
            </div>

            {/* Routes Configuration */}
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: '#f9f9f9',
              marginBottom: '15px'
            }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                🛣️ Routes & Fares (Optional)
              </label>
              <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px' }}>
                Add routes with departure, destination, and fare information for users to see available options.
              </p>

              {newRankRoutes.map((route, index) => (
                <div key={index} style={{
                  backgroundColor: 'white',
                  padding: '10px',
                  marginBottom: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Departure</label>
                      <input
                        type="text"
                        value={route.departure}
                        onChange={(e) => {
                          const updated = [...newRankRoutes];
                          updated[index].departure = e.target.value;
                          setNewRankRoutes(updated);
                        }}
                        placeholder="From location"
                        style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Destination</label>
                      <input
                        type="text"
                        value={route.destination}
                        onChange={(e) => {
                          const updated = [...newRankRoutes];
                          updated[index].destination = e.target.value;
                          setNewRankRoutes(updated);
                        }}
                        placeholder="To location"
                        style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Fare (R)</label>
                      <input
                        type="number"
                        value={route.fare}
                        onChange={(e) => {
                          const updated = [...newRankRoutes];
                          updated[index].fare = e.target.value;
                          setNewRankRoutes(updated);
                        }}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = newRankRoutes.filter((_, i) => i !== index);
                        setNewRankRoutes(updated.length > 0 ? updated : [{ departure: '', destination: '', fare: '' }]);
                      }}
                      style={{
                        backgroundColor: '#ff5252',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="Remove route"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setNewRankRoutes([...newRankRoutes, { departure: '', destination: '', fare: '' }])}
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ➕ Add Another Route
              </button>
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleCreateRank}>
                Create Rank
              </button>
              <button className="secondary-btn" onClick={() => setShowRankModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Marshals to Rank Modal */}
      {showAssignRankModal && (
        <div className="modal-overlay" onClick={() => setShowAssignRankModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>Assign Users to Taxi Rank</h3>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '20px' }}>
              Select a rank and then choose one or more marshals/supervisors to assign to it.
            </p>

            <div className="form-group">
              <label>Select Taxi Rank *</label>
              <select
                value={selectedRankId}
                onChange={(e) => setSelectedRankId(e.target.value)}
                required
              >
                <option value="">-- Select Rank --</option>
                {taxiRanks.map(rank => (
                  <option key={rank.id} value={rank.id}>
                    {rank.name} - {rank.address || (typeof rank.location === 'string' ? rank.location : 'Location not set')}
                  </option>
                ))}
              </select>
            </div>

            {selectedRankId && (
              <div className="form-group">
                <label>Select Users (Marshals & Supervisors) *</label>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  padding: '10px' 
                }}>
                  {approvedMarshals
                    .filter(m => m.role === 'Marshal' || m.role === 'Supervisor')
                    .map(marshal => (
                      <label 
                        key={marshal.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px', 
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMarshalIds.includes(marshal.id)}
                          onChange={() => toggleMarshalSelection(marshal.id)}
                          style={{ marginRight: '10px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span className={`role-badge role-${marshal.role?.toLowerCase()}`}>
                            {marshal.role}
                          </span>
                          <strong> {marshal.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {marshal.email} {marshal.rank && `• Current: ${marshal.rank}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  
                  {approvedMarshals.filter(m => m.role === 'Marshal' || m.role === 'Supervisor').length === 0 && (
                    <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                      No marshals or supervisors available
                    </p>
                  )}
                </div>
                
                {selectedMarshalIds.length > 0 && (
                  <p style={{ marginTop: '10px', fontSize: '0.875rem', color: '#4CAF50' }}>
                    ✓ {selectedMarshalIds.length} user(s) selected
                  </p>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="primary-btn" 
                onClick={handleAssignMarshalsToRank}
                disabled={!selectedRankId || selectedMarshalIds.length === 0}
              >
                Assign to Rank
              </button>
              <button className="secondary-btn" onClick={() => {
                setShowAssignRankModal(false);
                setSelectedRankId('');
                setSelectedMarshalIds([]);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Rank Users Modal */}
      {showManageRankModal && rankToManage && (
        <div className="modal-overlay" onClick={() => {
          setShowManageRankModal(false);
          setRankToManage(null);
          setSelectedMarshalIds([]);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>Manage Users for "{rankToManage.name}"</h3>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '20px' }}>
              Select or deselect users to assign or remove them from this rank. 
              Changes will be saved when you click "Update Assignments".
            </p>

            <div className="form-group">
              <label>Current & Available Users</label>
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '10px' 
              }}>
                {approvedMarshals
                  .filter(m => m.role === 'Marshal' || m.role === 'Supervisor')
                  .map(marshal => {
                    const isCurrentlyAssigned = rankToManage.assignedUsers.some(u => u.id === marshal.id);
                    const isSelected = selectedMarshalIds.includes(marshal.id);
                    
                    return (
                      <label 
                        key={marshal.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px', 
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          backgroundColor: isCurrentlyAssigned ? '#e8f5e9' : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMarshalSelection(marshal.id)}
                          style={{ marginRight: '10px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span className={`role-badge role-${marshal.role?.toLowerCase()}`}>
                            {marshal.role}
                          </span>
                          <strong> {marshal.name}</strong>
                          {isCurrentlyAssigned && (
                            <span style={{ 
                              marginLeft: '8px', 
                              fontSize: '0.7rem', 
                              color: '#4CAF50',
                              fontWeight: 'bold'
                            }}>
                              ✓ Currently Assigned
                            </span>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {marshal.email}
                            {marshal.rank && marshal.rank !== rankToManage.name && (
                              <span style={{ color: '#ff9800', marginLeft: '8px' }}>
                                • Currently at: {marshal.rank}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                
                {approvedMarshals.filter(m => m.role === 'Marshal' || m.role === 'Supervisor').length === 0 && (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    No marshals or supervisors available
                  </p>
                )}
              </div>
              
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
                <strong>Summary:</strong>
                <div style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                  <div>• Currently assigned: {rankToManage.assignedUsers.length} user(s)</div>
                  <div>• Will be assigned: {selectedMarshalIds.length} user(s)</div>
                  {selectedMarshalIds.length !== rankToManage.assignedUsers.length && (
                    <div style={{ color: '#2196F3', marginTop: '4px' }}>
                      → Changes detected: Click "Update Assignments" to save
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="primary-btn" 
                onClick={handleReassignUsers}
              >
                💾 Update Assignments
              </button>
              <button className="secondary-btn" onClick={() => {
                setShowManageRankModal(false);
                setRankToManage(null);
                setSelectedMarshalIds([]);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approved Marshals */}
      <div className="admin-section">
        <h2>✅ Approved Users ({approvedMarshals.length})</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedMarshals.map(marshal => (
                <tr key={marshal.id} className={marshal.suspended ? 'suspended-user' : ''}>
                  <td>{marshal.name}</td>
                  <td>{marshal.email}</td>
                  <td>{marshal.phone || '-'}</td>
                  <td>
                    <span className={`role-badge role-${marshal.role?.toLowerCase()}`}>
                      {marshal.role}
                    </span>
                  </td>
                  <td>{marshal.rank || '-'}</td>
                  <td>
                    <span className={`status-badge ${marshal.suspended ? 'suspended' : 'active'}`}>
                      {marshal.suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td>
                    {marshal.lastLogin?.toDate().toLocaleDateString() || 'Never'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => {
                          setUserToEdit(marshal);
                          setEditUserName(marshal.name);
                          setEditUserEmail(marshal.email);
                          setEditUserPhone(marshal.phone || '');
                          setEditUserRole(marshal.role);
                          setEditUserRank(marshal.rank || '');
                          setShowEditUserModal(true);
                        }}
                        title="Edit User"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={`action-btn ${marshal.suspended ? 'unsuspend-btn' : 'suspend-btn'}`}
                        onClick={() => toggleUserSuspension(marshal.id, marshal.suspended)}
                        title={marshal.suspended ? 'Unsuspend User' : 'Suspend User'}
                      >
                        {marshal.suspended ? '🔓 Unsuspend' : '🚫 Suspend'}
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => {
                          setUserToDelete(marshal);
                          setDeleteConfirmation('');
                          setShowDeleteUserModal(true);
                        }}
                        title="Delete User"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditUserModal && userToEdit && (
        <div className="modal-overlay" onClick={() => setShowEditUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit User: {userToEdit.name}</h3>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                placeholder="user@taxihub.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={editUserPhone}
                onChange={(e) => setEditUserPhone(e.target.value)}
                placeholder="+27 12 345 6789"
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value)}
                required
              >
                <option value="">-- Select Role --</option>
                <option value="Admin">Admin - Full system access</option>
                <option value="Supervisor">Supervisor - View reports only</option>
                <option value="Marshal">Marshal - Manage taxi operations</option>
              </select>
            </div>

            {editUserRole === 'Marshal' && (
              <div className="form-group">
                <label>Assigned Taxi Rank</label>
                <select
                  value={editUserRank}
                  onChange={(e) => setEditUserRank(e.target.value)}
                >
                  <option value="">-- No rank assigned --</option>
                  {taxiRanks.map(rank => (
                    <option key={rank.id} value={rank.name}>
                      {rank.name} - {rank.address || (typeof rank.location === 'string' ? rank.location : 'Location not set')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="primary-btn"
                onClick={() => {
                  if (!editUserName || !editUserEmail || !editUserRole) {
                    alert('Please fill in all required fields');
                    return;
                  }

                  if (editUserRole === 'Marshal' && !editUserRank) {
                    alert('Please assign a taxi rank for Marshal role');
                    return;
                  }

                  editUser(userToEdit.id, {
                    name: editUserName,
                    email: editUserEmail,
                    phone: editUserPhone,
                    role: editUserRole,
                    rank: editUserRole === 'Marshal' ? editUserRank : null
                  });

                  setShowEditUserModal(false);
                  setUserToEdit(null);
                }}
              >
                💾 Save Changes
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowEditUserModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteUserModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ DANGER ZONE ⚠️</h3>
            <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '20px' }}>
              You are about to permanently delete user: <strong>{userToDelete.name}</strong> ({userToDelete.email})
            </p>

            <div style={{ backgroundColor: '#fef2f2', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <strong>This action cannot be undone and will:</strong>
              <ul style={{ marginTop: '10px', marginLeft: '20px' }}>
                <li>Delete all user data permanently</li>
                <li>Remove user from all assigned ranks</li>
                <li>Delete login history and activity logs</li>
                <li>Prevent user from accessing the system</li>
              </ul>
            </div>

            <div className="form-group">
              <label style={{ color: '#dc2626', fontWeight: 'bold' }}>
                Type "YES" to confirm deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type YES to confirm"
                style={{ borderColor: '#dc2626' }}
              />
            </div>

            <div className="modal-actions">
              <button
                className="primary-btn"
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => {
                  if (deleteConfirmation !== 'YES') {
                    alert('Please type "YES" to confirm deletion');
                    return;
                  }

                  deleteUser(userToDelete.id, userToDelete.email);
                  setShowDeleteUserModal(false);
                  setUserToDelete(null);
                  setDeleteConfirmation('');
                }}
                disabled={deleteConfirmation !== 'YES'}
              >
                🗑️ Permanently Delete User
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowDeleteUserModal(false);
                  setUserToDelete(null);
                  setDeleteConfirmation('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs */}
      <div className="admin-section">
        <h2>📜 Recent Activity</h2>
        <div className="activity-logs">
          {activityLogs.slice(0, 10).map(log => (
            <div key={log.id} className="log-item">
              <span className="log-action">{log.action}</span>
              <span className="log-user">{log.performedBy || log.email}</span>
              <span className="log-time">
                {log.timestamp?.toDate().toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Reports Panel Component
function ReportsPanel({ reports, loads, payments, taxis, timeFilter, setTimeFilter }) {
  return (
    <div className="reports-panel">
      <div className="reports-header">
        <h2>📊 System Reports</h2>
        <div className="time-filter">
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <h3>📦 Daily Loads</h3>
          <div className="report-value">{reports.dailyLoads || 0}</div>
          <p className="report-label">Loads Today</p>
        </div>

        <div className="report-card">
          <h3>💰 Weekly Revenue</h3>
          <div className="report-value">R{(reports.weeklyRevenue || 0).toFixed(2)}</div>
          <p className="report-label">Past 7 Days</p>
        </div>

        <div className="report-card">
          <h3>👥 Active Marshals</h3>
          <div className="report-value">{reports.activeMarshals || 0}</div>
          <p className="report-label">Last 24 Hours</p>
        </div>

        <div className="report-card">
          <h3>🚖 Total Taxis</h3>
          <div className="report-value">{reports.totalTaxis || 0}</div>
          <p className="report-label">Registered</p>
        </div>
      </div>

      {/* Detailed Reports Section */}
      <div className="detailed-reports">
        <h3>📈 Detailed Analytics</h3>
        
        <div className="report-section">
          <h4>Load Distribution by Time</h4>
          <div className="chart-placeholder">
            {/* Chart would go here */}
            <p>Load distribution chart visualization</p>
          </div>
        </div>

        <div className="report-section">
          <h4>Revenue Trends</h4>
          <div className="chart-placeholder">
            {/* Chart would go here */}
            <p>Revenue trends visualization</p>
          </div>
        </div>

        <div className="report-section">
          <h4>Top Performing Taxis</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Driver</th>
                <th>Total Loads</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {taxis.slice(0, 5).map(taxi => (
                <tr key={taxi.id}>
                  <td>{taxi.registration}</td>
                  <td>{taxi.driverName}</td>
                  <td>{taxi.totalLoads || 0}</td>
                  <td>R{(taxi.revenue || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Overview Panel Component
function OverviewPanel({ stats, taxis, selectedTaxi, setSelectedTaxi, onRecordLoad, loading }) {
  return (
    <div className="overview-panel">
      <h2>📊 Today's Overview</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>Today's Loads</h3>
            <p className="stat-value">{stats.today}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Week Total</h3>
            <p className="stat-value">{stats.week}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Revenue</h3>
            <p className="stat-value">R{stats.totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Paid Today</h3>
            <p className="stat-value">{stats.paidToday}</p>
          </div>
        </div>
      </div>

      {/* Quick Load Recording */}
      <div className="quick-record">
        <h3>📝 Record Load</h3>
        <div className="record-form">
          <select
            value={selectedTaxi}
            onChange={(e) => setSelectedTaxi(e.target.value)}
            className="taxi-select"
          >
            <option value="">Select Taxi</option>
            {taxis.map(taxi => (
              <option key={taxi.id} value={taxi.id}>
                {taxi.registration} - {taxi.driverName}
              </option>
            ))}
          </select>
          <button
            onClick={onRecordLoad}
            disabled={loading || !selectedTaxi}
            className="record-btn"
          >
            {loading ? 'Recording...' : 'Record Load'}
          </button>
        </div>
      </div>
    </div>
  );
}

// TaxiRanksPanel Component
function TaxiRanksPanel({ taxiRanks, onAddRank, showAddModal, setShowAddModal }) {
  const [newRankName, setNewRankName] = useState('');
  const [newRankLocation, setNewRankLocation] = useState('');
  const [newRankCapacity, setNewRankCapacity] = useState('');
  const [newRankDescription, setNewRankDescription] = useState('');
  const [newRankLatitude, setNewRankLatitude] = useState('');
  const [newRankLongitude, setNewRankLongitude] = useState('');
  const [numberOfAisles, setNumberOfAisles] = useState('');
  const [aisles, setAisles] = useState([]);

  const handleAisleCountChange = (count) => {
    setNumberOfAisles(count);
    const aisleCount = parseInt(count) || 0;
    const newAisles = [];
    for (let i = 1; i <= aisleCount; i++) {
      newAisles.push({
        aisleNumber: i,
        name: `Aisle ${i}`,
        capacity: 0,
        assignedTaxis: []
      });
    }
    setAisles(newAisles);
  };

  const updateAisleName = (index, name) => {
    const updated = [...aisles];
    updated[index].name = name;
    setAisles(updated);
  };

  const updateAisleCapacity = (index, capacity) => {
    const updated = [...aisles];
    updated[index].capacity = parseInt(capacity) || 0;
    setAisles(updated);
  };

  const handleAddRank = () => {
    if (!newRankName || !newRankLocation) {
      alert('Please fill in rank name and address');
      return;
    }

    if (!newRankLatitude || !newRankLongitude) {
      alert('Please enter GPS coordinates so users can find this rank');
      return;
    }

    // Validate coordinates
    const lat = parseFloat(newRankLatitude);
    const lng = parseFloat(newRankLongitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates (numbers only)');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Latitude must be between -90 and 90');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      alert('Longitude must be between -180 and 180');
      return;
    }

    onAddRank({
      name: newRankName,
      address: newRankLocation,
      location: {
        lat: lat,
        lng: lng
      },
      description: newRankDescription,
      capacity: parseInt(newRankCapacity) || 0,
      aisles: aisles.length > 0 ? aisles : [],
      numberOfAisles: aisles.length
    });

    setNewRankName('');
    setNewRankLocation('');
    setNewRankCapacity('');
    setNewRankDescription('');
    setNewRankLatitude('');
    setNewRankLongitude('');
    setNumberOfAisles('');
    setAisles([]);
    setShowAddModal(false);
  };

  return (
    <div className="taxi-ranks-panel">
      <div className="panel-header">
        <h2>📍 Taxi Ranks Management</h2>
        <button
          className="add-btn"
          onClick={() => setShowAddModal(true)}
        >
          ➕ Add Rank
        </button>
      </div>

      <div className="ranks-grid">
        {taxiRanks.map(rank => (
          <div key={rank.id} className="rank-card">
            <div className="rank-header">
              <h3>{rank.name}</h3>
              <span className="rank-location">📍 {rank.address || (typeof rank.location === 'string' ? rank.location : rank.location?.lat ? `${rank.location.lat.toFixed(4)}, ${rank.location.lng.toFixed(4)}` : 'Location not set')}</span>
            </div>
            <div className="rank-details">
              {rank.description && <p>📝 {rank.description}</p>}
              <p>👥 Capacity: {rank.capacity || 'Not set'}</p>
              {rank.aisles && rank.aisles.length > 0 && (
                <p>🚦 Aisles: {rank.aisles.length} 
                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '8px' }}>
                    ({rank.aisles.map(a => a.name).join(', ')})
                  </span>
                </p>
              )}
              {rank.location?.lat && rank.location?.lng && (
                <p>
                  📍 GPS: {rank.location.lat.toFixed(4)}, {rank.location.lng.toFixed(4)}
                  <a 
                    href={`https://www.google.com/maps?q=${rank.location.lat},${rank.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: '8px', color: '#2196F3', fontSize: '0.75rem' }}
                  >
                    View Map →
                  </a>
                </p>
              )}
              <p>📅 Created: {rank.createdAt?.toDate().toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      {taxiRanks.length === 0 && (
        <div className="empty-state">
          <p>No taxi ranks available. Add your first rank!</p>
        </div>
      )}

      {/* Add Rank Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Taxi Rank</h3>

            <div className="form-group">
              <label>Rank Name *</label>
              <input
                type="text"
                value={newRankName}
                onChange={(e) => setNewRankName(e.target.value)}
                placeholder="e.g., Central Station Rank"
                required
              />
            </div>

            <div className="form-group">
              <label>Location / Address *</label>
              <input
                type="text"
                value={newRankLocation}
                onChange={(e) => setNewRankLocation(e.target.value)}
                placeholder="e.g., Main Street, Cape Town"
                required
              />
              <small style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginTop: '4px' }}>
                Enter the physical address of the taxi rank
              </small>
            </div>

            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '15px', 
              backgroundColor: '#f9f9f9',
              marginBottom: '15px'
            }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                📍 GPS Coordinates (Required for User App)
              </label>
              <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px' }}>
                Add coordinates so users can find this rank and get directions
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label>Latitude *</label>
                  <input
                    type="text"
                    value={newRankLatitude}
                    onChange={(e) => setNewRankLatitude(e.target.value)}
                    placeholder="-33.9249"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label>Longitude *</label>
                  <input
                    type="text"
                    value={newRankLongitude}
                    onChange={(e) => setNewRankLongitude(e.target.value)}
                    placeholder="18.4241"
                    required
                  />
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setNewRankLatitude(position.coords.latitude.toString());
                        setNewRankLongitude(position.coords.longitude.toString());
                        alert('✅ Current location captured!');
                      },
                      (error) => {
                        alert('Unable to get location. Please enter coordinates manually.');
                      }
                    );
                  } else {
                    alert('Geolocation is not supported by your browser');
                  }
                }}
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📍 Use My Current Location
              </button>
              
              <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '8px' }}>
                Tip: You can find coordinates on Google Maps by right-clicking a location
              </p>
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                value={newRankDescription}
                onChange={(e) => setNewRankDescription(e.target.value)}
                placeholder="Additional details about this rank..."
                rows="2"
              />
            </div>

            <div className="form-group">
              <label>Capacity (Optional)</label>
              <input
                type="number"
                value={newRankCapacity}
                onChange={(e) => setNewRankCapacity(e.target.value)}
                placeholder="e.g., 50"
                min="0"
              />
            </div>

            {/* Aisle Configuration */}
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '15px', 
              backgroundColor: '#f9f9f9',
              marginBottom: '15px'
            }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                🚦 Aisle Configuration (Optional)
              </label>
              <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px' }}>
                Define lanes/aisles for better taxi organization
              </p>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label>Number of Aisles</label>
                <input
                  type="number"
                  value={numberOfAisles}
                  onChange={(e) => handleAisleCountChange(e.target.value)}
                  placeholder="e.g., 4"
                  min="0"
                  max="20"
                />
              </div>

              {aisles.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '10px' }}>
                    Configure Each Aisle:
                  </p>
                  {aisles.map((aisle, index) => (
                    <div key={index} style={{ 
                      backgroundColor: 'white', 
                      padding: '10px', 
                      marginBottom: '8px', 
                      borderRadius: '6px',
                      border: '1px solid #ddd'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Aisle Name</label>
                          <input
                            type="text"
                            value={aisle.name}
                            onChange={(e) => updateAisleName(index, e.target.value)}
                            placeholder={`Aisle ${index + 1}`}
                            style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Capacity</label>
                          <input
                            type="number"
                            value={aisle.capacity}
                            onChange={(e) => updateAisleCapacity(index, e.target.value)}
                            placeholder="10"
                            min="0"
                            style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleAddRank}>
                Add Rank
              </button>
              <button className="secondary-btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TaxisPanel Component
function TaxisPanel({ taxis, onAddTaxi, showAddModal, setShowAddModal, searchReg, setSearchReg, taxiRanks }) {
  const [newTaxiReg, setNewTaxiReg] = useState('');
  const [newTaxiDriver, setNewTaxiDriver] = useState('');
  const [newTaxiPhone, setNewTaxiPhone] = useState('');
  const [newTaxiRank, setNewTaxiRank] = useState('');
  const [newTaxiAisle, setNewTaxiAisle] = useState('');

  const filteredTaxis = taxis.filter(taxi =>
    taxi.registration?.toLowerCase().includes(searchReg.toLowerCase()) ||
    taxi.driverName?.toLowerCase().includes(searchReg.toLowerCase())
  );

  const selectedRank = taxiRanks?.find(r => r.name === newTaxiRank);

  const handleAddTaxi = () => {
    if (!newTaxiReg || !newTaxiDriver) {
      alert('Please fill in all required fields');
      return;
    }

    onAddTaxi({
      registration: newTaxiReg,
      driverName: newTaxiDriver,
      driverPhone: newTaxiPhone,
      assignedRank: newTaxiRank,
      assignedAisle: newTaxiAisle
    });

    setNewTaxiReg('');
    setNewTaxiDriver('');
    setNewTaxiPhone('');
    setNewTaxiRank('');
    setNewTaxiAisle('');
    setShowAddModal(false);
  };

  return (
    <div className="taxis-panel">
      <div className="panel-header">
        <h2>🚖 Taxi Management</h2>
        <button
          className="add-btn"
          onClick={() => setShowAddModal(true)}
        >
          ➕ Add Taxi
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by registration or driver name..."
          value={searchReg}
          onChange={(e) => setSearchReg(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="taxis-grid">
        {filteredTaxis.map(taxi => (
          <div key={taxi.id} className="taxi-card">
            <div className="taxi-header">
              <h3>{taxi.registration}</h3>
              <span className="taxi-status">Active</span>
            </div>
            <div className="taxi-details">
              <p>👤 {taxi.driverName}</p>
              <p>📱 {taxi.driverPhone || 'No phone'}</p>
              <p>📍 {taxi.assignedRank || 'No rank assigned'}</p>
              {taxi.assignedAisle && <p>🚦 Aisle: {taxi.assignedAisle}</p>}
              <p>📦 Total Loads: {taxi.totalLoads || 0}</p>
              <p>Last Load: {taxi.lastLoad?.toDate().toLocaleDateString() || 'Never'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Taxi Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Taxi</h3>

            <div className="form-group">
              <label>Registration Number *</label>
              <input
                type="text"
                value={newTaxiReg}
                onChange={(e) => setNewTaxiReg(e.target.value)}
                placeholder="e.g., CA 123 456"
                required
              />
            </div>

            <div className="form-group">
              <label>Driver Name *</label>
              <input
                type="text"
                value={newTaxiDriver}
                onChange={(e) => setNewTaxiDriver(e.target.value)}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="form-group">
              <label>Driver Phone</label>
              <input
                type="tel"
                value={newTaxiPhone}
                onChange={(e) => setNewTaxiPhone(e.target.value)}
                placeholder="+27 12 345 6789"
              />
            </div>

            <div className="form-group">
              <label>Assigned Rank</label>
              <input
                type="text"
                value={newTaxiRank}
                onChange={(e) => setNewTaxiRank(e.target.value)}
                placeholder="e.g., Central Station"
              />
            </div>

            {newTaxiRank && selectedRank && selectedRank.aisles && selectedRank.aisles.length > 0 && (
              <div className="form-group">
                <label>Assigned Aisle</label>
                <select
                  value={newTaxiAisle}
                  onChange={(e) => setNewTaxiAisle(e.target.value)}
                >
                  <option value="">-- Select Aisle --</option>
                  {selectedRank.aisles.map((aisle, index) => (
                    <option key={index} value={aisle.name}>
                      {aisle.name} (Capacity: {aisle.capacity})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleAddTaxi}>
                Add Taxi
              </button>
              <button className="secondary-btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// LoadsPanel Component
function LoadsPanel({ loads, timeFilter, setTimeFilter }) {
  const filteredLoads = loads.filter(load => {
    const loadDate = load.timestamp?.toDate();
    const now = new Date();

    if (timeFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return loadDate >= today;
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return loadDate >= weekAgo;
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return loadDate >= monthAgo;
    }
    return true;
  });

  return (
    <div className="loads-panel">
      <div className="panel-header">
        <h2>📦 Load Records</h2>
        <div className="time-filter">
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Registration</th>
              <th>Driver</th>
              <th>Marshal</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {filteredLoads.map(load => (
              <tr key={load.id}>
                <td>{load.timestamp?.toDate().toLocaleString()}</td>
                <td>{load.registration}</td>
                <td>{load.driverName}</td>
                <td>{load.marshalEmail}</td>
                <td>{load.marshalRank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLoads.length === 0 && (
        <div className="empty-state">
          <p>No loads recorded for the selected period</p>
        </div>
      )}
    </div>
  );
}

// PaymentsPanel Component
function PaymentsPanel({ payments, taxis, onRecordPayment, showPaymentModal, setShowPaymentModal }) {
  const [selectedTaxi, setSelectedTaxi] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const handleRecordPayment = () => {
    if (!selectedTaxi || !paymentAmount) {
      alert('Please select a taxi and enter payment amount');
      return;
    }

    const taxi = taxis.find(t => t.id === selectedTaxi);
    onRecordPayment({
      taxiId: selectedTaxi,
      registration: taxi.registration,
      driverName: taxi.driverName,
      amount: parseFloat(paymentAmount),
      paymentDate: Timestamp.fromDate(new Date(paymentDate)),
      notes: paymentNotes
    });

    setSelectedTaxi('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(false);
  };

  return (
    <div className="payments-panel">
      <div className="panel-header">
        <h2>💰 Payment Records</h2>
        <button
          className="add-btn"
          onClick={() => setShowPaymentModal(true)}
        >
          ➕ Record Payment
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Registration</th>
              <th>Driver</th>
              <th>Amount</th>
              <th>Recorded By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id}>
                <td>{payment.paymentDate?.toDate().toLocaleDateString()}</td>
                <td>{payment.registration}</td>
                <td>{payment.driverName}</td>
                <td>R{payment.amount?.toFixed(2)}</td>
                <td>{payment.recordedBy}</td>
                <td>{payment.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length === 0 && (
        <div className="empty-state">
          <p>No payments recorded yet</p>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Record Payment</h3>

            <div className="form-group">
              <label>Select Taxi *</label>
              <select
                value={selectedTaxi}
                onChange={(e) => setSelectedTaxi(e.target.value)}
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

            <div className="form-group">
              <label>Payment Amount (R) *</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional notes..."
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleRecordPayment}>
                Record Payment
              </button>
              <button className="secondary-btn" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// MeetingsPanel Component
function MeetingsPanel({ meetings, onCreateMeeting, showMeetingModal, setShowMeetingModal }) {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');

  const handleCreateMeeting = () => {
    if (!meetingTitle || !meetingDate || !meetingTime || !meetingLocation) {
      alert('Please fill in all required fields');
      return;
    }

    onCreateMeeting({
      title: meetingTitle,
      meetingDate: Timestamp.fromDate(new Date(`${meetingDate}T${meetingTime}`)),
      location: meetingLocation,
      agenda: meetingAgenda,
      status: 'scheduled'
    });

    setMeetingTitle('');
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLocation('');
    setMeetingAgenda('');
    setShowMeetingModal(false);
  };

  return (
    <div className="meetings-panel">
      <div className="panel-header">
        <h2>📅 Meeting Management</h2>
        <button
          className="add-btn"
          onClick={() => setShowMeetingModal(true)}
        >
          ➕ Schedule Meeting
        </button>
      </div>

      <div className="meetings-list">
        {meetings.map(meeting => (
          <div key={meeting.id} className="meeting-card">
            <div className="meeting-header">
              <h3>{meeting.title}</h3>
              <span className={`meeting-status status-${meeting.status || 'scheduled'}`}>
                {meeting.status || 'Scheduled'}
              </span>
            </div>
            <div className="meeting-details">
              <p>📅 {meeting.meetingDate?.toDate().toLocaleString()}</p>
              <p>📍 {meeting.location}</p>
              <p>📝 {meeting.agenda || 'No agenda set'}</p>
              <p>Created by: {meeting.createdBy}</p>
            </div>
          </div>
        ))}
      </div>

      {meetings.length === 0 && (
        <div className="empty-state">
          <p>No meetings scheduled</p>
        </div>
      )}

      {/* Create Meeting Modal */}
      {showMeetingModal && (
        <div className="modal-overlay" onClick={() => setShowMeetingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule New Meeting</h3>

            <div className="form-group">
              <label>Meeting Title *</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g., Weekly Marshal Meeting"
                required
              />
            </div>

            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Time *</label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Location *</label>
              <input
                type="text"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="e.g., Central Station Office"
                required
              />
            </div>

            <div className="form-group">
              <label>Agenda</label>
              <textarea
                value={meetingAgenda}
                onChange={(e) => setMeetingAgenda(e.target.value)}
                placeholder="Meeting agenda and topics..."
                rows="4"
              />
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleCreateMeeting}>
                Schedule Meeting
              </button>
              <button className="secondary-btn" onClick={() => setShowMeetingModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarshalApp;