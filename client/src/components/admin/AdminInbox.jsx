import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function AdminInbox({ onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.get('/api/admin/notifications');
      setNotifications(data);
      const unread = data.filter(n => !n.read).length;
      onUnreadChange?.(unread);
    } catch (err) {
      console.error('Inbox error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/api/admin/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      onUnreadChange?.(prev => Math.max(0, (typeof prev === 'function' ? 0 : prev) - 1));
      // Recalculate from state
      setNotifications(prev => {
        const unread = prev.filter(n => n.id !== id && !n.read).length;
        onUnreadChange?.(unread);
        return prev.map(n => n.id === id ? { ...n, read: true } : n);
      });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/admin/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onUnreadChange?.(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    if (diff < 172800000) return 'Gestern';
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{unreadCount} ungelesen</p>
          <button
            onClick={markAllRead}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Alle als gelesen markieren
          </button>
        </div>
      )}

      {/* Notification-Liste */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 transition-colors ${!n.read ? 'bg-blue-50/50 border-l-4 border-l-primary-500' : 'border-l-4 border-l-transparent'}`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                n.type === 'registration' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {n.type === 'registration' ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatDate(n.createdAt)}
                  </span>
                </div>

                {n.message && (
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                )}

                {/* Related user info */}
                {n.relatedUser && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span>{n.relatedUser.email}</span>
                    {n.relatedUser.fisherCardNr && (
                      <span>Nr. {n.relatedUser.fisherCardNr}</span>
                    )}
                    {n.relatedUser.blocked && (
                      <span className="text-red-600 font-medium">Gesperrt</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    Als gelesen markieren
                  </button>
                )}
              </div>

              {/* Unread dot */}
              {!n.read && (
                <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5" />
              )}
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
            <p className="text-gray-400 text-sm">Keine Benachrichtigungen</p>
          </div>
        )}
      </div>
    </div>
  );
}
