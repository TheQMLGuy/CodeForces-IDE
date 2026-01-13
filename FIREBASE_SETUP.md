# CodeForces IDE - Setup Guide

Simple setup for Google Sign-In. All data is stored locally in your browser (IndexedDB).

---

## Quick Start (5 minutes)

1. Create a Google Cloud project
2. Set up OAuth credentials  
3. Add your Client ID to `auth.js`
4. Done!

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **New Project**
3. Name it `codeforces-ide` → **Create**

---

## Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → **Create**
3. Fill in:
   - App name: `CodeForces IDE`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue** through all steps
5. Click **Publish App** (to move from Testing to Production)

---

## Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `CodeForces IDE Web`
5. Add **Authorized JavaScript origins**:
   - `http://localhost:5500` (for VS Code Live Server)
   - `http://127.0.0.1:5500`
   - `https://yourusername.github.io` (for GitHub Pages)
6. Click **Create**
7. Copy the **Client ID**

---

## Step 4: Update auth.js

Open `auth.js` and replace line 9:

```javascript
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

With your actual Client ID from Step 3.

---

## Step 5: Test

1. Open `index.html` with Live Server
2. Click **Sign In**
3. Complete Google sign-in
4. ✅ Your profile picture and name should appear

---

## How It Works

| What | Where |
|------|-------|
| Your code, snippets, test cases | IndexedDB (local browser storage) |
| User identity | Google Sign-In |
| Cloud backup | Not used (no billing required!) |

Each Google account gets its own separate local storage.

---

## Troubleshooting

**Popup blocked:** Allow popups for your domain

**Error 400: redirect_uri_mismatch:** Add your exact URL to authorized origins

**Sign-in button doesn't work:** Check browser console, verify Client ID is correct

---

## Files

| File | Purpose |
|------|---------|
| `auth.js` | Google Sign-In (add Client ID here) |
| `local-storage.js` | IndexedDB storage |
| `firebase-sync.js` | Status display (no Firebase needed) |
| `app.js` | Main application |
