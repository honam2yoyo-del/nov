import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAJzs95LRmWdHKRRRQhRNuJDXsi7HvYF8",
    authDomain: "nov-main.firebaseapp.com",
    projectId: "nov-main",
    storageBucket: "nov-main.firebasestorage.app",
    messagingSenderId: "341517399826",
    appId: "1:341517399826:web:e87f9c636b6c57f7e925cb",
    measurementId: "G-8X3QPPD39L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
