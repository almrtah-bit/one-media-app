import { NavbarManager } from './navbar.js';
import { StorageManager } from './storage.js';
import { db, ref, set, get, onValue, off, auth, signInWithEmailAndPassword, initializeDatabaseStructure, APP_SECRET_KEY } from './firebase-config.js';

class App {
    constructor() {
        this.cachedViews = {};
        this.currentView = null;
        this.init();
    }

    async init() {
        // ✅ جعل StorageManager و Firebase Modules متاحة عالمياً لملفات HTML
        window.StorageManager = StorageManager;
        window.firebaseModules = { db, ref, set, get, onValue, off, auth, signInWithEmailAndPassword, APP_SECRET_KEY };
        window.APP_SECRET_KEY = APP_SECRET_KEY;

        // ✅ إضافة مؤشر المزامنة
        this.addSyncIndicator();
        // ✅ إضافة نظام الإشعارات
        this.addNotificationSystem();

        await this.loadNavbarStyles();
        
        // ✅ تحميل CSS مسبقاً لمنع التنسيق المبعثر
        this.preloadCSS('assets/css/new.css');
        this.preloadCSS('assets/css/styles.css');
        
        await this.loadNavbar();
        
        try {
            await initializeDatabaseStructure();
            console.log('✅ تم إنشاء/التحقق من قاعدة البيانات بنجاح');
        } catch (error) {
            console.warn('⚠️ تعذر إنشاء قاعدة البيانات:', error.message);
        }
        
        try {
            await StorageManager.loadFromFirebase();
            console.log('✅ تم تحميل البيانات من Firebase تلقائياً');
        } catch (error) {
            console.warn('⚠️ تعذر تحميل البيانات من Firebase:', error.message);
        }
        
        // ✅ إضافة مستمع للتغييرات في Firebase (مزامنة لحظية فورية)
        StorageManager.listenToChanges((data) => {
            console.log('🔔 تم استلام تحديث من Firebase');
            
            if (data) {
                const oldSavedTasks = JSON.parse(localStorage.getItem('savedTasks')) || [];
                const oldCompletedTasks = JSON.parse(localStorage.getItem('completedTasks')) || [];
                
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
                
                // إرسال إشعارات ذكية للمستخدم الحالي
                const currentUser = localStorage.getItem('currentUser');
                if (currentUser) {
                    const newSavedTasks = JSON.parse(localStorage.getItem('savedTasks')) || [];
                    const newCompletedTasks = JSON.parse(localStorage.getItem('completedTasks')) || [];
                    
                    // إشعار الموافقة
                    const newlyApproved = newCompletedTasks.filter(task => {
                        return task.staff && task.staff.includes(currentUser) && 
                               !oldCompletedTasks.some(old => old.id === task.id);
                    });
                    
                    if (newlyApproved.length > 0) {
                        this.showNotification(`✅ تمت الموافقة على واجبك: ${newlyApproved[0].title}`, 'success');
                    }
                    
                    // إشعار الرفض أو الحذف
                    const removedFromSaved = oldSavedTasks.filter(oldTask => {
                        return oldTask.staff && oldTask.staff.includes(currentUser) && 
                               !newSavedTasks.some(newTask => newTask.id === oldTask.id) && 
                               !newCompletedTasks.some(newTask => newTask.id === oldTask.id);
                    });
                    
                    if (removedFromSaved.length > 0) {
                        this.showNotification(`❌ تم رفض أو حذف واجبك: ${removedFromSaved[0].title}`, 'error');
                    }
                }
            }

            // إرسال حدث مخصص لتحديث الواجهات المفتوحة فورياً
            window.dispatchEvent(new CustomEvent('appDataUpdated', { detail: data }));
            
            // إعادة تحميل واجهة الرئيسية فقط عند التواجد فيها
            if (this.currentView === 'home') {
                this.refreshCurrentView();
            }
        });
        
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            delete this.cachedViews['login'];
            this.switchView('login');
        } else {
            this.switchView('home');
        }
    }

    preloadCSS(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    }

    refreshCurrentView() {
        const currentView = this.currentView;
        if (currentView && currentView !== 'login') {
            delete this.cachedViews[currentView];
            this.switchView(currentView, true);
        }
    }

    addSyncIndicator() {
        if (!document.getElementById('sync-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'sync-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
                background: #0066cc;
                color: #fff;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                display: none;
                align-items: center;
                gap: 8px;
                transition: opacity 0.3s ease;
                font-family: Tahoma, sans-serif;
            `;
            indicator.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span>جارٍ المزامنة...</span>
            `;
            document.body.appendChild(indicator);

            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showSyncIndicator() {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
            indicator.style.opacity = '1';
        }
    }

    hideSyncIndicator() {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 300);
        }
    }

    async syncWithIndicator() {
        this.showSyncIndicator();
        try {
            await StorageManager.syncAllToFirebase();
            await new Promise(resolve => setTimeout(resolve, 300));
        } finally {
            this.hideSyncIndicator();
        }
    }

    async refreshDataFromFirebase() {
        try {
            const snapshot = await get(ref(db, 'appData'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.mediaStaff) localStorage.setItem('mediaStaff', JSON.stringify(data.mediaStaff));
                if (data.savedTasks) localStorage.setItem('savedTasks', JSON.stringify(data.savedTasks));
                if (data.completedTasks) localStorage.setItem('completedTasks', JSON.stringify(data.completedTasks));
                if (data.settings) {
                    localStorage.setItem('hideAllTasks', data.settings.hideAllTasks ? 'true' : 'false');
                    localStorage.setItem('hiddenStaffTasks', JSON.stringify(data.settings.hiddenStaffTasks || []));
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ خطأ في قراءة البيانات من Firebase:', error);
            return false;
        }
    }

    addNotificationSystem() {
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
                width: 90%;
                max-width: 400px;
                font-family: Tahoma, sans-serif;
            `;
            document.body.appendChild(container);
        }
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#0066cc'};
            color: #fff;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            opacity: 1;
            transition: opacity 0.3s ease;
        `;

        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔';
        notification.innerHTML = `
            <span style="font-size: 20px;">${icon}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: transparent; border: none; color: #fff; font-size: 16px; cursor: pointer; font-weight: bold;">×</button>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => { notification.remove(); }, 300);
        }, 5000);
    }

    async loadNavbarStyles() {
        if (!document.querySelector('link[data-navbar-css]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'assets/css/navbar.css';
            link.setAttribute('data-navbar-css', 'true');
            document.head.appendChild(link);
        }
    }

    async loadNavbar() {
        try {
            const response = await fetch('components/navbar.html');
            if (!response.ok) throw new Error('فشل تحميل الشريط');
            const html = await response.text();
            document.getElementById('navbar-container').innerHTML = html;
            
            NavbarManager.initEvents((viewName) => {
                this.switchView(viewName);
            });
        } catch (error) {
            console.error(error);
            document.getElementById('navbar-container').innerHTML = '<div style="color:red; text-align:center; padding:10px;">خطأ في تحميل الشريط</div>';
        }
    }

    async switchView(viewName, force = false) {
        if (this.currentView === viewName && !force) {
            return;
        }
        this.currentView = viewName;

        const navbarContainer = document.getElementById('navbar-container');
        if (viewName === 'login') {
            navbarContainer.style.display = 'none';
        } else {
            navbarContainer.style.display = 'block';
        }

        NavbarManager.updateUI(viewName);

        const viewContainer = document.getElementById('main-content-view');
        if (!viewContainer) return;

        if (this.cachedViews[viewName] && viewName !== 'login' && !force) {
            viewContainer.innerHTML = this.cachedViews[viewName];
            
            const scripts = viewContainer.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript);
                script.remove();
            });
            
            return;
        }

        viewContainer.style.opacity = '0';
        viewContainer.style.transition = 'opacity 0.15s ease';
        
        try {
            const response = await fetch(`views/${viewName}.html`);
            if (!response.ok) throw new Error(`الملف غير موجود (${response.status})`);
            
            const html = await response.text();
            
            if (viewName !== 'login') {
                this.cachedViews[viewName] = html;
            }
            
            viewContainer.innerHTML = html;

            const scripts = viewContainer.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript);
                script.remove();
            });

            setTimeout(() => {
                viewContainer.style.opacity = '1';
            }, 50);

        } catch (error) {
            console.error(error);
            viewContainer.innerHTML = `<div style="text-align:center; padding:50px; color:red;">عذراً، تعذر تحميل واجهة (${viewName}). تأكد من وجود الملف داخل مجلد views.</div>`;
            viewContainer.style.opacity = '1';
        }
    }
}

window.appInstance = new App();