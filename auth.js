/**
 * Google Authentication Module using Google Identity Services (GIS)
 * For CodeForces IDE - Web Edition
 */

// ============================================
// Configuration - REPLACE WITH YOUR CREDENTIALS
// ============================================
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// ============================================
// Auth State
// ============================================
let googleUser = null;
let tokenClient = null;
let authInitialized = false;

// Event callbacks
const authCallbacks = {
    onSignIn: [],
    onSignOut: []
};

// ============================================
// Initialize Google Identity Services
// ============================================
function initGoogleAuth() {
    return new Promise((resolve) => {
        if (authInitialized) {
            resolve(googleUser);
            return;
        }

        // Wait for GIS library to load
        const checkGIS = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(checkGIS);

                // Initialize Google Sign-In
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                    auto_select: true,
                    cancel_on_tap_outside: false
                });

                // Try to restore session from localStorage
                const savedUser = localStorage.getItem('cf-ide-google-user');
                if (savedUser) {
                    try {
                        googleUser = JSON.parse(savedUser);
                        notifyAuthChange('signIn');
                    } catch (e) {
                        localStorage.removeItem('cf-ide-google-user');
                    }
                }

                authInitialized = true;
                resolve(googleUser);
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkGIS);
            console.warn('Google Identity Services failed to load');
            authInitialized = true;
            resolve(null);
        }, 10000);
    });
}

// ============================================
// Handle Google Sign-In Response
// ============================================
function handleCredentialResponse(response) {
    if (response.credential) {
        // Decode JWT token to get user info
        const payload = decodeJwtPayload(response.credential);

        googleUser = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            token: response.credential
        };

        // Save to localStorage for session persistence
        localStorage.setItem('cf-ide-google-user', JSON.stringify(googleUser));

        notifyAuthChange('signIn');
        updateAuthUI();
    }
}

// Decode JWT payload (base64)
function decodeJwtPayload(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// ============================================
// Sign In / Sign Out
// ============================================
function signInWithGoogle() {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // Fallback: Show the sign-in button popup
                console.log('Sign-in prompt not displayed, trying button flow');
            }
        });
    }
}

function signOutGoogle() {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
    }

    googleUser = null;
    localStorage.removeItem('cf-ide-google-user');

    notifyAuthChange('signOut');
    updateAuthUI();
}

// ============================================
// Auth State Helpers
// ============================================
function isSignedIn() {
    return googleUser !== null;
}

function getCurrentUser() {
    return googleUser;
}

function getUserId() {
    return googleUser ? googleUser.id : null;
}

// ============================================
// Event System
// ============================================
function onAuthStateChange(event, callback) {
    if (event === 'signIn') {
        authCallbacks.onSignIn.push(callback);
    } else if (event === 'signOut') {
        authCallbacks.onSignOut.push(callback);
    }
}

function notifyAuthChange(event) {
    const callbacks = event === 'signIn' ? authCallbacks.onSignIn : authCallbacks.onSignOut;
    callbacks.forEach(cb => {
        try {
            cb(googleUser);
        } catch (e) {
            console.error('Auth callback error:', e);
        }
    });
}

// ============================================
// UI Updates
// ============================================
function updateAuthUI() {
    const signInBtn = document.getElementById('googleSignInBtn');
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (googleUser) {
        // Show user profile, hide sign-in button
        if (signInBtn) signInBtn.style.display = 'none';
        if (userProfile) {
            userProfile.style.display = 'flex';
            if (userAvatar) userAvatar.src = googleUser.picture || '';
            if (userName) userName.textContent = googleUser.name.split(' ')[0];
        }
    } else {
        // Show sign-in button, hide user profile
        if (signInBtn) signInBtn.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
    }
}

// ============================================
// Render Google Sign-In Button (One Tap fallback)
// ============================================
function renderGoogleButton(containerId) {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.renderButton(
            document.getElementById(containerId),
            {
                type: 'standard',
                theme: 'filled_black',
                size: 'medium',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        );
    }
}

// ============================================
// Export functions
// ============================================
window.GoogleAuth = {
    init: initGoogleAuth,
    signIn: signInWithGoogle,
    signOut: signOutGoogle,
    isSignedIn,
    getCurrentUser,
    getUserId,
    onAuthStateChange,
    updateUI: updateAuthUI,
    renderButton: renderGoogleButton
};
