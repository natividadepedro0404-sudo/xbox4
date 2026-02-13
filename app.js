// Connect to WebSocket
console.log('Tentando conectar ao backend:', CONFIG.BACKEND_URL);
const socket = io(CONFIG.BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

let state = {
    isScanning: false,
    totalScanned: 0,
    totalFound: 0,
    servers: [],
    xboxUsers: [],
    currentServer: null
};

// Socket event listeners
socket.on('connect', () => {
    console.log('✅ Conectado ao servidor! ID:', socket.id);
    updateConnectionStatus(true);
});

socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão:', error.message);
    updateConnectionStatus(false);
});

socket.on('state-update', (newState) => {
    console.log('📦 Atualização de estado recebida:', newState);
    state = newState;
    updateUI();
});

// Update UI functions
function updateConnectionStatus(isConnected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (isConnected) {
        statusDot.classList.add('online');
        statusText.textContent = state.isScanning ? 'Escaneando...' : 'Conectado (Servidor)';
    } else {
        statusDot.classList.remove('online');
        statusText.textContent = 'Desconectado';
    }
}

// Fallback: Buscar status via API caso o socket falhe inicialmente
async function fetchInitialStatus() {
    try {
        console.log('🔄 Buscando status inicial via HTTP API...');
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/status`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Status inicial recebido:', data);
            state = data;
            updateUI();
        }
    } catch (error) {
        console.warn('⚠️ Falha ao buscar status inicial via API:', error.message);
    }
}

// Iniciar busca
fetchInitialStatus();

function updateUI() {
    updateStats();
    updateServersList();
    updateXboxUsersList();
    updateConnectionStatus(true);
}

function updateStats() {
    document.getElementById('totalScanned').textContent = state.totalScanned.toLocaleString();
    document.getElementById('totalFound').textContent = state.totalFound.toLocaleString();
    document.getElementById('totalServers').textContent = state.servers.length.toLocaleString();

    const detectionRate = state.totalScanned > 0
        ? ((state.totalFound / state.totalScanned) * 100).toFixed(2)
        : 0;
    document.getElementById('detectionRate').textContent = detectionRate + '%';
}

function updateServersList() {
    const serversList = document.getElementById('serversList');
    const serverCount = document.getElementById('serverCount');

    serverCount.textContent = state.servers.length;

    if (state.servers.length === 0) {
        serversList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>Nenhum servidor para escanear</p>
            </div>
        `;
        return;
    }

    serversList.innerHTML = state.servers.map(server => `
        <div class="server-item ${server.name === state.currentServer ? 'scanning' : ''}">
            <div class="server-name">
                ${server.name === state.currentServer ? '<span class="scanning-indicator"></span>' : ''}
                ${escapeHtml(server.name)}
            </div>
            <div class="server-stats">
                👥 ${server.memberCount ? server.memberCount.toLocaleString() : 'N/A'} membros
            </div>
        </div>
    `).join('');
}

function updateXboxUsersList() {
    const xboxUsersList = document.getElementById('xboxUsersList');
    const xboxCount = document.getElementById('xboxCount');

    xboxCount.textContent = state.xboxUsers.length;

    if (state.xboxUsers.length === 0) {
        xboxUsersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <p>Nenhum usuário Xbox encontrado ainda</p>
            </div>
        `;
        return;
    }

    xboxUsersList.innerHTML = state.xboxUsers.map(user => `
        <div class="xbox-user-card">
            <img src="${user.avatar}" alt="${escapeHtml(user.username)}" class="user-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.username)}</div>
                <div class="user-gamertag">🎮 ${escapeHtml(user.gamertag)}</div>
                <div class="user-details">
                    <div class="user-detail">
                        <span>🏠</span>
                        <span>${escapeHtml(user.server)}</span>
                    </div>
                    <div class="user-detail">
                        <span>🔍</span>
                        <span>${escapeHtml(user.detectionType)}</span>
                    </div>
                    <div class="user-detail">
                        <span>📅</span>
                        <span>${user.accountAge} anos</span>
                    </div>
                    ${user.status ? `
                        <div class="user-detail">
                            <span>${getStatusEmoji(user.status)}</span>
                            <span>${user.status}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusEmoji(status) {
    const emojis = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        offline: '⚫'
    };
    return emojis[status] || '⚫';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Scan control
async function toggleScan() {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/scan/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message || 'Erro ao controlar o scan');
        }
    } catch (error) {
        alert('Erro ao conectar com o servidor');
    }
}
