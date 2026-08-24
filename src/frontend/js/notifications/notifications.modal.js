/* global showToast, updateNotificationDots */
/* eslint-disable no-undef */

window.notificationsWidget = (() => {
    let _isOpen = false;
    let _lastNotifications = [];
    let _isLoading = false;

    function _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _getToken() {
        return localStorage.getItem('backoffice_token') || '';
    }

    function _setTriggerState(active) {
        document.getElementById('desktop-notifications-btn')?.classList.toggle('active', active);
        document.getElementById('nav-notifications-btn')?.classList.toggle('active', active);
    }

    function _injectHTML() {
        if (document.getElementById('notifications-widget-container')) return;

        const container = document.createElement('div');
        container.id = 'notifications-widget-container';
        container.innerHTML = `
        <style>
            #nw-root {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99999;
                font-family: inherit;
                pointer-events: none;
            }
            #nw-popover {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 380px;
                height: 600px;
                max-height: calc(100vh - 100px);
                max-width: calc(100vw - 48px);
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translateY(20px);
                transition: opacity 0.3s, transform 0.3s;
                border: 1px solid rgba(0,0,0,0.08);
                color: #1e293b;
            }
            html[data-theme="dark"] #nw-popover {
                background: #0A2036;
                border-color: rgba(255,255,255,0.1);
                color: #f8fafc;
            }
            #nw-popover.nw-show {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0);
            }
            .nw-widget-controls {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 20;
                display: flex;
                gap: 6px;
            }
            .nw-widget-action {
                width: 28px;
                height: 28px;
                border: none;
                border-radius: 8px;
                background: rgba(22, 54, 84, 0.72);
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.14s ease;
            }
            .nw-widget-action[disabled] {
                opacity: 0.45;
                cursor: default;
                pointer-events: none;
            }
            .nw-widget-action:hover {
                transform: scale(0.97);
            }
            html[data-theme="dark"] .nw-widget-action {
                background: rgba(148, 163, 184, 0.28);
                color: #f8fafc;
            }
            .nw-header {
                min-height: 104px;
                padding: 24px 58px 20px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
                background: #0099FF;
                color: #ffffff;
            }
            html[data-theme="dark"] .nw-header {
                background: #102A43;
            }
            .nw-header-icon {
                width: 42px;
                height: 42px;
                border-radius: 12px;
                background: rgba(255,255,255,0.16);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .nw-header-title {
                margin: 0;
                font-size: 1.08rem;
                line-height: 1.2;
                font-weight: 800;
                color: #ffffff;
            }
            .nw-header-sub {
                margin: 3px 0 0;
                font-size: 0.78rem;
                line-height: 1.35;
                opacity: 0.88;
            }
            .nw-body {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                padding: 18px 20px 20px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #ffffff;
            }
            .nw-body {
                scrollbar-width: thin;
                scrollbar-color: rgba(0,153,255,0.42) transparent;
            }
            .nw-body::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .nw-body::-webkit-scrollbar-track {
                background: transparent;
            }
            .nw-body::-webkit-scrollbar-thumb {
                border-radius: 999px;
                background: rgba(0,153,255,0.42);
            }
            .nw-body::-webkit-scrollbar-thumb:hover {
                background: rgba(0,153,255,0.42);
            }
            html[data-theme="dark"] .nw-body {
                background: #0A2036;
            }
            .nw-card {
                padding: 14px;
                border-radius: 12px;
                border: 1px solid rgba(15,23,42,0.08);
                background: #f8fafc;
                display: flex;
                gap: 12px;
                align-items: flex-start;
            }
            .nw-card.nw-clickable {
                cursor: pointer;
                transition: transform 0.14s ease, border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
            }
            .nw-card.nw-clickable:hover {
                transform: scale(0.995);
                border-color: rgba(0,153,255,0.28);
            }
            .nw-card.nw-new {
                animation: nw-slide-in 0.24s ease both;
            }
            .nw-card.is-read {
                opacity: 0.58;
                filter: saturate(0.72);
            }
            .nw-card.is-read .nw-card-icon {
                background: rgba(100,116,139,0.1);
                color: #64748b;
            }
            @keyframes nw-slide-in {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            html[data-theme="dark"] .nw-card {
                background: rgba(255,255,255,0.035);
                border-color: rgba(255,255,255,0.08);
            }
            .nw-card.unread {
                border-left: 4px solid #ef4444;
            }
            .nw-card-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: rgba(239,68,68,0.1);
                color: #ef4444;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .nw-card-main {
                flex: 1;
                min-width: 0;
            }
            .nw-card-head {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 8px;
            }
            .nw-card-title {
                margin: 0;
                font-size: 0.86rem;
                line-height: 1.25;
                font-weight: 800;
                color: #0f172a;
            }
            html[data-theme="dark"] .nw-card-title {
                color: #f8fafc;
            }
            .nw-card-date,
            .nw-card-desc,
            .nw-empty-text {
                color: #64748b;
            }
            html[data-theme="dark"] .nw-card-date,
            html[data-theme="dark"] .nw-card-desc,
            html[data-theme="dark"] .nw-empty-text {
                color: #94a3b8;
            }
            .nw-card-date {
                font-size: 0.68rem;
                white-space: nowrap;
            }
            .nw-card-desc {
                margin: 4px 0 8px;
                font-size: 0.78rem;
                line-height: 1.45;
            }
            .nw-card-tags {
                display: flex;
                gap: 6px;
                align-items: center;
                flex-wrap: wrap;
            }
            .nw-tag {
                font-size: 0.6rem;
                border-radius: 5px;
                padding: 2px 7px;
                font-weight: 800;
                text-transform: uppercase;
                border: 1px solid rgba(0,153,255,0.22);
                background: rgba(0,153,255,0.1);
                color: #0099FF;
            }
            .nw-tag-danger {
                border-color: rgba(239,68,68,0.22);
                background: rgba(239,68,68,0.1);
                color: #ef4444;
            }
            .nw-tag-muted {
                border-color: rgba(100,116,139,0.18);
                background: rgba(100,116,139,0.08);
                color: #64748b;
            }
            html[data-theme="dark"] .nw-tag-muted {
                color: #94a3b8;
            }
            .nw-mark-btn {
                width: 28px;
                height: 28px;
                border-radius: 7px;
                border: 1px solid rgba(34,197,94,0.18);
                color: #22c55e;
                background: rgba(34,197,94,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                flex-shrink: 0;
                transition: transform 0.14s ease;
            }
            .nw-mark-btn:hover {
                transform: scale(0.97);
            }
            .nw-empty {
                text-align: center;
                padding: 48px 16px;
            }
            .nw-empty-icon {
                width: 54px;
                height: 54px;
                border-radius: 50%;
                background: rgba(34,197,94,0.1);
                border: 1px solid rgba(34,197,94,0.2);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 12px;
                color: #22c55e;
            }
            .nw-empty-title {
                margin: 0 0 4px;
                color: #0f172a;
                font-weight: 800;
            }
            html[data-theme="dark"] .nw-empty-title {
                color: #f8fafc;
            }
            @media (max-width: 640px) {
                #nw-root {
                    inset: 12px;
                    bottom: 12px;
                    right: 12px;
                }
                #nw-popover {
                    width: 100%;
                    height: 100%;
                    max-width: none;
                    max-height: none;
                }
            }
        </style>
        <div id="nw-root">
            <div id="nw-popover">
                <div class="nw-widget-controls">
                    <button class="nw-widget-action" id="nw-mark-all-btn" onclick="notificationsWidget.markAll(event)" title="Marcar todas como le&iacute;das" aria-label="Marcar todas como le&iacute;das">
                        <i class="fas fa-check-double"></i>
                    </button>
                    <button class="nw-widget-action" onclick="notificationsWidget.close(event)" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="nw-header">
                    <span class="nw-header-icon"><i class="fas fa-bell"></i></span>
                    <div>
                        <h3 class="nw-header-title">Notificaciones</h3>
                        <p class="nw-header-sub">Novedades del sistema</p>
                    </div>
                </div>
                <div class="nw-body" id="nw-list">
                    <div class="nw-empty">
                        <div class="nw-empty-icon"><i class="fas fa-bell" style="font-size:1.3rem;"></i></div>
                        <h4 class="nw-empty-title">Sin notificaciones</h4>
                        <p class="nw-empty-text" style="margin:0; font-size:0.8rem; max-width:280px; margin-inline:auto;">Las novedades del sistema aparecer&aacute;n ac&aacute;.</p>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.appendChild(container);
    }

    function init() {
        if (!_getToken()) return;
        _injectHTML();
    }

    async function open() {
        init();
        const popover = document.getElementById('nw-popover');
        if (!popover) return;

        if (window.supportWidget && typeof window.supportWidget.closeWidget === 'function') {
            window.supportWidget.closeWidget();
        }

        _isOpen = true;
        popover.classList.add('nw-show');
        _setTriggerState(true);
        await load();
    }

    function close(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        _isOpen = false;
        document.getElementById('nw-popover')?.classList.remove('nw-show');
        _setTriggerState(false);
    }

    function toggleOpen() {
        if (_isOpen) {
            close();
            return;
        }
        open();
    }

    async function load() {
        const listEl = document.getElementById('nw-list');
        if (!listEl) return;

        if (!_lastNotifications.length) {
            render([]);
        }

        const token = _getToken();
        if (_isLoading) return;
        _isLoading = true;
        try {
            const res = await fetch(`/api/backoffice/notifications?token=${encodeURIComponent(token)}&limit=40`);
            const result = await res.json();
            if (!result || !result.success) throw new Error(result.error || 'Error al cargar notificaciones');

            const notifications = result.data || [];
            const previousIds = new Set(_lastNotifications.map(n => String(n.id)));
            _lastNotifications = notifications;
            render(notifications, { previousIds });
        } catch (e) {
            console.error(e);
            if (_lastNotifications.length) return;
            listEl.innerHTML = `
                <div style="text-align:center; padding:30px; color:#ef4444;">
                    <i class="fas fa-triangle-exclamation" style="font-size:1.5rem; margin-bottom:8px;"></i>
                    <p style="margin:0; font-size:0.85rem;">Error al cargar notificaciones de sistema.</p>
                </div>
            `;
        } finally {
            _isLoading = false;
        }
    }

    function render(notifications, options = {}) {
        const listEl = document.getElementById('nw-list');
        if (!listEl) return;

        if (!notifications.length) {
            const markAllBtn = document.getElementById('nw-mark-all-btn');
            if (markAllBtn) {
                markAllBtn.disabled = true;
                markAllBtn.dataset.ids = '';
            }
            listEl.innerHTML = `
                <div class="nw-empty">
                    <div class="nw-empty-icon"><i class="fas fa-bell" style="font-size:1.3rem;"></i></div>
                    <h4 class="nw-empty-title">Sin notificaciones</h4>
                    <p class="nw-empty-text" style="margin:0; font-size:0.8rem; max-width:280px; margin-inline:auto;">Las novedades del sistema aparecer&aacute;n ac&aacute;.</p>
                </div>
            `;
            return;
        }

        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        const markAllBtn = document.getElementById('nw-mark-all-btn');
        if (markAllBtn) {
            markAllBtn.disabled = unreadIds.length === 0;
            markAllBtn.dataset.ids = unreadIds.join(',');
        }

        listEl.innerHTML = notifications.map(n => {
            const dateStr = new Date(n.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const errCode = n.metadata?.error_code || 'META';
            const isBulk = n.metadata?.is_bulk === true;
            const typeBadge = isBulk
                ? '<span class="nw-tag nw-tag-danger">Env&iacute;o Masivo</span>'
                : '<span class="nw-tag">Chat Individual</span>';

            return `
                <div class="nw-card ${!n.read ? 'unread' : 'is-read'} nw-clickable ${options.previousIds && !options.previousIds.has(String(n.id)) ? 'nw-new' : ''}" onclick="notificationsWidget.markSingle('${_esc(n.id)}')">
                    <div class="nw-card-icon"><i class="fas fa-circle-exclamation" style="font-size:0.95rem;"></i></div>
                    <div class="nw-card-main">
                        <div class="nw-card-head">
                            <h4 class="nw-card-title">${_esc(n.title)}</h4>
                            <span class="nw-card-date">${dateStr}</span>
                        </div>
                        <p class="nw-card-desc">${_esc(n.description)}</p>
                        <div class="nw-card-tags">
                            ${typeBadge}
                            <span class="nw-tag nw-tag-muted">C&oacute;digo ${_esc(errCode)}</span>
                        </div>
                    </div>
                    ${!n.read ? `
                        <button onclick="event.stopPropagation(); notificationsWidget.markSingle('${_esc(n.id)}')" class="nw-mark-btn" title="Marcar como le&iacute;da">
                            <i class="fas fa-check" style="font-size:0.8rem;"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async function markIds(ids, options = {}) {
        const token = _getToken();
        const idSet = new Set(ids.map(String));
        _lastNotifications = _lastNotifications.map(n => idSet.has(String(n.id)) ? { ...n, read: true } : n);
        render(_lastNotifications);

        const currentCount = parseInt(document.getElementById('desktop-badge-notifications-count')?.innerText || '0');
        const newCount = Math.max(0, currentCount - ids.length);
        const label = newCount > 99 ? '+99' : newCount;
        document.querySelectorAll('[data-notifications-badge]').forEach(badge => {
            badge.innerText = label;
            badge.style.display = newCount > 0 ? 'inline-flex' : 'none';
        });

        const res = await fetch(`/api/backoffice/notifications/read?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const data = await res.json();
        
        if (data.success && typeof data.unread_notifications_count !== 'undefined') {
            const finalLabel = data.unread_notifications_count > 99 ? '+99' : data.unread_notifications_count;
            document.querySelectorAll('[data-notifications-badge]').forEach(badge => {
                badge.innerText = finalLabel;
                badge.style.display = data.unread_notifications_count > 0 ? 'inline-flex' : 'none';
            });
        }

        if (!options.silent && typeof showToast === 'function') showToast('Notificaci\u00f3n le\u00edda', 'success');
        if (options.refresh !== false) await load();
    }

    async function markSingle(id) {
        const current = _lastNotifications.find(n => String(n.id) === String(id));
        if (current && current.read) return;
        try {
            await markIds([id], { silent: true });
        } catch (e) {
            console.error(e);
        }
    }

    async function markAll(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const ids = (document.getElementById('nw-mark-all-btn')?.dataset.ids || '')
            .split(',')
            .filter(Boolean);
        if (!ids.length) return;
        try {
            await markIds(ids, { silent: true });
        } catch (e) {
            console.error(e);
        }
    }

    return {
        init,
        open,
        close,
        toggleOpen,
        load,
        markSingle,
        markAll,
        isOpen: () => _isOpen
    };
})();

window.openNotificationsModal = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    window.notificationsWidget.init();
    window.notificationsWidget.toggleOpen();
};

window.closeNotificationsModal = function(e) {
    window.notificationsWidget.close(e);
};
