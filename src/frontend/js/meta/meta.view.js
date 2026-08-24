/* global showToast, navigate */
window.metaView = (() => {
    let _token = '';
    let _metaConfig = {};
    let _availableTemplates = [];
    let _currentTemplate = null;
    let _selectedTagIds = new Set();
    let _popupCheckInterval = null;
    let _previewFitFrame = null;

    // ── HTML ──────────────────────────────────────────────────────────────
    function getHTML() {
        return `
        <main class="crm-main-container" style="z-index:10; padding:0;">
            ${window.renderSectionTabs ? window.renderSectionTabs('integrations') : ''}

            <div class="kanban-header animate-fade">
                <div class="header-info">
                    <h1><i class="fab fa-meta kanban-header-icon" style="color:#0668E1;"></i> Centro Meta</h1>
                    <p>Herramientas para negocios</p>
                </div>
                <div id="meta-view-badge-bar" class="meta-badge-bar" style="display:none;">
                    <a id="link-meta-library" href="https://business.facebook.com/latest/whatsapp_manager/template_library" target="_blank" class="meta-link-item">
                        <i class="fas fa-book"></i> Biblioteca <span class="meta-library-badge">SDK</span>
                    </a>
                    <a id="link-meta-new" href="https://business.facebook.com/latest/whatsapp_manager/message_templates" target="_blank" class="meta-link-item">
                        <i class="fas fa-plus"></i> Nueva Plantilla
                    </a>
                </div>
            </div>

            <!-- Contenido principal con padding -->
            <div class="meta-view-body">

                <!-- Estado: no vinculado -->
                <div id="meta-not-connected" style="display:none;">
                    <div class="meta-onboarding-wrap glass-card animate-fade">
                        <div style="margin-bottom:1.25rem; text-align:center; width:100%;">
                            <h2 style="margin:0 0 8px; color:var(--text-main); font-size:1.45rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:10px;">
                                <i class="fas fa-infinity" style="color:#0668E1; font-size:1.5rem; flex-shrink:0;"></i> Conexion Oficial
                            </h2>
                            <div style="height:3px; width:50px; background:#0668E1; border-radius:10px; margin:0 auto 12px;"></div>
                            <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5; margin:0;">
                                Conecta tu cuenta de <strong>WhatsApp Business</strong> oficial para habilitar funciones profesionales.
                            </p>
                        </div>
                        <div style="background:var(--bg-header); padding:1rem 1.25rem; border-radius:16px; border:1px solid var(--border); width:100%; text-align:left; margin-bottom:1.25rem;">
                            <h4 style="margin:0 0 8px; color:#0668E1; font-size:0.78rem; text-transform:uppercase; letter-spacing:1.5px; font-weight:700;">Beneficios activos:</h4>
                            <ul style="font-size:0.88rem; color:var(--text-main); margin:0; display:flex; flex-direction:column; gap:4px; list-style:none; padding:0;">
                                <li>Integracion por <strong>Coexistencia</strong>.</li>
                                <li>Registro via <strong>Popup de Facebook</strong>.</li>
                                <li>Envio de <strong>Mensajes Masivos (HSM)</strong>.</li>
                                <li>Soporte para <strong>Imagenes y Audios</strong> oficiales.</li>
                            </ul>
                        </div>
                        <button id="meta-onboard-btn" class="btn-primary w-full" onclick="launchMetaOnboardingView()">
                            <i class="fab fa-meta"></i> Vincular con META
                        </button>
                        <div id="meta-onboard-status" style="display:none; margin-top:1rem; color:var(--text-muted); font-size:0.85rem; text-align:center;">
                            <i class="fas fa-circle-notch fa-spin"></i> Esperando confirmacion de vinculacion...
                        </div>
                    </div>
                </div>


                <!-- Estado: vinculado -->
                <div id="meta-connected-area" style="display:none;">

                    <!-- Panel de plantillas (contenedor visual + scroll) -->
                    <div class="meta-view-panel animate-fade">

                        <div class="meta-templates-header">
                            <div id="tab-my-templates" class="meta-templates-title active">
                                <span class="meta-templates-icon"><i class="fas fa-list"></i></span>
                                <div class="meta-templates-copy">
                                    <h2>Mis Plantillas</h2>
                                    <p id="meta-templates-subtitle">Selecciona una plantilla para preparar el reenvio.</p>
                                </div>
                            </div>
                            <button id="tpl-detail-back-header" class="tpl-detail-back-btn" style="display:none;" onclick="switchMetaTab('my')">
                                <i class="fas fa-arrow-left"></i> Volver a plantillas
                            </button>
                        </div>

                        <!-- Body colapsable -->
                        <div class="meta-panel-body">

                        <!-- Grid de plantillas -->
                        <div id="view-my-templates" class="meta-grid">
                            <div class="text-center py-10 opacity-50" style="grid-column:1/-1;">
                                <i class="fas fa-circle-notch fa-spin text-3xl text-accent-bright"></i>
                                <p class="text-sm text-secondary-content mt-3">Sincronizando con Meta Cloud...</p>
                            </div>
                        </div>

                        <!-- Detalle de plantilla -->
                        <div id="view-template-detail" style="display:none; padding:1.75rem 2rem;">
                            <div class="tpl-detail-grid">
                                <!-- Preview WhatsApp -->
                                <div class="meta-preview-overlay tpl-preview-col rounded-2xl overflow-hidden">
                                    <div class="tpl-preview-stage">
                                        <div class="tpl-preview-phone">
                                            <div class="tpl-preview-phone-head">
                                                <span>Vista previa</span>
                                                <i class="fab fa-whatsapp"></i>
                                            </div>
                                            <div class="tpl-preview-screen">
                                                <div class="wa-preview-bubble">
                                                    <div id="wa-preview-text-final" class="wa-preview-text">...</div>
                                                    <div class="wa-preview-time">12:00 <i class="fas fa-check-double wa-check-icon"></i></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- Acciones compactas -->
                                <div class="tpl-actions-col">
                                    <!-- Cabecera: back + nombre + edit -->
                                    <div class="tpl-compact-header">
                                        <div class="min-w-0 flex-1">
                                            <h2 id="detail-tpl-name" class="tpl-name-compact">Nombre de Plantilla</h2>
                                            <div class="tpl-detail-badges" style="margin-top:4px;">
                                                <div id="detail-tpl-status" class="meta-card-tag" style="position:static; transform:none;">ESTADO</div>
                                                <span id="detail-tpl-lang-badge" class="tpl-info-badge"><i class="fas fa-globe"></i> ES</span>
                                                <span id="detail-tpl-cat-badge" class="tpl-info-badge"><i class="fas fa-tag"></i> CATEGORIA</span>
                                            </div>
                                        </div>
                                        <a id="btn-edit-in-meta" href="#" target="_blank" style="display:none; flex-shrink:0;">
                                            <i class="fab fa-facebook"></i> META
                                        </a>
                                    </div>
                                    <!-- Boton preview (solo mobile/tablet) -->
                                    <button class="tpl-preview-btn" onclick="showTplPreviewModal()">
                                        <i class="fas fa-eye"></i> Mostrar Plantilla
                                    </button>
                                    <!-- Envio masivo compacto -->
                                    <div id="bulk-actions-section" style="display:none;" class="bulk-compact-body">
                                        <!-- Fechas -->
                                        <div class="bulk-filter-date-grid">
                                            <div>
                                                <label class="bulk-filter-sublabel">Desde</label>
                                                <input type="date" id="bulk-filter-start" class="crm-input bulk-filter-input">
                                            </div>
                                            <div>
                                                <label class="bulk-filter-sublabel">Hasta</label>
                                                <input type="date" id="bulk-filter-end" class="crm-input bulk-filter-input">
                                            </div>
                                        </div>
                                        <!-- Tags chips -->
                                        <div class="bulk-tags-panel">
                                            <div class="bulk-tags-head">
                                                <label class="bulk-filter-sublabel">Etiquetas</label>
                                                <span id="bulk-tags-count" class="bulk-tags-count">0 seleccionadas</span>
                                            </div>
                                            <label class="bulk-tags-search">
                                                <i class="fas fa-search"></i>
                                                <input id="bulk-tags-search" type="search" placeholder="Buscar etiqueta..." oninput="filterBulkTags(this.value)">
                                            </label>
                                            <div class="bulk-tags-box">
                                                <div id="bulk-filter-tags" class="bulk-tags-chips"></div>
                                            </div>
                                        </div>
                                        <!-- Pasos lado a lado -->
                                        <div class="bulk-steps-grid">
                                            <div class="bulk-step-box">
                                                <div class="bulk-step-label"><i class="fas fa-file-excel icon-excel"></i> 1. Descargar</div>
                                                <button class="btn-primary bulk-step-btn" onclick="downloadBulkExcel()">
                                                    Formato Excel
                                                </button>
                                            </div>
                                            <div class="bulk-step-box">
                                                <div class="bulk-step-label"><i class="fas fa-paper-plane" style="color:#0668E1;"></i> 2. Enviar</div>
                                                <div class="bulk-step-row">
                                                    <input type="file" id="bulk-file-input" class="crm-input bulk-step-file" accept=".xlsx,.xls">
                                                    <button class="btn-primary flex-shrink-0 bulk-step-send" onclick="startBulkSend()" id="send-bulk-btn">
                                                        <i class="fas fa-paper-plane"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- Envío Rápido (Solo para plantillas sin variables) -->
                                        <div id="quick-send-container" style="display:none; margin-top:15px; border-top:1px dashed var(--border); padding-top:15px; width:100%;">
                                            <button id="quick-send-btn" class="btn-primary bulk-step-btn" onclick="startQuickBulkSend()" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                                                <i class="fas fa-bolt"></i> Envío Rápido
                                            </button>
                                        </div>
                                        <!-- Progreso -->
                                        <div id="bulk-progress" style="display:none;">
                                            <div class="bulk-progress-track">
                                                <div id="bulk-progress-bar" class="bulk-progress-bar" style="width:0%"></div>
                                            </div>
                                            <p id="bulk-status-text" class="bulk-status-text"></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        </div><!-- /.meta-panel-body -->

                    </div><!-- /.meta-view-panel -->

                </div><!-- /#meta-connected-area -->

            </div><!-- /.meta-view-body -->

        </main>`;
    }

    // ── Init / Destroy ────────────────────────────────────────────────────
    async function init() {
        _token = localStorage.getItem('backoffice_token') || localStorage.getItem('system_config_token') || '';
        _availableTemplates = [];
        _currentTemplate = null;
        _selectedTagIds = new Set();
        _popupCheckInterval = null;

        window.switchMetaTab            = switchMetaTab;
        window.showTemplateDetail       = showTemplateDetail;
        window.startBulkSend            = startBulkSend;
        window.downloadBulkExcel        = downloadBulkExcel;
        window.toggleTagChip            = toggleTagChip;
        window.toggleMetaAccordion      = toggleMetaAccordion;
        window.showTplPreviewModal      = showTplPreviewModal;
        window.launchMetaOnboardingView = launchMetaOnboardingView;
        window.syncAndSaveConnection    = syncAndSaveConnection;
        window.startQuickBulkSend       = startQuickBulkSend;
        window.filterBulkTags           = filterBulkTags;
        window.addEventListener('resize', scheduleTemplatePreviewFit);

        await checkMetaConnection();
    }

    function destroy() {
        if (_popupCheckInterval) { clearInterval(_popupCheckInterval); _popupCheckInterval = null; }
        if (_previewFitFrame) { cancelAnimationFrame(_previewFitFrame); _previewFitFrame = null; }
        window.removeEventListener('resize', scheduleTemplatePreviewFit);
        document.getElementById('tpl-preview-modal')?.remove();
        ['switchMetaTab', 'showTemplateDetail', 'startBulkSend', 'downloadBulkExcel',
         'toggleTagChip', 'toggleMetaAccordion', 'showTplPreviewModal', 'launchMetaOnboardingView',
         'syncAndSaveConnection', 'startQuickBulkSend', 'filterBulkTags'
        ].forEach(fn => { delete window[fn]; });
    }

    // ── Verificacion de conexion ──────────────────────────────────────────
    async function checkMetaConnection(silent = false) {
        try {
            const sId = (typeof window !== 'undefined' && window.railwayServiceId) ? window.railwayServiceId : '';
            const pId = (typeof window !== 'undefined' && window.railwayProjectId) ? window.railwayProjectId : '';
            const res  = await fetch(`/api/backoffice/whatsapp/config?token=${_token}&serviceId=${sId}&projectId=${pId}`);
            const data = await res.json();
            _metaConfig = (data && data.config) || {};
            const validId = (v) => v && v !== 'PENDING';
            const connected = validId(_metaConfig.waba_id) && validId(_metaConfig.phone_number_id);

            if (connected) {
                const libLink = document.getElementById('link-meta-library');
                const newLink = document.getElementById('link-meta-new');
                if (libLink) libLink.href = `https://business.facebook.com/latest/whatsapp_manager/template_library?asset_id=${_metaConfig.waba_id}`;
                if (newLink) newLink.href  = `https://business.facebook.com/latest/whatsapp_manager/message_templates?asset_id=${_metaConfig.waba_id}`;

                const notConn = document.getElementById('meta-not-connected');
                if (notConn) notConn.style.display = 'none';

                const badgeBar = document.getElementById('meta-view-badge-bar');
                if (badgeBar) badgeBar.style.display = 'flex';

                const area = document.getElementById('meta-connected-area');
                if (area) area.style.display = 'block';

                loadTags();
                loadTemplates();
            } else if (!silent) {
                const notConn = document.getElementById('meta-not-connected');
                if (notConn) notConn.style.display = 'block';
            }
        } catch (e) {
            console.error('[MetaView] Error al verificar conexion:', e);
        }
    }

    // ── Tags para filtro de descarga ──────────────────────────────────────
    async function loadTags() {
        try {
            const res  = await fetch(`/api/backoffice/tags?token=${_token}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const container = document.getElementById('bulk-filter-tags');
                if (!container) return;
                if (data.length === 0) {
                    container.innerHTML = '<span class="bulk-filter-sublabel" style="opacity:0.5;">Sin etiquetas disponibles</span>';
                    updateBulkTagsCount();
                    return;
                }
                container.innerHTML = data.map(t =>
                    `<span class="bulk-tag-chip" data-id="${escapeTemplateText(t.id)}" data-name="${escapeTemplateText(t.name)}" onclick="toggleTagChip(this)">${escapeTemplateText(t.name)}</span>`
                ).join('');
                updateBulkTagsCount();
            }
        } catch (e) { /* silencioso */ }
    }

    function toggleTagChip(el) {
        const id = el.dataset.id;
        if (_selectedTagIds.has(id)) {
            _selectedTagIds.delete(id);
            el.classList.remove('selected');
        } else {
            _selectedTagIds.add(id);
            el.classList.add('selected');
        }
        updateBulkTagsCount();
    }

    function updateBulkTagsCount() {
        const countEl = document.getElementById('bulk-tags-count');
        if (!countEl) return;
        const count = _selectedTagIds.size;
        countEl.innerText = count === 1 ? '1 seleccionada' : `${count} seleccionadas`;
    }

    function filterBulkTags(value = '') {
        const query = String(value).trim().toLowerCase();
        document.querySelectorAll('#bulk-filter-tags .bulk-tag-chip').forEach(chip => {
            const name = (chip.dataset.name || chip.textContent || '').toLowerCase();
            chip.style.display = !query || name.includes(query) ? 'inline-flex' : 'none';
        });
    }

    function scheduleTemplatePreviewFit() {
        if (_previewFitFrame) cancelAnimationFrame(_previewFitFrame);
        _previewFitFrame = requestAnimationFrame(fitTemplatePreview);
    }

    function fitTemplatePreview() {
        _previewFitFrame = null;
        const shell = document.querySelector('#view-template-detail .tpl-preview-screen');
        const bubble = document.querySelector('#view-template-detail .wa-preview-bubble');
        if (!shell || !bubble) return;
        bubble.style.setProperty('--tpl-preview-scale', '1');
        const availableW = Math.max(shell.clientWidth - 28, 1);
        const availableH = Math.max(shell.clientHeight - 28, 1);
        const contentW = Math.max(bubble.scrollWidth, bubble.offsetWidth, 1);
        const contentH = Math.max(bubble.scrollHeight, bubble.offsetHeight, 1);
        const scale = Math.min(1, availableW / contentW, availableH / contentH);
        bubble.style.setProperty('--tpl-preview-scale', String(Math.max(0.48, scale)));
    }

    // ── Carga y render de plantillas ──────────────────────────────────────
    async function loadTemplates() {
        const container = document.getElementById('view-my-templates');
        if (!container) return;
        container.innerHTML = `
            <div class="text-center py-10 opacity-50" style="grid-column:1/-1;">
                <i class="fas fa-circle-notch fa-spin text-3xl text-accent-bright"></i>
                <p class="text-sm text-secondary-content mt-3">Sincronizando con Meta Cloud...</p>
            </div>`;
        try {
            const params = new URLSearchParams({ token: _token });
            if (window.railwayProjectId) params.set('projectId', window.railwayProjectId);
            if (window.railwayServiceId) params.set('serviceId', window.railwayServiceId);
            const res  = await fetch(`/api/backoffice/whatsapp/templates?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                _availableTemplates = data.templates;
                renderCards(container, _availableTemplates);
            } else {
                container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">No se encontraron plantillas.</p>';
            }
        } catch (e) {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">Error al sincronizar con Meta Cloud.</p>';
        }
    }

    function escapeTemplateText(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeTemplateArg(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r?\n/g, ' ');
    }

    function getTemplatePreviewText(template) {
        let text = 'Sin contenido de previsualizacion';
        if (template.components && Array.isArray(template.components)) {
            const body = template.components.find(c => c.type === 'BODY' || c.type?.toUpperCase() === 'BODY');
            if (body) text = body.text || body.content || body.example?.body_text?.[0]?.[0] || text;
            if (text === 'Sin contenido de previsualizacion') {
                for (const comp of template.components) {
                    if (comp.text || comp.content) { text = comp.text || comp.content; break; }
                }
            }
        } else if (template.body) {
            text = template.body;
        }
        return String(text || 'Sin contenido de previsualizacion');
    }

    function formatTemplateDate(template) {
        const value = template.last_updated_time || template.updated_at || template.modified_at || template.created_at;
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function renderCards(container, templates) {
        if (!templates || templates.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">No se encontraron plantillas.</p>';
            return;
        }
        const rows = templates.map(t => {
            const text = getTemplatePreviewText(t);
            const cleanText = text.length > 150 ? text.substring(0, 147) + '...' : text;
            const cardClass = t.status === 'APPROVED' ? 'meta-card-approved' : (t.status === 'REJECTED' ? 'meta-card-rejected' : 'meta-card-pending');
            const statusClass = t.status === 'APPROVED' ? 'meta-status-approved' : (t.status === 'REJECTED' ? 'meta-status-rejected' : 'meta-status-pending');
            return `
                <button type="button" class="meta-template-row meta-card ${cardClass}" onclick="showTemplateDetail('${escapeTemplateArg(t.id || t.name)}','${escapeTemplateArg(t.language)}')">
                    <span class="meta-row-name">${escapeTemplateText(t.name)}</span>
                    <span class="meta-row-category">${escapeTemplateText(t.category || '--')}</span>
                    <span class="meta-row-language">
                        <strong>${escapeTemplateText((t.language || '').toUpperCase() || '--')}</strong>
                        <small>${escapeTemplateText(cleanText)}</small>
                    </span>
                    <span class="meta-row-status"><span class="meta-card-tag ${statusClass}">${escapeTemplateText(t.status || 'PENDING')}</span></span>
                    <span class="meta-row-updated">${escapeTemplateText(formatTemplateDate(t))}</span>
                    <span class="meta-card-mobile-desc">${escapeTemplateText(cleanText)}</span>
                    <span class="meta-card-mobile-meta">
                        <span><i class="fas fa-fingerprint"></i> ID: ${escapeTemplateText(t.id || 'N/A')}</span>
                        <span><i class="fas fa-globe"></i> ${escapeTemplateText((t.language || '').toUpperCase() || '--')}</span>
                        <span><i class="fas fa-tag"></i> ${escapeTemplateText(t.category || '--')}</span>
                    </span>
                </button>`;
        }).join('');
        container.innerHTML = `
            <div class="meta-template-table">
                <div class="meta-template-row meta-template-head" aria-hidden="true">
                    <span>Nombre de la plantilla</span>
                    <span>Categoria</span>
                    <span>Idioma</span>
                    <span>Estado</span>
                    <span>Ultima modificacion</span>
                </div>
                ${rows}
            </div>`;
    }

    // ── Tabs ──────────────────────────────────────────────────────────────
    function switchMetaTab(tab) {
        const myView     = document.getElementById('view-my-templates');
        const detailView = document.getElementById('view-template-detail');
        const tabBtn     = document.getElementById('tab-my-templates');
        const backBtn    = document.getElementById('tpl-detail-back-header');
        const subtitle   = document.getElementById('meta-templates-subtitle');

        if (tab === 'my') {
            if (myView)     { myView.style.display = 'grid'; }
            if (detailView) { detailView.style.display = 'none'; }
            if (tabBtn)     { tabBtn.classList.add('active'); }
            if (backBtn)    { backBtn.style.display = 'none'; }
            if (subtitle)   { subtitle.innerText = 'Selecciona una plantilla para preparar el reenvio.'; }
            loadTemplates();
        } else if (tab === 'detail') {
            if (myView)     { myView.style.display = 'none'; }
            if (detailView) { detailView.style.display = 'flex'; }
            if (tabBtn)     { tabBtn.classList.remove('active'); }
            if (backBtn)    { backBtn.style.display = 'inline-flex'; }
            if (subtitle)   { subtitle.innerText = 'Configura filtros y prepara el envio.'; }
        }
    }

    // ── Detalle de plantilla ──────────────────────────────────────────────
    function showTemplateDetail(idOrName, language) {
        const template = _availableTemplates.find(t =>
            (t.id === idOrName || t.name === idOrName) && (!language || t.language === language)
        );
        if (!template) return;
        _currentTemplate = template;
        switchMetaTab('detail');

        document.getElementById('detail-tpl-name').innerText = template.name;
        document.getElementById('detail-tpl-lang-badge').innerHTML = `<i class="fas fa-globe"></i> ${template.language.toUpperCase()}`;
        document.getElementById('detail-tpl-cat-badge').innerHTML  = `<i class="fas fa-tag"></i> ${template.category}`;

        const statusEl = document.getElementById('detail-tpl-status');
        statusEl.className = `meta-card-tag ${template.status === 'APPROVED' ? 'meta-status-approved' : (template.status === 'REJECTED' ? 'meta-status-rejected' : 'meta-status-pending')}`;
        statusEl.innerText = template.status;

        const editBtn = document.getElementById('btn-edit-in-meta');
        if (editBtn && _metaConfig.waba_id) {
            editBtn.href         = `https://business.facebook.com/latest/whatsapp_manager/message_templates?asset_id=${_metaConfig.waba_id}&edit_template=${template.name}`;
            editBtn.style.display = 'flex';
        } else if (editBtn) {
            editBtn.style.display = 'none';
        }

        // Preview
        let bodyText = 'Sin contenido';
        let headerText = '';
        let footerText = '';
        if (template.components && Array.isArray(template.components)) {
            const bodyComp   = template.components.find(c => c.type === 'BODY' || c.type?.toUpperCase() === 'BODY');
            if (bodyComp)   bodyText   = bodyComp.text   || bodyComp.content   || bodyComp.example?.body_text?.[0]?.[0]   || bodyText;
            const headerComp = template.components.find(c => c.type === 'HEADER' || c.type?.toUpperCase() === 'HEADER');
            if (headerComp) headerText = headerComp.text || headerComp.example?.header_text?.[0] || '';
            const footerComp = template.components.find(c => c.type === 'FOOTER' || c.type?.toUpperCase() === 'FOOTER');
            if (footerComp) footerText = footerComp.text || '';
        } else if (template.body) {
            bodyText = template.body;
        }

        const previewEl = document.getElementById('wa-preview-text-final');
        if (previewEl) {
            const bubble = previewEl.closest('.wa-preview-bubble');
            if (bubble) bubble.querySelectorAll('.wa-preview-btns-container-integrated').forEach(e => e.remove());

            let html = '';
            const headerComp = template.components?.find(c => c.type === 'HEADER');
            if (headerComp && headerComp.format && headerComp.format !== 'TEXT') {
                const fmt = headerComp.format.toLowerCase();
                if (fmt === 'image') {
                    const imgUrl = headerComp.example?.header_handle?.[0] || '';
                    if (imgUrl) html += `<img src="${escapeTemplateText(imgUrl)}" class="wa-preview-media wa-preview-media-image" alt="Vista previa de plantilla">`;
                } else if (fmt === 'video') {
                    html += `<div class="wa-preview-media wa-preview-media-video"><i class="fas fa-play-circle fa-3x"></i></div>`;
                } else if (fmt === 'document') {
                    html += `<div class="wa-preview-media wa-preview-media-document"><i class="fas fa-file-pdf"></i> <span>Documento</span></div>`;
                }
            }
            if (headerText) html += `<div class="wa-preview-header-text">${escapeTemplateText(headerText)}</div>`;
            html += `<div class="wa-preview-body-text">${escapeTemplateText(bodyText)}</div>`;
            if (footerText) html += `<div class="wa-preview-footer-text">${escapeTemplateText(footerText)}</div>`;
            previewEl.innerHTML = html;
            previewEl.querySelectorAll('img').forEach(img => img.addEventListener('load', scheduleTemplatePreviewFit));

            const buttonsComp = template.components?.find(c => c.type === 'BUTTONS');
            if (buttonsComp?.buttons && bubble) {
                const btnsContainer = document.createElement('div');
                btnsContainer.className = 'wa-preview-btns-container-integrated';
                buttonsComp.buttons.forEach(b => {
                    const btn = document.createElement('div');
                    btn.className = 'wa-preview-btn-item';
                    let icon = '<i class="fas fa-reply"></i>';
                    if (b.type === 'URL')          icon = '<i class="fas fa-external-link-alt"></i>';
                    if (b.type === 'PHONE_NUMBER') icon = '<i class="fas fa-phone"></i>';
                    btn.innerHTML = `${icon} ${escapeTemplateText(b.text)}`;
                    btnsContainer.appendChild(btn);
                });
                bubble.appendChild(btnsContainer);
            }
            scheduleTemplatePreviewFit();
        }

        const bulkSection = document.getElementById('bulk-actions-section');
        if (bulkSection) bulkSection.style.display = template.status === 'APPROVED' ? 'block' : 'none';

        // Detectar si la plantilla tiene variables
        let hasVariables = false;
        if (template.components && Array.isArray(template.components)) {
            hasVariables = template.components.some(c => {
                if (c.type === 'HEADER') {
                    if (c.format === 'TEXT') {
                        const text = c.text || c.content || '';
                        return /\{\{\w+\}\}/.test(text);
                    }
                    return false;
                }
                if (c.type === 'BODY') {
                    const text = c.text || c.content || '';
                    const hasPlaceholders = /\{\{\w+\}\}/.test(text);
                    if (hasPlaceholders) return true;
                    if (template.parameter_format === 'named' && c.example?.body_text_named_params?.length > 0) {
                        return true;
                    }
                }
                if (c.type === 'BUTTONS' && Array.isArray(c.buttons)) {
                    return c.buttons.some(b => b.type === 'URL' && b.url && b.url.includes('{{'));
                }
                return false;
            });
        }

        const quickSendContainer = document.getElementById('quick-send-container');
        if (quickSendContainer) {
            quickSendContainer.style.display = (!hasVariables && template.status === 'APPROVED') ? 'flex' : 'none';
        }

        const progressEl  = document.getElementById('bulk-progress');
        const fileInput   = document.getElementById('bulk-file-input');
        if (progressEl) progressEl.style.display = 'none';
        if (fileInput)  fileInput.value = '';
        scheduleTemplatePreviewFit();
    }

    // ── Descarga Excel ────────────────────────────────────────────────────
    function downloadBulkExcel() {
        if (!_currentTemplate) return;
        const params = new URLSearchParams({ token: _token });
        if (window.railwayProjectId) params.set('projectId', window.railwayProjectId);
        if (window.railwayServiceId) params.set('serviceId', window.railwayServiceId);
        const start  = document.getElementById('bulk-filter-start')?.value;
        const end    = document.getElementById('bulk-filter-end')?.value;
        if (start) params.set('startDate', start);
        if (end) params.set('endDate', end);
        if (_selectedTagIds.size > 0) params.set('tagIds', [..._selectedTagIds].join(','));
        const url = `/api/backoffice/whatsapp/template-excel/${encodeURIComponent(_currentTemplate.name)}?${params.toString()}`;
        window.open(url, '_blank');
    }

    // ── Envio masivo ──────────────────────────────────────────────────────
    async function startBulkSend() {
        if (!_currentTemplate) return;
        const fileInput   = document.getElementById('bulk-file-input');
        const btn         = document.getElementById('send-bulk-btn');
        const progressDiv = document.getElementById('bulk-progress');
        const progressBar = document.getElementById('bulk-progress-bar');
        const statusText  = document.getElementById('bulk-status-text');

        if (!fileInput.files.length) {
            showToast('⚠️ Suba un archivo Excel para iniciar', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('templateName', _currentTemplate.name);
        formData.append('languageCode', _currentTemplate.language || 'es');
        if (window.railwayProjectId) formData.append('projectId', window.railwayProjectId);
        if (window.railwayServiceId) formData.append('serviceId', window.railwayServiceId);

        btn.disabled        = true;
        btn.innerHTML       = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
        progressDiv.style.display = 'block';
        progressBar.style.width   = '0%';
        statusText.innerText      = 'Subiendo y procesando...';

        try {
            const params = new URLSearchParams({ token: _token });
            if (window.railwayProjectId) params.set('projectId', window.railwayProjectId);
            if (window.railwayServiceId) params.set('serviceId', window.railwayServiceId);
            const res = await fetch(`/api/backoffice/whatsapp/send-bulk-template?${params.toString()}`, {
                method: 'POST',
                body: formData
            });
            if (res.status === 202) {
                statusText.innerText       = '✅ Proceso iniciado en segundo plano.';
                progressBar.style.width    = '100%';
                progressBar.style.background = '#10b981';
                showToast('🚀 Envío masivo iniciado correctamente');
                setTimeout(() => {
                    switchMetaTab('my');
                    btn.disabled   = false;
                    btn.innerHTML  = '<i class="fas fa-paper-plane"></i> Enviar';
                    progressDiv.style.display = 'none';
                    fileInput.value = '';
                }, 2000);
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Error al iniciar envío');
            }
        } catch (e) {
            statusText.innerText          = '❌ ' + e.message;
            progressBar.style.background  = '#ef4444';
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reintentar';
        }
    }

    // ── Envio masivo rápido (sin Excel) ───────────────────────────────────
    async function startQuickBulkSend() {
        if (!_currentTemplate) return;
        
        // Confirmar envío
        if (!await window.swalConfirm('¿Iniciar envío rápido?', `¿Iniciar envío rápido de la plantilla "${_currentTemplate.name}" a los contactos filtrados?`)) {
            return;
        }

        const btn         = document.getElementById('quick-send-btn');
        const progressDiv = document.getElementById('bulk-progress');
        const progressBar = document.getElementById('bulk-progress-bar');
        const statusText  = document.getElementById('bulk-status-text');

        const startDate = document.getElementById('bulk-filter-start')?.value || '';
        const endDate   = document.getElementById('bulk-filter-end')?.value || '';
        const tagIds    = [..._selectedTagIds];

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
        }
        if (progressDiv) progressDiv.style.display = 'block';
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.style.background = 'var(--accent-color, #0099FF)';
        }
        if (statusText) statusText.innerText = 'Consultando contactos y procesando envío...';

        try {
            const params = new URLSearchParams({ token: _token });
            if (window.railwayProjectId) params.set('projectId', window.railwayProjectId);
            if (window.railwayServiceId) params.set('serviceId', window.railwayServiceId);
            const res = await fetch(`/api/backoffice/whatsapp/send-quick-template?${params.toString()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: _currentTemplate.name,
                    languageCode: _currentTemplate.language || 'es',
                    startDate,
                    endDate,
                    tagIds,
                    projectId: window.railwayProjectId || '',
                    serviceId: window.railwayServiceId || ''
                })
            });

            const data = await res.json();

            if (res.status === 202 && data.success) {
                if (statusText) statusText.innerText = `✅ Envío rápido iniciado para ${data.total} contactos.`;
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.style.background = '#10b981';
                }
                showToast(`🚀 Envío rápido iniciado para ${data.total} contactos`);
                setTimeout(() => {
                    switchMetaTab('my');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-bolt"></i> Envío Rápido';
                    }
                    if (progressDiv) progressDiv.style.display = 'none';
                }, 3000);
            } else {
                throw new Error(data.error || 'Error al iniciar envío rápido');
            }
        } catch (e) {
            console.error('[Quick Bulk] Error:', e);
            if (statusText) statusText.innerText = '❌ ' + e.message;
            if (progressBar) progressBar.style.background = '#ef4444';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt"></i> Reintentar Envío Rápido';
            }
        }
    }

    // ── Preview modal (mobile/tablet) ─────────────────────────────────────
    function showTplPreviewModal() {
        const src = document.querySelector('.tpl-preview-col');
        if (!src) return;
        const existing = document.getElementById('tpl-preview-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'tpl-preview-modal';
        modal.className = 'tpl-preview-modal-overlay';
        modal.onclick = () => modal.remove();
        modal.innerHTML = `
            <div class="tpl-preview-modal-content" onclick="event.stopPropagation()">
                <button class="tpl-preview-modal-close" onclick="document.getElementById('tpl-preview-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
                ${src.innerHTML}
            </div>`;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('active'));
    }

    // ── Onboarding (estado no-conectado) ─────────────────────────────────
    function launchMetaOnboardingView() {
        // Abrir popup ANTES del fetch para preservar el gesto del usuario
        const w = 600, h = 800;
        const left = (window.screen.width / 2) - (w / 2);
        const top  = (window.screen.height / 2) - (h / 2);
        const popup = window.open('about:blank', 'MetaOnboarding',
            `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,status=no,menubar=no`);

        if (!popup) {
            showToast('⚠️ El navegador bloqueó la ventana emergente. Permitila e intenta de nuevo.', 'error');
            return;
        }

        const statusEl = document.getElementById('meta-onboard-status');
        if (statusEl) statusEl.style.display = 'block';

        const sId = (typeof window !== 'undefined' && window.railwayServiceId) ? window.railwayServiceId : '';
        const pId = (typeof window !== 'undefined' && window.railwayProjectId) ? window.railwayProjectId : '';
        fetch(`/api/backoffice/whatsapp/config?token=${_token}&serviceId=${sId}&projectId=${pId}`)
            .then(res => res.json())
            .then(data => {
                if (!data.appId) {
                    popup.close();
                    if (statusEl) statusEl.style.display = 'none';
                    showToast('⚠️ Faltan credenciales de Meta en el servidor', 'error');
                    return;
                }
                const origin = window.location.origin;
                const url = new URL('https://duskcodes.com.ar/meta-auth');
                url.searchParams.append('railwayProjectId', data.railwayProjectId);
                url.searchParams.append('RAILWAY_PROJECT_ID', data.railwayProjectId);
                url.searchParams.append('projectId', data.railwayProjectId);
                url.searchParams.append('metaAppId', data.appId);
                url.searchParams.append('metaAppSecret', data.appSecret);
                if (data.configId) url.searchParams.append('configId', data.configId);
                url.searchParams.append('projectUrl', origin);
                url.searchParams.append('redirectUri', `${origin}/api/backoffice/whatsapp/onboard-callback?serviceId=${sId}`);
                url.searchParams.append('state', `${data.railwayProjectId}:${sId}`);
                url.searchParams.append('serviceId', sId);
                url.searchParams.append('railwayServiceId', sId);

                popup.location.href = url.toString();

                if (_popupCheckInterval) clearInterval(_popupCheckInterval);
                _popupCheckInterval = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(_popupCheckInterval);
                        _popupCheckInterval = null;
                        if (statusEl) statusEl.style.display = 'none';
                        const btn = document.getElementById('meta-onboard-btn');
                        if (btn) {
                            btn.innerHTML = '<i class="fas fa-rotate"></i> Sincronizar y guardar';
                            btn.onclick = syncAndSaveConnection;
                        }
                    }
                }, 1000);
            })
            .catch(() => {
                popup.close();
                if (statusEl) statusEl.style.display = 'none';
                showToast('❌ Error al obtener configuracion', 'error');
            });
    }

    async function syncAndSaveConnection() {
        const btn = document.getElementById('meta-onboard-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sincronizando...';
        }
        try {
            const res = await fetch('/api/backoffice/whatsapp/sync-ids?token=' + _token, { method: 'POST' });
            const data = await res.json();
            if (!data.success) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-rotate"></i> Sincronizar y guardar';
                }
                showToast('Hubo un problema interno con las credenciales de vinculacion. Soporte sera notificado de este ticket.', 'error');
                return;
            }
            if (data.already) {
                showToast('Credenciales verificadas correctamente.', 'success');
            } else {
                showToast('Credenciales sincronizadas y guardadas correctamente.', 'success');
            }
        } catch (_) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-rotate"></i> Sincronizar y guardar';
            }
            showToast('Hubo un problema interno con las credenciales de vinculacion. Soporte sera notificado de este ticket.', 'error');
            return;
        }
        try {
            await checkMetaConnection(false);
        } catch (_) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-rotate"></i> Sincronizar y guardar';
            }
            showToast('Hubo un problema interno con las credenciales de vinculacion. Soporte sera notificado de este ticket.', 'error');
        }
    }

    // ── Acordion del panel ────────────────────────────────────────────────
    function toggleMetaAccordion() {
        const panel = document.querySelector('.meta-view-panel');
        if (panel) panel.classList.toggle('collapsed');
    }

    return {
        title: 'Meta - ' + (window.BOT_NAME || 'Backoffice'),
        getHTML,
        init,
        destroy
    };
})();
