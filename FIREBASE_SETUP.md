# Firebase Setup Guide for TaxiHub

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it "TaxiHub"
4. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get Started"
3. Enable **Email/Password** sign-in method
4. Create a test marshal account:
   - Email: `marshal@taxihub.com`
   - Password: `marshal123`

## Step 3: Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **production mode**
4. Choose your location

## Step 4: Firestore Security Rules

Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to taxi ranks for everyone
    match /taxiRanks/{rankId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Only authenticated marshals can access taxis and loads
    match /taxis/{taxiId} {
      allow read, write: if request.auth != null;
    }
    
    match /loads/{loadId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 5: Add Sample Data

### Collection: `taxiRanks`

Add sample taxi ranks (click "Start collection" → "taxiRanks"):

**Document 1:**
```json
{
  "name": "Bree Taxi Rank",
  "address": "Bree Street, Johannesburg CBD",
  "location": {
    "lat": -26.2041,
    "lng": 28.0473
  },
  "destinations": [
    "Soweto",
    "Alexandra",
    "Sandton",
    "Randburg"
  ],
  "aisles": [
    {
      "number": 1,
      "name": "Soweto Line",
      "routes": ["Orlando", "Diepkloof", "Meadowlands"]
    },
    {
      "number": 2,
      "name": "Alexandra Line",
      "routes": ["Alex", "Wynberg", "Marlboro"]
    },
    {
      "number": 3,
      "name": "Sandton Line",
      "routes": ["Sandton", "Rosebank", "Hyde Park"]
    }
  ]
}
```

**Document 2:**
```json
{
  "name": "Park Station Taxi Rank",
  "address": "Park Station, Johannesburg",
  "location": {
    "lat": -26.1956,
    "lng": 28.0419
  },
  "destinations": [
    "Pretoria",
    "Kempton Park",
    "Midrand",
    "Centurion"
  ],
  "aisles": [
    {
      "number": 1,
      "name": "Pretoria Line",
      "routes": ["Pretoria CBD", "Hatfield", "Menlyn"]
    },
    {
      "number": 2,
      "name": "East Rand Line",
      "routes": ["Kempton Park", "OR Tambo", "Boksburg"]
    }
  ]
}
```

### Collection: `taxis`

Add sample taxis:

**Document 1:**
```json
{
  "registration": "ABC123GP",
  "driverName": "John Modise",
  "phoneNumber": "+27123456789",
  "totalLoads": 0,
  "membershipPaid": true,
  "lastLoad": null
}
```

**Document 2:**
```json
{
  "registration": "XYZ789GP",
  "driverName": "Sarah Nkosi",
  "phoneNumber": "+27987654321",
  "totalLoads": 0,
  "membershipPaid": true,
  "lastLoad": null
}
```

### Collection: `loads`

This collection will be populated automatically when marshals record loads.

## Step 6: Get Firebase Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click the web icon `</>`
4. Register your app as "TaxiHub Web"
5. Copy the firebaseConfig object
6. Paste it into `src/services/firebase.js`

## Step 7: Update Firebase Config

Open `src/services/firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Done! 🎉

Your Firebase backend is now set up and ready to use with TaxiHub!