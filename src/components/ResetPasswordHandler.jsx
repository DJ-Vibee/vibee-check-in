import React, { useState, useEffect } from 'react';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import '../styles/components.css';

const ResetPasswordHandler = ({ oobCode, onComplete }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [validCode, setValidCode] = useState(false);

    useEffect(() => {
        const verifyCode = async () => {
            try {
                const auth = getAuth();
                const userEmail = await verifyPasswordResetCode(auth, oobCode);
                setEmail(userEmail);
                setValidCode(true);
            } catch (err) {
                console.error('Invalid reset code:', err);
                setError('This password reset link is invalid or has expired. Please request a new one.');
            } finally {
                setLoading(false);
            }
        };

        verifyCode();
    }, [oobCode]);

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

        setLoading(true);
        try {
            const auth = getAuth();
            await confirmPasswordReset(auth, oobCode, newPassword);
            setSuccess(true);
        } catch (err) {
            console.error('Password reset error:', err);
            setError('Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !validCode && !error) {
        return (
            <div className="login-container">
                <div className="login-box glass-panel">
                    <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem' }}>
                        <div className="loading-spinner"></div>
                        <p>Verifying reset link...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="login-container">
                <div className="login-box glass-panel">
                    <div className="reset-success">
                        <CheckCircle size={48} />
                        <h2>Password Reset Complete!</h2>
                        <p>Your password has been successfully reset.</p>
                        <button className="btn-primary" onClick={onComplete}>
                            <ArrowLeft size={16} /> Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!validCode) {
        return (
            <div className="login-container">
                <div className="login-box glass-panel">
                    <div className="login-header">
                        <h1>Reset Failed</h1>
                        <p>Vibee Check-In System</p>
                    </div>
                    <div className="login-error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                    <button className="btn-primary login-btn" onClick={onComplete}>
                        <ArrowLeft size={16} /> Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-box glass-panel">
                <div className="login-header">
                    <h1>Reset Password</h1>
                    <p>Enter a new password for {email}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

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
                        <label>Confirm Password</label>
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
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordHandler;
