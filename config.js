// Configuração do backend
// Deixe em branco para detecção automática (recomendado para hospedagem unificada)
const CONFIG = {
    // Se estiver em branco, o dashboard tentará se conectar ao mesmo endereço que o serviu
    BACKEND_URL: window.location.hostname === '' || window.location.hostname === ''
        ? ''
        : window.location.origin,
};

