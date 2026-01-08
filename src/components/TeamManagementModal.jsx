import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Trash2, Shield, Users, AlertCircle, CheckCircle, KeyRound, Upload, FileText } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import {
    subscribeToTeam,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    isSuperAdmin
} from '../utils/firebase';
import '../styles/components.css';

// Secondary Firebase app for creating accounts without signing out current user
const secondaryFirebaseConfig = {
    apiKey: "AIzaSyBfwF0cUMgSg2Mld05wh7RSyZE1mRIta14",
    authDomain: "vibee-check-in.firebaseapp.com",
    projectId: "vibee-check-in",
};

let secondaryApp = null;
try {
    secondaryApp = initializeApp(secondaryFirebaseConfig, 'secondary');
} catch (e) {
    // App might already exist
    secondaryApp = initializeApp(secondaryFirebaseConfig, 'secondary-' + Date.now());
}

const DEFAULT_PASSWORD = 'Vibee1234!';

const TeamManagementModal = ({ isOpen, onClose }) => {
    const [members, setMembers] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('staff');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resettingPassword, setResettingPassword] = useState(null);
    const [showCsvUpload, setShowCsvUpload] = useState(false);
    const [csvProgress, setCsvProgress] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = subscribeToTeam(setMembers);
        return () => unsubscribe();
    }, [isOpen]);

    if (!isOpen) return null;

    const createUserAccount = async (email, name, role) => {
        const secondaryAuth = getAuth(secondaryApp);
        try {
            await createUserWithEmailAndPassword(secondaryAuth, email, DEFAULT_PASSWORD);
            await secondaryAuth.signOut();
        } catch (authError) {
            if (authError.code !== 'auth/email-already-in-use') {
                throw authError;
            }
        }

        return await addTeamMember({
            email: email.trim(),
            name: name?.trim() || '',
            role: role || 'staff',
            mustChangePassword: true
        });
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newEmail.trim()) {
            setError('Email is required');
            return;
        }

        if (members.some(m => m.email?.toLowerCase() === newEmail.toLowerCase())) {
            setError('This email is already a team member');
            return;
        }

        setLoading(true);
        try {
            const result = await createUserAccount(newEmail.trim(), newName.trim(), newRole);

            if (result) {
                setSuccess(`Team member added! Default password: ${DEFAULT_PASSWORD}`);
                setNewEmail('');
                setNewName('');
                setNewRole('staff');
            } else {
                setError('Failed to add team member');
            }
        } catch (err) {
            console.error('Error adding member:', err);
            setError('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCsvUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setLoading(true);
        setCsvProgress({ current: 0, total: 0, errors: [] });

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                setError('CSV file is empty or has no data rows');
                setLoading(false);
                return;
            }

            // Parse header
            const header = lines[0].toLowerCase().split(',').map(h => h.trim());
            const emailIdx = header.findIndex(h => h.includes('email'));
            const nameIdx = header.findIndex(h => h.includes('name'));
            const roleIdx = header.findIndex(h => h.includes('role'));

            if (emailIdx === -1) {
                setError('CSV must have an "Email" column');
                setLoading(false);
                return;
            }

            const dataRows = lines.slice(1);
            setCsvProgress({ current: 0, total: dataRows.length, errors: [] });

            let added = 0;
            let skipped = 0;
            const errors = [];

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                const cols = row.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

                const email = cols[emailIdx]?.trim();
                const name = nameIdx !== -1 ? cols[nameIdx]?.trim() : '';
                let role = roleIdx !== -1 ? cols[roleIdx]?.trim().toLowerCase() : 'staff';

                // Validate role
                if (role !== 'admin' && role !== 'staff') {
                    role = 'staff';
                }

                if (!email || !email.includes('@')) {
                    errors.push(`Row ${i + 2}: Invalid email`);
                    continue;
                }

                // Check if already exists
                if (members.some(m => m.email?.toLowerCase() === email.toLowerCase())) {
                    skipped++;
                    continue;
                }

                try {
                    await createUserAccount(email, name, role);
                    added++;
                } catch (err) {
                    errors.push(`Row ${i + 2}: ${err.message}`);
                }

                setCsvProgress({ current: i + 1, total: dataRows.length, errors });
            }

            if (errors.length > 0) {
                setError(`Added ${added}, skipped ${skipped}, errors: ${errors.length}`);
            } else {
                setSuccess(`Successfully added ${added} team members! (${skipped} already existed)`);
            }
        } catch (err) {
            console.error('CSV upload error:', err);
            setError('Failed to process CSV: ' + err.message);
        } finally {
            setLoading(false);
            setCsvProgress(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSendPasswordReset = async (email) => {
        setError('');
        setSuccess('');
        setResettingPassword(email);

        try {
            const auth = getAuth();
            await sendPasswordResetEmail(auth, email);
            setSuccess(`Password reset email sent to ${email}`);
        } catch (err) {
            console.error('Error sending reset:', err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found for this email. User needs to sign in first with default password.');
            } else {
                setError('Failed to send password reset: ' + err.message);
            }
        } finally {
            setResettingPassword(null);
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        await updateTeamMember(memberId, { role: newRole });
    };

    const handleRemove = async (memberId, email) => {
        if (isSuperAdmin(email)) {
            setError('Cannot remove super admin');
            return;
        }

        if (confirm(`Remove ${email} from the team?`)) {
            await removeTeamMember(memberId);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel modal-content team-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Users size={20} /> Team Management</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
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

                {csvProgress && (
                    <div className="csv-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${(csvProgress.current / csvProgress.total) * 100}%` }}
                            />
                        </div>
                        <span>Processing {csvProgress.current} of {csvProgress.total}...</span>
                    </div>
                )}

                {/* Add New Member Form */}
                <form onSubmit={handleAddMember} className="add-member-form">
                    <div className="form-header-row">
                        <h3><UserPlus size={16} /> Add Team Member</h3>
                        <button
                            type="button"
                            className="csv-toggle-btn"
                            onClick={() => setShowCsvUpload(!showCsvUpload)}
                        >
                            <Upload size={14} /> CSV Upload
                        </button>
                    </div>

                    {showCsvUpload ? (
                        <div className="csv-upload-section">
                            <p className="form-note">Upload a CSV with columns: <strong>Email, Name, Role</strong></p>
                            <p className="form-note">Role should be "admin" or "staff" (defaults to staff)</p>
                            <div className="csv-upload-row">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="form-note">New users will be created with password: <strong>{DEFAULT_PASSWORD}</strong></p>
                            <div className="form-row">
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Name (optional)"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        </>
                    )}
                </form>

                <div className="settings-divider">
                    <span>Team Members ({members.length})</span>
                </div>

                {/* Team Members List */}
                <div className="team-list">
                    {/* Super Admin (always shown) */}
                    <div className="team-member super-admin">
                        <div className="member-avatar">DJ</div>
                        <div className="member-info">
                            <span className="member-name">Super Admin</span>
                            <span className="member-email">david.joe@vibee.com</span>
                        </div>
                        <span className="role-badge admin">
                            <Shield size={14} /> Super Admin
                        </span>
                    </div>

                    {members.map(member => (
                        <div key={member.id} className="team-member">
                            <div className="member-avatar">
                                {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="member-info">
                                <span className="member-name">
                                    {member.name || 'No name'}
                                    {member.mustChangePassword && (
                                        <span className="password-badge">New</span>
                                    )}
                                </span>
                                <span className="member-email">{member.email}</span>
                            </div>
                            <select
                                className="role-select"
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button
                                className="reset-pwd-btn"
                                onClick={() => handleSendPasswordReset(member.email)}
                                disabled={resettingPassword === member.email}
                                title="Send password reset email"
                            >
                                <KeyRound size={14} />
                            </button>
                            <button
                                className="remove-btn"
                                onClick={() => handleRemove(member.id, member.email)}
                                title="Remove member"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    {members.length === 0 && (
                        <div className="no-members">
                            No team members added yet. Add someone above!
                        </div>
                    )}
                </div>

                <div className="permission-info">
                    <h4>Permission Levels:</h4>
                    <ul>
                        <li><strong>Admin:</strong> Full access to guests tab, reports, settings, and can add guests</li>
                        <li><strong>Staff:</strong> Can search guests and check them in (customer view only)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default TeamManagementModal;
