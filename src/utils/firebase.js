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

export { database };
export default app;
