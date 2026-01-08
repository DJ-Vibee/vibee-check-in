import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Sun, Moon, Users, UserCheck, Settings, BarChart3, RefreshCw, Upload, Cloud, CloudOff, LogOut, User, UsersRound } from 'lucide-react';
import ProfileCard from './ProfileCard';
import SettingsModal from './SettingsModal';
import UserAccountModal from './UserAccountModal';
import TeamManagementModal from './TeamManagementModal';
import ReportsTab from './ReportsTab';
import guestData from '../utils/guestData.json';
import { useSettings } from '../utils/SettingsContext';
import { batchCheckWaivers } from '../utils/jotformApi';
import {
    subscribeToGuests,
    updateGuestField,
    hasGuestData,
    uploadGuestsFromJson,
    logActivity
} from '../utils/firebase';
import '../styles/components.css';

const Dashboard = ({ user, onLogout, isAdmin, userRole }) => {
    const { settings } = useSettings();
    const [guests, setGuests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    // Non-admins default to customer view
    const [viewMode, setViewMode] = useState(isAdmin ? 'admin' : 'customer');
    const [activeTab, setActiveTab] = useState('guests'); // 'guests' or 'reports'
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTeamOpen, setIsTeamOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [isVerifyingWaivers, setIsVerifyingWaivers] = useState(false);
    const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isUserAccountOpen, setIsUserAccountOpen] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Subscribe to Firebase guests (real-time sync)
    useEffect(() => {
        const checkAndSubscribe = async () => {
            const hasData = await hasGuestData();

            if (hasData) {
                // Firebase has data - subscribe to real-time updates
                console.log('Subscribing to Firebase guests...');
                const unsubscribe = subscribeToGuests((firebaseGuests) => {
                    console.log(`Received ${firebaseGuests.length} guests from Firebase`);
                    setGuests(firebaseGuests);
                    setIsFirebaseConnected(true);
                });
                return unsubscribe;
            } else {
                // No Firebase data - load from local JSON
                console.log('No Firebase data, loading from local JSON...');
                setGuests(guestData);
                setIsFirebaseConnected(false);
            }
        };

        checkAndSubscribe();
    }, []);

    // Upload local data to Firebase
    const handleUploadToFirebase = async () => {
        if (guests.length === 0) return;

        setIsUploading(true);
        try {
            const success = await uploadGuestsFromJson(guests);
            if (success) {
                setIsFirebaseConnected(true);
                alert(`Successfully uploaded ${guests.length} guests to Firebase!`);
            } else {
                alert('Failed to upload guests. Check console for errors.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Verify waivers against JotForm API
    const verifyWaivers = useCallback(async () => {
        if (!settings.jotformApiKey || !settings.jotformFormId || guests.length === 0) return;

        setIsVerifyingWaivers(true);
        try {
            const orderNumbers = guests.map(g => g.orderNumber);
            const results = await batchCheckWaivers(
                settings.jotformApiKey,
                settings.jotformFormId,
                orderNumbers
            );

            // Update guests with verified waiver status
            setGuests(prev => prev.map(g => ({
                ...g,
                jotformWaiver: results.get(g.orderNumber) ? 'Verified' : g.jotformWaiver
            })));
        } catch (error) {
            console.error('Waiver verification error:', error);
        } finally {
            setIsVerifyingWaivers(false);
        }
    }, [settings.jotformApiKey, settings.jotformFormId, guests.length]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    // Handle toggle with Firebase sync and activity logging
    const handleToggle = async (id, field) => {
        const guest = guests.find(g => g.id === id);
        if (!guest) return;

        const newValue = !guest[field];

        // Update locally first for instant UI feedback
        setGuests(prev => prev.map(g => g.id === id ? { ...g, [field]: newValue } : g));

        // If connected to Firebase, sync the change
        if (isFirebaseConnected && guest.orderNumber) {
            await updateGuestField(guest.orderNumber, field, newValue);

            // Log the activity
            if (newValue) { // Only log when enabling (check-in, pickup, etc.)
                const actionNames = {
                    checked: 'Checked in',
                    laminatePickUp: 'Laminate pickup',
                    gondola: 'Gondola pickup',
                    wellnessPU: 'Wellness pickup',
                    idChecked: 'ID verified'
                };

                await logActivity({
                    action: actionNames[field] || field,
                    guestName: `${guest.billingFirst} ${guest.billingLast}`,
                    orderNumber: guest.orderNumber,
                    performedBy: user?.displayName || user?.email || 'Unknown',
                    performedByEmail: user?.email
                });
            }
        }
    };

    const handleImport = () => {
        if (!importText.trim()) return;
        const rows = importText.split('\n').filter(r => r.trim());
        const newGuests = rows.map((row, i) => {
            const cols = row.split(',').map(c => c.trim());
            return {
                id: `imported-${Date.now()}-${i}`,
                orderNumber: `IMP${Date.now()}${i}`,
                status: 'pending',
                event: 'Event',
                email: `${(cols[0] || 'guest').toLowerCase()}@example.com`,
                billingFirst: cols[0] || 'Unknown',
                billingLast: cols[1] || 'Guest',
                billingPhone: '',
                hotel: cols[2] || 'TBD',
                checkInDate: '12/29/2025',
                ticketTierName: 'Standard',
                quantity: 1,
                eventDate: '12/30/2025',
                ticketType: 'Signature',
                checked: false,
                laminatePickUp: false,
                gondola: false,
                wellnessPU: false,
                wellness: '',
                gondolaAddon: '',
                jotformWaiver: '',
                idChecked: false
            };
        });
        setGuests([...guests, ...newGuests]);
        setImportText('');
        setIsImportOpen(false);
    };

    const filters = ['All', 'Checked In', 'Not Checked', 'VIP'];

    const filteredGuests = guests.filter(guest => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            guest.billingFirst?.toLowerCase().includes(searchLower) ||
            guest.billingLast?.toLowerCase().includes(searchLower) ||
            guest.email?.toLowerCase().includes(searchLower) ||
            guest.orderNumber?.toLowerCase().includes(searchLower) ||
            guest.hotel?.toLowerCase().includes(searchLower);

        const matchesFilter = activeFilter === 'All' ||
            (activeFilter === 'Checked In' && guest.checked) ||
            (activeFilter === 'Not Checked' && !guest.checked) ||
            (activeFilter === 'VIP' && guest.ticketType === 'VIP');

        return matchesSearch && matchesFilter;
    });

    const stats = {
        total: guests.length,
        checkedIn: guests.filter(g => g.checked).length,
        pending: guests.filter(g => !g.checked).length
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header glass-panel">
                <div className="header-row">
                    <div className="header-left">
                        <h1>{settings.headerName || 'Check-In System'}</h1>
                        <div className="header-meta">
                            <span className="header-subtitle">{settings.headerSubtitle || 'Vibee Experience 2026'}</span>
                            <span className={`sync-indicator ${isFirebaseConnected ? 'connected' : 'disconnected'}`}>
                                {isFirebaseConnected ? <Cloud size={14} /> : <CloudOff size={14} />}
                                {isFirebaseConnected ? 'Synced' : 'Local'}
                            </span>
                            {isAdmin && (
                                <span className="admin-badge">Admin</span>
                            )}
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="stats-row">
                            <div className="stat-pill">
                                <Users size={14} />
                                <span>{stats.total}</span>
                            </div>
                            <div className="stat-pill checked">
                                <UserCheck size={14} />
                                <span>{stats.checkedIn}</span>
                            </div>
                        </div>

                        {viewMode === 'admin' && (
                            <div className="tab-toggle">
                                <button
                                    className={`tab-btn ${activeTab === 'guests' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('guests')}
                                >
                                    <Users size={16} /> Guests
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('reports')}
                                >
                                    <BarChart3 size={16} /> Reports
                                </button>
                            </div>
                        )}

                        {/* View toggle only for admins */}
                        {isAdmin && (
                            <div className="view-toggle">
                                <button
                                    className={`view-btn ${viewMode === 'admin' ? 'active' : ''}`}
                                    onClick={() => { setViewMode('admin'); setActiveTab('guests'); }}
                                    title="Admin View"
                                >
                                    Admin
                                </button>
                                <button
                                    className={`view-btn ${viewMode === 'customer' ? 'active' : ''}`}
                                    onClick={() => setViewMode('customer')}
                                    title="Customer View"
                                >
                                    Customer
                                </button>
                            </div>
                        )}

                        <button className="theme-toggle" onClick={toggleTheme} title={`${theme === 'dark' ? 'Light' : 'Dark'} mode`}>
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {isAdmin && (
                            <button className="theme-toggle" onClick={() => setIsTeamOpen(true)} title="Team Management">
                                <UsersRound size={18} />
                            </button>
                        )}
                        {isAdmin && (
                            <button className="theme-toggle" onClick={() => setIsSettingsOpen(true)} title="Settings">
                                <Settings size={18} />
                            </button>
                        )}
                        <button className="user-btn" onClick={() => setIsUserAccountOpen(true)} title="Account Settings">
                            <User size={18} />
                        </button>
                        {onLogout && (
                            <button className="theme-toggle logout-btn" onClick={onLogout} title="Sign Out">
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {activeTab === 'guests' && (
                <>
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder={viewMode === 'customer' ? "Enter name or order # to find your reservation..." : "Search by name, email, order #, or hotel..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {viewMode === 'admin' && (
                        <div className="filter-bar">
                            {filters.map(filter => (
                                <button
                                    key={filter}
                                    className={`filter-chip ${activeFilter === filter ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(filter)}
                                >
                                    {filter}
                                </button>
                            ))}
                            <button className="import-btn" onClick={() => setIsImportOpen(true)}>+ Import</button>
                            {!isFirebaseConnected && (
                                <button
                                    className="import-btn upload-btn"
                                    onClick={handleUploadToFirebase}
                                    disabled={isUploading}
                                    title="Upload guest data to Firebase for multi-user sync"
                                >
                                    <Upload size={14} />
                                    {isUploading ? 'Uploading...' : 'Sync to Cloud'}
                                </button>
                            )}
                            {settings.jotformApiKey && (
                                <button
                                    className="import-btn verify-btn"
                                    onClick={verifyWaivers}
                                    disabled={isVerifyingWaivers}
                                    title="Check JotForm for signed waivers"
                                >
                                    <RefreshCw size={14} className={isVerifyingWaivers ? 'spinning' : ''} />
                                    {isVerifyingWaivers ? 'Verifying...' : 'Verify Waivers'}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Guests Tab */}
            {activeTab === 'guests' && (
                <div className="cards-list">
                    {viewMode === 'customer' && !searchQuery.trim() && (
                        <div className="customer-prompt">
                            <Search size={48} />
                            <h2>Find Your Reservation</h2>
                            <p>Enter your name or order number above to check in</p>
                        </div>
                    )}
                    {(viewMode === 'admin' || searchQuery.trim()) && filteredGuests.slice(0, 100).map(guest => (
                        <ProfileCard
                            key={guest.id}
                            guest={guest}
                            onToggle={handleToggle}
                            jotformUrl={settings.jotformUrl}
                        />
                    ))}
                    {viewMode === 'admin' && filteredGuests.length > 100 && (
                        <div className="more-results">
                            Showing 100 of {filteredGuests.length} results. Use search to narrow down.
                        </div>
                    )}
                    {(viewMode === 'admin' || searchQuery.trim()) && filteredGuests.length === 0 && (
                        <p className="no-results">No guests found matching your criteria.</p>
                    )}
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <ReportsTab guests={guests} />
            )}

            {/* Import Modal */}
            {isImportOpen && (
                <div className="modal-overlay" onClick={() => setIsImportOpen(false)}>
                    <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Import Guests</h2>
                            <button className="modal-close" onClick={() => setIsImportOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Paste guest data below (First Name, Last Name, Hotel - one per line)</p>
                        </div>
                        <textarea
                            className="modal-textarea"
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="John, Doe, Hotel Name&#10;Jane, Smith, Another Hotel"
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleImport}>Import</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* User Account Modal */}
            <UserAccountModal isOpen={isUserAccountOpen} onClose={() => setIsUserAccountOpen(false)} user={user} />

            {/* Team Management Modal (Admin only) */}
            {isAdmin && <TeamManagementModal isOpen={isTeamOpen} onClose={() => setIsTeamOpen(false)} />}
        </div>
    );
};

export default Dashboard;
