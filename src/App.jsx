import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { SettingsProvider } from './utils/SettingsContext';
import './utils/firebase'; // Initialize Firebase

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  if (loading) {
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

  return (
    <SettingsProvider>
      <Dashboard user={user} onLogout={handleLogout} />
    </SettingsProvider>
  );
}

export default App;
