/* global loadViewScript */
window.webchatView = {
    title: 'Webchat - ' + (window.BOT_NAME || 'Backoffice'),

    getHTML() {
        return `
        <div class="webchat-page flex flex-col flex-1 min-h-0" style="position:relative; z-index:10;">
            ${window.renderSectionTabs ? window.renderSectionTabs('messaging') : ''}
            <div class="webchat-workspace">
                <div id="container" class="webchat-container flex flex-col w-full flex-1 min-h-0">

                    <!-- Header del bot -->
                    <div id="header" class="flex items-center gap-4 px-5 py-4 flex-shrink-0 glass-strong rounded-none"
                        style="border-bottom:1px solid rgba(0,153,255,0.1);">
                        <button id="webchat-actions-open" class="webchat-actions-trigger" type="button">
                            <i class="fas fa-flask"></i>
                            <span>Acciones</span>
                        </button>
                        <img id="avatar"
                            src="https://img.freepik.com/vector-gratis/robot-vectorial-graident-ai_78370-4114.jpg?semt=ais_hybrid&w=740&q=80"
                            alt="Bot"
                            class="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-accent/30">
                        <div>
                            <div class="text-sm font-heading font-bold text-primary-content" id="assistantName">Asistente</div>
                            <div class="text-xs text-emerald-400 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot"></span>
                                en linea
                            </div>
                        </div>
                    </div>

                    <!-- Area de mensajes -->
                    <div id="chat"
                        class="flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-5"
                        style="background: rgba(5,10,20,0.4);">
                    </div>

                    <!-- Input -->
                    <div id="inputRow"
                        class="webchat-input-row flex items-end gap-3 px-4 py-3 flex-shrink-0 glass-strong rounded-none">
                        <div class="inputWrapper webchat-input-wrapper flex-1 flex items-end gap-2 rounded-2xl px-4 py-2">
                            <button id="attach"
                                class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-secondary-content
                                       bg-transparent border-0 cursor-pointer transition-colors hover:text-accent-bright text-lg"
                                title="Adjuntar archivo">
                                <i class="fas fa-paperclip text-sm"></i>
                                </button>
                            <textarea id="input"
                                placeholder="Escribe un mensaje..."
                                rows="1"
                                class="webchat-textarea flex-1 bg-transparent border-0 outline-none text-sm text-primary-content
                                       placeholder-white/30 py-1 leading-relaxed"></textarea>
                        </div>
                        <button id="send"
                            class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                                   text-white border-0 cursor-pointer transition-transform hover:scale-95"
                            title="Enviar"
                            style="background:linear-gradient(135deg,#0078D4,#0099FF);">
                            <i class="fas fa-paper-plane text-sm"></i>
                        </button>
                        <input type="file" id="fileInput" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx">
                    </div>
                </div>

                <aside class="webchat-command-panel">
                    <div class="webchat-command-head">
                        <div class="webchat-command-title">
                            <span class="webchat-command-icon"><i class="fas fa-flask"></i></span>
                            <div>
                                <span class="webchat-command-kicker">Modo prueba</span>
                                <h2>Webchat</h2>
                                <p>Ejecuta acciones aisladas sin tocar conversaciones reales.</p>
                            </div>
                        </div>
                    </div>
                    <div class="webchat-command-body">
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-rotate-left"></i></span>
                                <div>
                                    <h3>Reset</h3>
                                    <p>Vuelve al asistente principal y conserva esta prueba separada.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="RESET">
                                    <i class="fas fa-rotate-left"></i>
                                    Reset
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-broom"></i></span>
                                <div>
                                    <h3>Hilo nuevo</h3>
                                    <p>Borra el historial de esta sesion y arranca una prueba limpia.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="HILO_NUEVO">
                                    <i class="fas fa-broom"></i>
                                    Hilo nuevo
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-eraser"></i></span>
                                <div>
                                    <h3>Eliminar contexto</h3>
                                    <p>Borra los datos recordados del cliente (ID, dirección) de esta sesión.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="CLEAR_CONTEXT">
                                    <i class="fas fa-eraser"></i>
                                    Eliminar contexto
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-note">
                            <i class="fas fa-shield-halved"></i>
                            Estos comandos son exclusivos del webchat.
                        </div>
                    </div>
                </aside>
            </div>

            <div id="webchat-actions-modal" class="modal-overlay">
                <div class="modal-content modal-content-md animate-pop-in">
                    <div class="modal-header">
                        <h3><i class="fas fa-flask modal-h3-icon"></i> Webchat</h3>
                        <button class="modal-close" id="webchat-actions-close" type="button"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body webchat-actions-modal-body">
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-rotate-left"></i></span>
                                <div>
                                    <h3>Reset</h3>
                                    <p>Vuelve al asistente principal y conserva esta prueba separada.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="RESET">
                                    <i class="fas fa-rotate-left"></i>
                                    Reset
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-broom"></i></span>
                                <div>
                                    <h3>Hilo nuevo</h3>
                                    <p>Borra el historial de esta sesion y arranca una prueba limpia.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="HILO_NUEVO">
                                    <i class="fas fa-broom"></i>
                                    Hilo nuevo
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-card">
                            <div class="webchat-command-copy">
                                <span class="webchat-command-action-icon"><i class="fas fa-eraser"></i></span>
                                <div>
                                    <h3>Eliminar contexto</h3>
                                    <p>Borra los datos recordados del cliente (ID, dirección) de esta sesión.</p>
                                </div>
                            </div>
                            <div class="webchat-command-card-footer">
                                <button class="btn webchat-command-button" data-webchat-command="CLEAR_CONTEXT">
                                    <i class="fas fa-eraser"></i>
                                    Eliminar contexto
                                </button>
                            </div>
                        </div>
                        <div class="webchat-command-note">
                            <i class="fas fa-shield-halved"></i>
                            Estos comandos son exclusivos del webchat.
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    async init() {
        await loadViewScript('/js/webchat/webchat.js');
        if (typeof window.initWebchatView === 'function') window.initWebchatView();
    },

    destroy() {
        if (typeof window.destroyWebchatView === 'function') {
            window.destroyWebchatView();
        }
    }
};
