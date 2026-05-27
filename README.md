# NannyLog

A daily care logging app for nannies and parents, built with React and Firebase.

## Features

- **Daily photo feed** — upload photos (HEIC/JPEG/PNG supported), displayed in an Instagram-style feed
- **Feeding log** — track milk/formula (time + oz) and solids (time + food + tbsp)
- **Nap times** — log start/end times with automatic duration calculation
- **Vitamin D drop** — daily checkbox reminder
- **Supplies needed** — quick-tap checklist (diapers, wipes, formula, etc.) with custom items
- **Notes** — free-text field for observations, milestones, or messages
- **Auto-save** — changes save automatically as you type, no submit button needed
- **History** — past logs grouped by date, expandable day cards
- **Two roles** — Nanny (logs data) and Parent (views data), both in real time

## Tech Stack

- **React** + **Vite**
- **Tailwind CSS v4**
- **Firebase** (Auth, Firestore, Storage, Hosting)
- **libheif-js** — WASM-based HEIC decoder for Chrome

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/PallaviMutyala/NannyApp.git
cd NannyApp
npm install
```

### 2. Set up Firebase

Create a project at [console.firebase.google.com](https://console.firebase.google.com) and enable:
- Authentication (Email/Password)
- Firestore Database
- Storage

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy

```bash
npm run build
firebase deploy --only hosting
```
