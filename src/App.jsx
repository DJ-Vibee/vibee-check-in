import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ResetPasswordHandler from './components/ResetPasswordHandler';
import { SettingsProvider } from './utils/SettingsContext';
import { getTeamMember, isSuperAdmin, updateTeamMember } from './utils/firebase';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(false);
  const [resetMode, setResetMode] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState(null);

  // Check for password reset URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      setResetMode(oobCode);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Check user role when user changes
  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setUserRole(null);
        setMustChangePassword(false);
        setTeamMemberId(null);
        return;
      }

      setCheckingRole(true);
      try {
        if (isSuperAdmin(user.email)) {
          setUserRole('admin');
          setMustChangePassword(false);
        } else {
          const member = await getTeamMember(user.email);
          setUserRole(member?.role || null);
          setMustChangePassword(member?.mustChangePassword || false);
          setTeamMemberId(member?.id || null);
        }
      } catch (error) {
        console.error('Error checking role:', error);
        setUserRole(null);
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [user]);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  const handleResetComplete = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    setResetMode(null);
  };

  const handlePasswordChanged = async () => {
    if (teamMemberId) {
      await updateTeamMember(teamMemberId, { mustChangePassword: false });
    }
    setMustChangePassword(false);
  };

  // Show password reset handler if in reset mode
  if (resetMode) {
    return <ResetPasswordHandler oobCode={resetMode} onComplete={handleResetComplete} />;
  }

  if (loading || checkingRole) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  // Force password change for new users
  if (mustChangePassword) {
    return (
      <ForcePasswordChange
        user={user}
        onComplete={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  const userIsAdmin = userRole === 'admin';

  return (
    <SettingsProvider>
      <Dashboard
        user={user}
        onLogout={handleLogout}
        isAdmin={userIsAdmin}
        userRole={userRole}
      />
    </SettingsProvider>
  );
}

// Force Password Change Component
function ForcePasswordChange({ user, onComplete, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      onComplete();
    } catch (err) {
      console.error('Password change error:', err);
      if (err.code === 'auth/wrong-password') {
        setError('Current password is incorrect');
      } else {
        setError('Failed to change password: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <div className="login-header">
          <h1>Change Your Password</h1>
          <p>Please set a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Current Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            <small className="form-hint">Default: Vibee1234!</small>
          </div>

          <div className="form-group">
            <label>New Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={loading}
          >
            <Lock size={18} />
            {loading ? 'Updating...' : 'Set New Password'}
          </button>

          <button
            type="button"
            className="forgot-password"
            onClick={onLogout}
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
