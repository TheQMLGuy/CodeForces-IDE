/**
 * Firebase Authentication Only Module
 * For CodeForces IDE - Web Edition
 * 
 * Only handles Google authentication - no Firestore/storage
 * All data is stored locally in IndexedDB (see local-storage.js)
 */

// Note: No Firebase config needed - we use Google Identity Services directly
// This module is kept for potential future Firebase Auth features

// ============================================
// Status
// ============================================
let authBackendReady = false;

function init() {
    // No Firebase initialization needed for GIS-only auth
    authBackendReady = true;
    console.log('Auth backend ready (GIS-only mode)');
    return Promise.resolve(true);
}

function updateStatus(status) {
    const indicator = document.getElementById('syncStatus');
    const icon = document.getElementById('syncIcon');
    const text = document.getElementById('syncText');

    if (!indicator) return;

    indicator.className = `sync-status ${status}`;

    const statusConfig = {
        'idle': { icon: '💾', text: 'Local' },
        'saving': { icon: '💾', text: 'Saving...' },
        'saved': { icon: '✓', text: 'Saved' },
        'error': { icon: '⚠️', text: 'Error' }
    };

    const config = statusConfig[status] || statusConfig.idle;
    if (icon) icon.textContent = config.icon;
    if (text) text.textContent = config.text;
}

function getStatus() {
    return authBackendReady ? 'ready' : 'not-ready';
}

// ============================================
// Export (maintaining API compatibility)
// ============================================
window.FirebaseSync = {
    init,
    updateStatus,
    getStatus,
    // No-op functions for compatibility
    saveBackup: () => Promise.resolve(false),
    loadBackup: () => Promise.resolve(null),
    hasBackup: () => Promise.resolve(false)
};
