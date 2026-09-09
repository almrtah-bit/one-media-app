import { db, ref, set, get, onValue, off } from './firebase-config.js';

export const StorageManager = {
    // ✅ حفظ البيانات محلياً
    saveState(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error("خطأ في حفظ البيانات محلياً:", e);
        }
    },

    // ✅ قراءة البيانات محلياً
    loadState(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("خطأ في قراءة البيانات محلياً:", e);
            return null;
        }
    },

    // ✅ حذف البيانات محلياً
    clearState(key) {
        localStorage.removeItem(key);
    },

    // ==================== دوال المزامنة مع Firebase ====================

    // ✅ مزامنة جميع البيانات إلى Firebase بدمج ذكي يمنع فقدان أي واجبات
    async syncAllToFirebase() {
        try {
            const snapshot = await get(ref(db, 'appData'));
            let remoteData = snapshot.exists() ? snapshot.val() : {};

            let remoteSaved = remoteData.savedTasks || [];
            let remoteCompleted = remoteData.completedTasks || [];
            let remoteStaff = remoteData.mediaStaff || [];
            let remoteSettings = remoteData.settings || {};

            let localSaved = JSON.parse(localStorage.getItem('savedTasks')) || [];
            let localCompleted = JSON.parse(localStorage.getItem('completedTasks')) || [];
            let localStaff = JSON.parse(localStorage.getItem('mediaStaff')) || [];

            // 1. دمج المهام المكتملة
            const completedMap = new Map();
            remoteCompleted.forEach(t => { if (t && t.id) completedMap.set(String(t.id), t); });
            localCompleted.forEach(t => { if (t && t.id) completedMap.set(String(t.id), t); });
            const mergedCompleted = Array.from(completedMap.values());
            const completedIds = new Set(mergedCompleted.map(t => String(t.id)));

            // 2. دمج المهام المعلقة
            const savedMap = new Map();
            remoteSaved.forEach(t => {
                if (t && t.id && !completedIds.has(String(t.id)) && t.id !== "placeholder_saved") {
                    savedMap.set(String(t.id), t);
                }
            });

            localSaved.forEach(t => {
                if (t && t.id && !completedIds.has(String(t.id)) && t.id !== "placeholder_saved") {
                    savedMap.set(String(t.id), t);
                }
            });

            // التعامل مع الحذف من قبل مدير النظام
            const currentUser = localStorage.getItem('currentUser');
            const mediaStaff = JSON.parse(localStorage.getItem('mediaStaff')) || [];
            const currentUserData = mediaStaff.find(s => s.name === currentUser);
            const userRole = currentUserData ? currentUserData.role : localStorage.getItem('userRole');

            let mergedSaved;
            if (userRole === 'admin') {
                const localSavedIds = new Set(localSaved.map(t => String(t.id)));
                mergedSaved = Array.from(savedMap.values()).filter(t => {
                    if (completedIds.has(String(t.id))) return false;
                    return localSavedIds.has(String(t.id));
                });
            } else {
                mergedSaved = Array.from(savedMap.values());
            }

            // 3. دمج الكوادر
            const staffMap = new Map();
            remoteStaff.forEach(s => { if (s && (s.id || s.name)) staffMap.set(s.id || s.name, s); });
            localStaff.forEach(s => { if (s && (s.id || s.name)) staffMap.set(s.id || s.name, s); });
            const mergedStaff = Array.from(staffMap.values());

            const dataToSync = {
                mediaStaff: mergedStaff,
                savedTasks: mergedSaved,
                completedTasks: mergedCompleted,
                settings: {
                    hideAllTasks: localStorage.getItem('hideAllTasks') === 'true',
                    hiddenStaffTasks: JSON.parse(localStorage.getItem('hiddenStaffTasks')) || [],
                    appSecretKey: remoteSettings.appSecretKey || localStorage.getItem('appSecretKey') || ''
                }
            };

            await set(ref(db, 'appData'), dataToSync);

            // تحديث التخزين المحلي بالبيانات المندمجة
            localStorage.setItem('mediaStaff', JSON.stringify(mergedStaff));
            localStorage.setItem('savedTasks', JSON.stringify(mergedSaved));
            localStorage.setItem('completedTasks', JSON.stringify(mergedCompleted));

            console.log('✅ تمت مزامنة البيانات وتوحيدها بنجاح مع Firebase');
            return true;
        } catch (error) {
            console.error('❌ خطأ في مزامنة البيانات إلى Firebase:', error);
            throw error;
        }
    },

    // ✅ تحميل البيانات من Firebase
    async loadFromFirebase() {
        try {
            const snapshot = await get(ref(db, 'appData'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                if (data.mediaStaff) {
                    localStorage.setItem('mediaStaff', JSON.stringify(data.mediaStaff));
                }
                if (data.savedTasks) {
                    localStorage.setItem('savedTasks', JSON.stringify(data.savedTasks));
                } else {
                    localStorage.setItem('savedTasks', JSON.stringify([]));
                }
                if (data.completedTasks) {
                    localStorage.setItem('completedTasks', JSON.stringify(data.completedTasks));
                } else {
                    localStorage.setItem('completedTasks', JSON.stringify([]));
                }
                if (data.settings) {
                    localStorage.setItem('hideAllTasks', data.settings.hideAllTasks ? 'true' : 'false');
                    localStorage.setItem('hiddenStaffTasks', JSON.stringify(data.settings.hiddenStaffTasks || []));
                }
                
                console.log('✅ تم تحميل البيانات من Firebase بنجاح');
                return data;
            } else {
                console.log('⚠️ لا توجد بيانات في Firebase');
                return null;
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات من Firebase:', error);
            throw error;
        }
    },

    // ✅ الاستماع للتغييرات في Firebase (مزامنة لحظية)
    listenToChanges(callback) {
        const dataRef = ref(db, 'appData');
        onValue(dataRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (typeof callback === 'function') {
                    callback(data);
                }
            }
        });
    },

    // ✅ إيقاف الاستماع للتغييرات
    stopListening() {
        off(ref(db, 'appData'));
    }
};