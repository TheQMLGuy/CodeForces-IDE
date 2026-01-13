/**
 * Local Storage Module using IndexedDB
 * For CodeForces IDE - Web Edition
 * 
 * Provides per-user persistent storage using IndexedDB
 */

// ============================================
// Database Configuration
// ============================================
const DB_NAME = 'cf-ide-db';
const DB_VERSION = 1;
const STORE_NAME = 'userData';

let db = null;

// ============================================
// Initialize IndexedDB
// ============================================
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB open failed:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create object store for user data
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                console.log('Created userData store');
            }
        };
    });
}

// ============================================
// Save User Data to IndexedDB
// ============================================
async function saveUserData(userId, data) {
    if (!userId) {
        console.warn('Cannot save: no userId');
        return false;
    }

    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                userId,
                ...data,
                lastUpdated: Date.now()
            };

            const request = store.put(record);

            request.onsuccess = () => {
                console.log('Data saved to IndexedDB');
                resolve(true);
            };

            request.onerror = () => {
                console.error('IndexedDB save failed:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to save to IndexedDB:', error);
        return false;
    }
}

// ============================================
// Load User Data from IndexedDB
// ============================================
async function loadUserData(userId) {
    if (!userId) {
        console.warn('Cannot load: no userId');
        return null;
    }

    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(userId);

            request.onsuccess = () => {
                if (request.result) {
                    console.log('Data loaded from IndexedDB');
                    resolve(request.result);
                } else {
                    console.log('No data found in IndexedDB for user');
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('IndexedDB load failed:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        return null;
    }
}

// ============================================
// Delete User Data from IndexedDB
// ============================================
async function deleteUserData(userId) {
    if (!userId) return false;

    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(userId);

            request.onsuccess = () => {
                console.log('Data deleted from IndexedDB');
                resolve(true);
            };

            request.onerror = () => {
                console.error('IndexedDB delete failed:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to delete from IndexedDB:', error);
        return false;
    }
}

// ============================================
// Check if User Has Data
// ============================================
async function hasUserData(userId) {
    const data = await loadUserData(userId);
    return data !== null;
}

// ============================================
// Export
// ============================================
window.LocalDB = {
    init: initDB,
    save: saveUserData,
    load: loadUserData,
    delete: deleteUserData,
    hasData: hasUserData
};
