/**
 * Firebase Cloud Sync Module
 * For CodeForces IDE - Web Edition
 * 
 * Syncs user data (code, snippets, test cases) to Firebase Firestore
 */

// ============================================
// Firebase Configuration - REPLACE WITH YOUR CONFIG
// ============================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ============================================
// State
// ============================================
let db = null;
let syncEnabled = false;
let lastSyncTime = null;
let syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error', 'offline'

// Debounce timer for saving
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 2000;

// ============================================
// Initialize Firebase
// ============================================
async function initFirebase() {
    try {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded');
            return false;
        }

        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        db = firebase.firestore();

        // Enable offline persistence
        try {
            await db.enablePersistence({ synchronizeTabs: true });
        } catch (err) {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not available in this browser');
            }
        }

        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        return false;
    }
}

// ============================================
// User Data Operations
// ============================================

/**
 * Save user data to Firestore
 */
async function saveUserData(userId, data) {
    if (!db || !userId) {
        console.warn('Cannot save: Firebase not initialized or no user');
        return false;
    }

    updateSyncStatus('syncing');

    try {
        const userDoc = db.collection('users').doc(userId);

        await userDoc.set({
            code: data.code || '',
            input: data.input || '',
            snippets: data.snippets || {},
            testCases: data.testCases || [],
            theme: data.theme || 'dark',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        lastSyncTime = new Date();
        updateSyncStatus('synced');
        console.log('Data saved to cloud');
        return true;
    } catch (error) {
        console.error('Failed to save data:', error);
        updateSyncStatus('error');
        return false;
    }
}

/**
 * Load user data from Firestore
 */
async function loadUserData(userId) {
    if (!db || !userId) {
        console.warn('Cannot load: Firebase not initialized or no user');
        return null;
    }

    updateSyncStatus('syncing');

    try {
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            lastSyncTime = new Date();
            updateSyncStatus('synced');
            return userDoc.data();
        } else {
            updateSyncStatus('synced');
            return null;
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        updateSyncStatus('error');
        return null;
    }
}

/**
 * Merge local and cloud data (for first-time sync)
 */
function mergeData(local, cloud) {
    if (!cloud) return local;
    if (!local) return cloud;

    // Prefer cloud data, but merge snippets
    return {
        code: cloud.code || local.code,
        input: cloud.input || local.input,
        snippets: { ...local.snippets, ...cloud.snippets },
        testCases: cloud.testCases.length > 0 ? cloud.testCases : local.testCases,
        theme: cloud.theme || local.theme
    };
}

// ============================================
// Auto-Sync with Debouncing
// ============================================

/**
 * Schedule a save operation (debounced)
 */
function scheduleSave(userId, data) {
    if (!syncEnabled || !userId) return;

    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Schedule new save
    saveTimeout = setTimeout(() => {
        saveUserData(userId, data);
    }, SAVE_DEBOUNCE_MS);
}

// ============================================
// Sync Control
// ============================================

function enableSync() {
    syncEnabled = true;
    updateSyncStatus('idle');
}

function disableSync() {
    syncEnabled = false;
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    updateSyncStatus('offline');
}

function isSyncEnabled() {
    return syncEnabled;
}

// ============================================
// UI Status Updates
// ============================================

function updateSyncStatus(status) {
    syncStatus = status;

    const indicator = document.getElementById('syncStatus');
    const icon = document.getElementById('syncIcon');
    const text = document.getElementById('syncText');

    if (!indicator) return;

    indicator.className = `sync-status ${status}`;

    const statusConfig = {
        idle: { icon: '☁️', text: 'Cloud' },
        syncing: { icon: '🔄', text: 'Syncing...' },
        synced: { icon: '✓', text: 'Synced' },
        error: { icon: '⚠️', text: 'Sync Error' },
        offline: { icon: '💾', text: 'Local' }
    };

    const config = statusConfig[status] || statusConfig.offline;
    if (icon) icon.textContent = config.icon;
    if (text) text.textContent = config.text;
}

function getSyncStatus() {
    return syncStatus;
}

// ============================================
// Export
// ============================================
window.FirebaseSync = {
    init: initFirebase,
    save: saveUserData,
    load: loadUserData,
    merge: mergeData,
    scheduleSave,
    enableSync,
    disableSync,
    isSyncEnabled,
    getSyncStatus,
    updateStatus: updateSyncStatus
};
