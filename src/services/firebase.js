import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAs7LG1x9IPUL0m9oxDB1X1i32dFPJ9YB4",
  authDomain: "taxihub-ea7ab.firebaseapp.com",
  projectId: "taxihub-ea7ab",
  storageBucket: "taxihub-ea7ab.firebasestorage.app",
  messagingSenderId: "512073501749",
  appId: "1:512073501749:web:96907e5297abdaea8bb57c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore - SIMPLIFIED (no cache options)
export const db = getFirestore(app);

export default app;