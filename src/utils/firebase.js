// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, push } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBfwF0cUMgSg2Mld05wh7RSyZE1mRIta14",
    authDomain: "vibee-check-in.firebaseapp.com",
    databaseURL: "https://vibee-check-in-default-rtdb.firebaseio.com",
    projectId: "vibee-check-in",
    storageBucket: "vibee-check-in.firebasestorage.app",
    messagingSenderId: "1003231481528",
    appId: "1:1003231481528:web:98663577cd4c3020c76e4d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ===== TEAM MANAGEMENT =====
// Permission levels:
// - 'admin': Full access (guests tab, reports tab, settings, add guests)
// - 'staff': Can check in guests (customer view only)

// Super admin (always has access, cannot be removed)
const SUPER_ADMINS = ['david.joe@vibee.com'];

/**
 * Check if user is a super admin
 */
export const isSuperAdmin = (email) => {
    if (!email) return false;
    return SUPER_ADMINS.includes(email.toLowerCase());
};

/**
 * Get team member from Firebase
 */
export const getTeamMember = async (email) => {
    if (!email) return null;

    // Super admins are always admins
    if (isSuperAdmin(email)) {
        return { email, role: 'admin', name: 'Super Admin' };
    }

    try {
        const teamRef = ref(database, 'team');
        const snapshot = await get(teamRef);
        if (snapshot.exists()) {
            const members = snapshot.val();
            const key = Object.keys(members).find(k =>
                members[k].email?.toLowerCase() === email.toLowerCase()
            );
            if (key) {
                return { id: key, ...members[key] };
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting team member:', error);
        return null;
    }
};

/**
 * Check if user is an admin
 */
export const isAdmin = async (email) => {
    if (!email) return false;
    if (isSuperAdmin(email)) return true;

    const member = await getTeamMember(email);
    return member?.role === 'admin';
};

/**
 * Check if user is a team member (has any access)
 */
export const isTeamMember = async (email) => {
    if (!email) return false;
    if (isSuperAdmin(email)) return true;

    const member = await getTeamMember(email);
    return member !== null;
};

/**
 * Get all team members
 */
export const getTeamMembers = async () => {
    try {
        const teamRef = ref(database, 'team');
        const snapshot = await get(teamRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            return Object.keys(data).map(key => ({ id: key, ...data[key] }));
        }
        return [];
    } catch (error) {
        console.error('Error getting team members:', error);
        return [];
    }
};

/**
 * Subscribe to team changes
 */
export const subscribeToTeam = (callback) => {
    const teamRef = ref(database, 'team');
    return onValue(teamRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            callback(Object.keys(data).map(key => ({ id: key, ...data[key] })));
        } else {
            callback([]);
        }
    });
};

/**
 * Add a team member
 */
export const addTeamMember = async (member) => {
    try {
        const teamRef = ref(database, 'team');
        const newMemberRef = push(teamRef);
        await set(newMemberRef, {
            email: member.email.toLowerCase(),
            name: member.name || '',
            role: member.role || 'staff',
            addedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error adding team member:', error);
        return false;
    }
};

/**
 * Update a team member's role
 */
export const updateTeamMember = async (memberId, updates) => {
    try {
        const memberRef = ref(database, `team/${memberId}`);
        await update(memberRef, updates);
        return true;
    } catch (error) {
        console.error('Error updating team member:', error);
        return false;
    }
};

/**
 * Remove a team member
 */
export const removeTeamMember = async (memberId) => {
    try {
        const memberRef = ref(database, `team/${memberId}`);
        await set(memberRef, null);
        return true;
    } catch (error) {
        console.error('Error removing team member:', error);
        return false;
    }
};

// ===== SETTINGS =====

/**
 * Get shared settings from Firebase
 */
export const getSharedSettings = async () => {
    try {
        const settingsRef = ref(database, 'settings');
        const snapshot = await get(settingsRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error getting settings:', error);
        return null;
    }
};

/**
 * Save shared settings to Firebase
 */
export const saveSharedSettings = async (settings) => {
    try {
        const settingsRef = ref(database, 'settings');
        await set(settingsRef, settings);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
};

/**
 * Subscribe to settings changes
 */
export const subscribeToSettings = (callback) => {
    const settingsRef = ref(database, 'settings');
    return onValue(settingsRef, (snapshot) => {
        callback(snapshot.exists() ? snapshot.val() : null);
    });
};

// ===== GUESTS =====

/**
 * Get all guests from Firebase
 */
export const getGuests = async () => {
    try {
        const guestsRef = ref(database, 'guests');
        const snapshot = await get(guestsRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array
            return Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
        }
        return [];
    } catch (error) {
        console.error('Error getting guests:', error);
        return [];
    }
};

/**
 * Save all guests to Firebase (for initial upload)
 */
export const saveAllGuests = async (guests) => {
    try {
        const guestsRef = ref(database, 'guests');
        // Convert array to object with order numbers as keys
        const guestsObj = {};
        guests.forEach(guest => {
            const key = guest.orderNumber || guest.id;
            guestsObj[key] = guest;
        });
        await set(guestsRef, guestsObj);
        return true;
    } catch (error) {
        console.error('Error saving guests:', error);
        return false;
    }
};

/**
 * Update a single guest field (for real-time sync of check-ins)
 */
export const updateGuestField = async (orderNumber, field, value) => {
    try {
        const guestRef = ref(database, `guests/${orderNumber}/${field}`);
        await set(guestRef, value);
        return true;
    } catch (error) {
        console.error('Error updating guest:', error);
        return false;
    }
};

/**
 * Update multiple fields on a guest
 */
export const updateGuest = async (orderNumber, updates) => {
    try {
        const guestRef = ref(database, `guests/${orderNumber}`);
        await update(guestRef, updates);
        return true;
    } catch (error) {
        console.error('Error updating guest:', error);
        return false;
    }
};

/**
 * Subscribe to guest changes (real-time sync)
 */
export const subscribeToGuests = (callback) => {
    const guestsRef = ref(database, 'guests');
    return onValue(guestsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array
            const guestArray = Object.keys(data).map(key => ({
                ...data[key],
                firebaseKey: key,
                orderNumber: key // Ensure orderNumber is set
            }));
            callback(guestArray);
        } else {
            callback([]);
        }
    });
};

// ===== UTILITIES =====

/**
 * Upload local guest data to Firebase (one-time migration)
 */
export const uploadGuestsFromJson = async (guestData) => {
    console.log(`Uploading ${guestData.length} guests to Firebase...`);
    const result = await saveAllGuests(guestData);
    if (result) {
        console.log('Upload complete!');
    }
    return result;
};

/**
 * Check if Firebase has any guest data
 */
export const hasGuestData = async () => {
    try {
        const guestsRef = ref(database, 'guests');
        const snapshot = await get(guestsRef);
        return snapshot.exists() && Object.keys(snapshot.val()).length > 0;
    } catch (error) {
        console.error('Error checking guest data:', error);
        return false;
    }
};

// ===== ACTIVITY LOGGING =====

/**
 * Log an activity (check-in, laminate pickup, etc.)
 */
export const logActivity = async (activity) => {
    try {
        const logsRef = ref(database, 'activityLogs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            ...activity,
            timestamp: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error logging activity:', error);
        return false;
    }
};

/**
 * Get recent activity logs
 */
export const getActivityLogs = async (limit = 100) => {
    try {
        const logsRef = ref(database, 'activityLogs');
        const snapshot = await get(logsRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const logs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            // Sort by timestamp descending and limit
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
        }
        return [];
    } catch (error) {
        console.error('Error getting activity logs:', error);
        return [];
    }
};

/**
 * Subscribe to activity log changes
 */
export const subscribeToActivityLogs = (callback, limit = 50) => {
    const logsRef = ref(database, 'activityLogs');
    return onValue(logsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const logs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            callback(logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit));
        } else {
            callback([]);
        }
    });
};

export { database };
export default app;
