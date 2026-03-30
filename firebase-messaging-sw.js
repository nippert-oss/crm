// firebase-messaging-sw.js
// Place this at the ROOT of your GitHub Pages repo (nippert-oss.github.io)
// Or configure the service worker scope properly

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in the SW
// These values are safe to expose - they're restricted by Firebase Security Rules + domain allowlist
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "my-awesome-370e5.firebaseapp.com",
  projectId: "my-awesome-370e5",
  storageBucket: "my-awesome-370e5.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Handle background messages (app not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '정총무 CRM', {
    body: body || '새 알림이 있습니다',
    icon: icon || '/crm/icon-192.png',
    badge: '/crm/icon-192.png',
    tag: payload.data?.leadId || 'crm-notification',
    data: payload.data || {},
    actions: [
      { action: 'open', title: '리드 열기' },
      { action: 'dismiss', title: '닫기' }
    ]
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    const url = 'https://nippert-oss.github.io/crm/';
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/crm') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }
});

// Cache strategy for offline
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
