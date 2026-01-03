# Firebase & Google Sign-In Setup Guide

Follow these steps to enable Google authentication and cloud sync in your CodeForces IDE.

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., "codeforces-ide")
4. Disable Google Analytics (optional for this project)
5. Click **"Create project"**

---

## Step 2: Enable Google Sign-In

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google**
3. Toggle **Enable**
4. Add your email as the project support email
5. Click **Save**

---

## Step 3: Create Firestore Database

1. Go to **Firestore Database** in Firebase Console
2. Click **"Create database"**
3. Choose **Start in test mode** (for development)
4. Select your preferred region
5. Click **Enable**

---

## Step 4: Get Your Configuration

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll down to "Your apps" and click **Add app** → **Web** (</> icon)
3. Register your app with a nickname
4. Copy the `firebaseConfig` object

Your config will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 5: Get Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. You'll see an OAuth 2.0 Client ID created by Firebase
5. Click on it and copy the **Client ID**

---

## Step 6: Update Your Files

### 1. Update `auth.js` (line 9):
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

### 2. Update `firebase-sync.js` (lines 12-19):
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

---

## Step 7: Add Authorized Domains

1. In Firebase Console, go to **Authentication** → **Settings**
2. Under **Authorized domains**, add:
   - `localhost` (for local development)
   - `127.0.0.1` (optional)
   - `yourusername.github.io` (for GitHub Pages deployment)

---

## Testing

1. Open the IDE in your browser
2. Click the **"Sign In"** button in the header
3. Complete the Google sign-in flow
4. You should see your profile picture and name appear
5. The sync status should show "Synced"
6. Try making changes to your code - they will auto-sync to the cloud

---

## Troubleshooting

**Sign-in popup doesn't appear:**
- Check browser popup blocker
- Ensure you're on an authorized domain

**"Error 400: redirect_uri_mismatch":**
- Add your domain to authorized origins in Google Cloud Console → Credentials

**Sync not working:**
- Check browser console for errors
- Verify Firestore rules allow read/write for authenticated users
