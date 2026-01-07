import React, { useState } from 'react';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import '../styles/components.css';

const LoginPage = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'reset'
    const [resetSent, setResetSent] = useState(false);

    const auth = getAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            onLogin(userCredential.user);
        } catch (err) {
            console.error('Login error:', err);
            switch (err.code) {
                case 'auth/user-not-found':
                    setError('No account found with this email');
                    break;
                case 'auth/wrong-password':
                    setError('Incorrect password');
                    break;
                case 'auth/invalid-email':
                    setError('Invalid email address');
                    break;
                case 'auth/too-many-requests':
                    setError('Too many attempts. Please try again later.');
                    break;
                default:
                    setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            onLogin(userCredential.user);
        } catch (err) {
            console.error('Signup error:', err);
            switch (err.code) {
                case 'auth/email-already-in-use':
                    setError('An account with this email already exists');
                    break;
                case 'auth/weak-password':
                    setError('Password must be at least 6 characters');
                    break;
                case 'auth/invalid-email':
                    setError('Invalid email address');
                    break;
                default:
                    setError('Signup failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
        } catch (err) {
            console.error('Reset error:', err);
            switch (err.code) {
                case 'auth/user-not-found':
                    setError('No account found with this email');
                    break;
                case 'auth/invalid-email':
                    setError('Invalid email address');
                    break;
                default:
                    setError('Failed to send reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'reset') {
        return (
            <div className="login-container">
                <div className="login-box glass-panel">
                    <div className="login-header">
                        <button className="back-btn" onClick={() => setMode('login')}>
                            <ArrowLeft size={18} />
                        </button>
                        <h1>Reset Password</h1>
                        <p>Enter your email to receive a password reset link</p>
                    </div>

                    {resetSent ? (
                        <div className="reset-success">
                            <Mail size={48} />
                            <h2>Check your email</h2>
                            <p>We've sent a password reset link to <strong>{email}</strong></p>
                            <button className="btn-primary" onClick={() => setMode('login')}>
                                Back to Login
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword}>
                            {error && (
                                <div className="login-error">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Email</label>
                                <div className="input-with-icon">
                                    <Mail size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn-primary login-btn"
                                disabled={loading}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-box glass-panel">
                <div className="login-header">
                    <h1>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
                    <p>Vibee Check-In System</p>
                </div>

                <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
                    {error && (
                        <div className="login-error">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email</label>
                        <div className="input-with-icon">
                            <Mail size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {mode === 'login' && (
                        <button
                            type="button"
                            className="forgot-password"
                            onClick={() => setMode('reset')}
                        >
                            Forgot password?
                        </button>
                    )}

                    <button
                        type="submit"
                        className="btn-primary login-btn"
                        disabled={loading}
                    >
                        <LogIn size={18} />
                        {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="login-footer">
                    {mode === 'login' ? (
                        <p>
                            Don't have an account?{' '}
                            <button onClick={() => { setMode('signup'); setError(''); }}>
                                Sign up
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button onClick={() => { setMode('login'); setError(''); }}>
                                Sign in
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
