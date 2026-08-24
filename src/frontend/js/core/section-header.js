/* global renderSectionTabs */
(function() {
    window.__PERSISTENT_SECTION_HEADER = true;
    window.__DESKTOP_SECTION_TABS_DISABLED = true;

    const SECTION_PATHS = {
        messaging: ['/dashboard', '/conversaciones', '/contactos', '/reportes', '/conexion', '/conexion-chatbot', '/webchat'],
        integrations: ['/crm', '/crm-tareas', '/meta', '/mercado-libre', '/mercado-libre-productos', '/mercado-libre-bot', '/mercado-pago', '/lista-negra', '/webhooks', '/epc-cbu-cvu'],
    };

    let currentSection = null;

    function isConversationsPath(path) {
        return path === '/conversaciones';
    }

    function getSectionForPath(path) {
        if (SECTION_PATHS.messaging.includes(path)) return 'messaging';
        if (SECTION_PATHS.integrations.includes(path)) return 'integrations';
        return '';
    }

    function clearDetachedMenus() {
        if (typeof window.closeSectionTabMenus === 'function') window.closeSectionTabMenus();
        const host = document.getElementById('section-tab-menu-host');
        if (host) host.innerHTML = '';
    }

    function updateActiveTabs(path) {
        const params = new URLSearchParams(window.location.search);
        document.querySelectorAll('#section-header-root .section-tab').forEach(tab => {
            const route = tab.getAttribute('data-route') || '';
            const panel = tab.getAttribute('data-panel') || '';
            const matchRoutes = (tab.getAttribute('data-match-routes') || '').split(',').filter(Boolean);
            const routeMatch = route === path || (route === '/docs' && path === '/documentacion');
            const groupMatch = matchRoutes.includes(path);
            const panelMatch = panel && isConversationsPath(path) && params.get('openPanel') === panel;
            const backofficeRootMatch = isConversationsPath(route) && isConversationsPath(path) && !params.get('openPanel');
            tab.classList.toggle('active', Boolean(groupMatch || panelMatch || backofficeRootMatch || (routeMatch && !isConversationsPath(route))));
        });
        document.querySelectorAll('#section-header-root .section-tab-menu-item[data-route]').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-route') === path);
        });
    }

    window.updateSectionHeader = function(path = window.location.pathname, options = {}) {
        const root = document.getElementById('section-header-root');
        if (!root) return;

        if (window.__DESKTOP_SECTION_TABS_DISABLED) {
            clearDetachedMenus();
            root.innerHTML = '';
            root.hidden = true;
            currentSection = null;
            return;
        }

        const section = getSectionForPath(path);
        if (!section || typeof window.renderSectionTabs !== 'function') {
            clearDetachedMenus();
            root.innerHTML = '';
            root.hidden = true;
            currentSection = null;
            return;
        }

        root.hidden = false;
        if (options.force || currentSection !== section || !root.firstElementChild) {
            clearDetachedMenus();
            root.innerHTML = window.renderSectionTabs(section, { persistent: true });
            currentSection = section;
            if (typeof window.applyCachedNotificationDots === 'function') window.applyCachedNotificationDots();
        }

        updateActiveTabs(path);
    };

    window.getSectionForPath = getSectionForPath;
})();
