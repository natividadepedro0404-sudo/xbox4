const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const cors = require('cors'); // Importar pacote CORS
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Permite qualquer origem para Socket.io
        methods: ['GET', 'POST']
    }
});

// Event emitter para comunicação interna
const scannerEvents = new EventEmitter();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Usar o middleware CORS padrão
app.use(express.json());

app.use(express.static(__dirname)); // Servir arquivos da raiz

// Estado global do scanner
let scannerState = {
    isScanning: false,
    totalScanned: 0,
    totalFound: 0,
    servers: [],
    xboxUsers: [],
    currentServer: null
};

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoints
app.get('/api/status', (req, res) => {
    res.json(scannerState);
});

app.get('/api/config', (req, res) => {
    res.json({
        token: process.env.DISCORD_TOKEN ? '***' + process.env.DISCORD_TOKEN.slice(-4) : 'Not set',
        webhook: process.env.WEBHOOK_URL ? '***' + process.env.WEBHOOK_URL.slice(-20) : 'Not set'
    });
});

app.post('/api/config', (req, res) => {
    const { token, webhook } = req.body;

    let envContent = '';

    if (fs.existsSync('.env')) {
        envContent = fs.readFileSync('.env', 'utf8');
    }

    if (token) {
        if (envContent.includes('DISCORD_TOKEN=')) {
            envContent = envContent.replace(/DISCORD_TOKEN=.*/g, `DISCORD_TOKEN=${token}`);
        } else {
            envContent += `\nDISCORD_TOKEN=${token}`;
        }
    }

    if (webhook) {
        if (envContent.includes('WEBHOOK_URL=')) {
            envContent = envContent.replace(/WEBHOOK_URL=.*/g, `WEBHOOK_URL=${webhook}`);
        } else {
            envContent += `\nWEBHOOK_URL=${webhook}`;
        }
    }

    fs.writeFileSync('.env', envContent.trim());

    res.json({ success: true, message: 'Configurações atualizadas! Reinicie o scanner para aplicar.' });
});

app.post('/api/scan/toggle', (req, res) => {
    console.log('📡 Recebido comando de scan via API');
    // Emitir evento interno para o scanner
    scannerEvents.emit('scan-control', { action: 'toggle' });
    res.json({ success: true, message: 'Comando enviado' });
});


// WebSocket connection
io.on('connection', (socket) => {
    console.log('Cliente conectado ao dashboard');

    // Enviar estado atual
    socket.emit('state-update', scannerState);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado do dashboard');
    });
});

// Funções para atualizar estado (serão chamadas pelo index.js)
function updateScannerState(newState) {
    scannerState = { ...scannerState, ...newState };
    io.emit('state-update', scannerState);
}

function addXboxUser(userInfo) {
    scannerState.xboxUsers.unshift(userInfo);
    scannerState.totalFound++;
    io.emit('state-update', scannerState);
}

function updateProgress(scanned) {
    scannerState.totalScanned = scanned;
    io.emit('state-update', scannerState);
}

function setServers(servers) {
    scannerState.servers = servers;
    io.emit('state-update', scannerState);
}

function setCurrentServer(serverName) {
    scannerState.currentServer = serverName;
    io.emit('state-update', scannerState);
}

function setScanningStatus(isScanning) {
    scannerState.isScanning = isScanning;
    io.emit('state-update', scannerState);
}

server.listen(PORT, () => {
    console.log(`\n🌐 Dashboard disponível em: http://localhost:${PORT}`);
});

// Exportar funções para uso no index.js
module.exports = {
    updateScannerState,
    addXboxUser,
    updateProgress,
    setServers,
    setCurrentServer,
    setScanningStatus,
    io,  // Exportar io para permitir escutar eventos
    scannerEvents  // Exportar event emitter para controle do scan
};
