// firebase-config.js
// ✅ إعدادات Firebase - تم تحديثها بالبيانات الحقيقية

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    push, 
    update, 
    remove, 
    query, 
    orderByChild, 
    equalTo,
    onValue,
    off,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔑 إعدادات Firebase (بيانات مشروع One Media)
const firebaseConfig = {
    apiKey: "AIzaSyAvvOzsLUUN6Lw5xkEguqq-_0m77NdW5gs",
    authDomain: "one-media-f9507.firebaseapp.com",
    databaseURL: "https://one-media-f9507-default-rtdb.firebaseio.com",
    projectId: "one-media-f9507",
    storageBucket: "one-media-f9507.firebasestorage.app",
    messagingSenderId: "177197508158",
    appId: "1:177197508158:web:a795f8e1d952238291936f",
    measurementId: "G-L4T086JLFR"
};

// 🔑 مفتاح التطبيق السري (APP_SECRET_KEY)
const APP_SECRET_KEY = "OneMedia_Secret_Key_2026_@Secure";

// ✅ تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ==================== إنشاء قاعدة البيانات والجداول تلقائياً ====================

async function initializeDatabaseStructure() {
    try {
        const snapshot = await get(ref(db, 'appData'));
        
        if (!snapshot.exists()) {
            console.log('🚀 قاعدة البيانات فارغة، جاري إنشاء البنية الأساسية...');
            
            const initialData = {
                mediaStaff: [
                    { 
                        id: 'main-admin', 
                        name: 'سجاد مهدي', 
                        password: '1234', 
                        unit: 'توثيق', 
                        role: 'admin', 
                        email: 'admin@example.com' 
                    }
                ],
                savedTasks: [],
                completedTasks: [],
                settings: {
                    hideAllTasks: false,
                    hiddenStaffTasks: [],
                    appSecretKey: APP_SECRET_KEY,
                    createdAt: new Date().toISOString()
                }
            };
            
            await set(ref(db, 'appData'), initialData);
            console.log('✅ تم إنشاء قاعدة البيانات والجداول تلقائياً في Firebase بنجاح!');
            
            localStorage.setItem('mediaStaff', JSON.stringify(initialData.mediaStaff));
            localStorage.setItem('savedTasks', JSON.stringify(initialData.savedTasks));
            localStorage.setItem('completedTasks', JSON.stringify(initialData.completedTasks));
            localStorage.setItem('hideAllTasks', 'false');
            localStorage.setItem('hiddenStaffTasks', JSON.stringify([]));
            localStorage.setItem('appSecretKey', APP_SECRET_KEY);
            
            return initialData;
        } else {
            console.log('✅ قاعدة البيانات موجودة بالفعل');
            const data = snapshot.val();
            
            if (data.mediaStaff && (!localStorage.getItem('mediaStaff') || localStorage.getItem('mediaStaff') === '[]')) {
                localStorage.setItem('mediaStaff', JSON.stringify(data.mediaStaff));
            }
            if (data.savedTasks) {
                localStorage.setItem('savedTasks', JSON.stringify(data.savedTasks));
            }
            if (data.completedTasks) {
                localStorage.setItem('completedTasks', JSON.stringify(data.completedTasks));
            }
            
            if (data.settings && !data.settings.appSecretKey) {
                await update(ref(db, 'appData/settings'), { appSecretKey: APP_SECRET_KEY });
                localStorage.setItem('appSecretKey', APP_SECRET_KEY);
            }
            
            return data;
        }
    } catch (error) {
        console.error('❌ خطأ في إنشاء قاعدة البيانات:', error);
        throw error;
    }
}

export { 
    db, 
    auth, 
    ref, 
    set, 
    get, 
    push, 
    update, 
    remove, 
    query, 
    orderByChild, 
    equalTo, 
    onValue, 
    off,
    onDisconnect,
    APP_SECRET_KEY,
    initializeDatabaseStructure,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
};