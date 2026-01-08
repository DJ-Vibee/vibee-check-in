import React, { useState } from 'react';
import { getAuth, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { X, User, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import '../styles/components.css';

const UserAccountModal = ({ isOpen, onClose, user }) => {
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isOpen) return null;

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const auth = getAuth();
            await updateProfile(auth.currentUser, { displayName });
            setSuccess('Name updated successfully!');
        } catch (err) {
            setError('Failed to update name: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const auth = getAuth();
            const credential = EmailAuthProvider.credential(user.email, currentPassword);

            // Re-authenticate user
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Update password
            await updatePassword(auth.currentUser, newPassword);

            setSuccess('Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            console.error('Password update error:', err);
            if (err.code === 'auth/wrong-password') {
                setError('Current password is incorrect');
            } else {
                setError('Failed to update password: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel modal-content user-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><User size={20} /> Account Settings</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="user-info">
                    <div className="user-avatar-large">
                        {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="user-details">
                        <span className="user-email">{user?.email}</span>
                    </div>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        <CheckCircle size={16} />
                        {success}
                    </div>
                )}

                <div className="settings-form">
                    <form onSubmit={handleUpdateProfile}>
                        <div className="form-section">
                            <h3>Profile</h3>
                            <div className="form-group">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
                                />
                            </div>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                <Save size={16} /> Save Name
                            </button>
                        </div>
                    </form>

                    <div className="settings-divider">
                        <span>Change Password</span>
                    </div>

                    <form onSubmit={handleUpdatePassword}>
                        <div className="form-section">
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
                            <button type="submit" className="btn-primary" disabled={loading}>
                                <Lock size={16} /> Update Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserAccountModal;
