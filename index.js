const { Client, MessageEmbed } = require('discord.js-selfbot-v13');
const axios = require('axios');
require('dotenv').config();

// Importar dashboard
const dashboard = require('./server');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('🚀 Iniciando script do Scanner...');
if (!DISCORD_TOKEN) {
    console.error('❌ ERRO CRÍTICO: DISCORD_TOKEN não encontrado nas variáveis de ambiente!');
    console.log('⚠️  DICA: No painel do Render, vá em Settings -> Environment Variables e adicione o DISCORD_TOKEN.');
} else {
    console.log('✅ Token encontrado, tentando logar no Discord...');
}

const client = new Client();

// Debug de conexão do Discord
client.on('debug', info => {
    if (info.includes('Gateway')) {
        console.log('📡 [Discord Gateway]:', info);
    }
});

client.on('error', err => console.error('❌ Erro no Cliente Discord:', err));
client.on('warn', msg => console.warn('⚠️ Alerta Discord:', msg));

// Cache de usuários verificados
const checkedUsers = new Set();
let isScanning = false;
let totalScanned = 0;
let totalFound = 0;

// Listas específicas para detecção Xbox
const XBOX_GAMERTAG_PATTERNS = [
    /xbox/i,
    /xbl/i,
    /xbox.*live/i,
    /live.*xbox/i,
    /gamertag.*xbox/i,
    /xbox.*gamertag/i,
    /gt.*xbox/i,
    /xbox.*gt/i,
    /\[xbox\]/i,
    /\[xbl\]/i,
    /\(xbox\)/i,
    /\(xbl\)/i,
    /xbox\s*\.\s*com/i,
    /xbox\s*gamer/i,
    /microsoft\s*gamer/i,
    /xbox\s*club/i,
    /xbox\s*pass/i,
    /xbox\s*game\s*pass/i
];

const XBOX_GAMES = [
    'Xbox Live',
    'Xbox App',
    'Xbox Game Pass',
    'Xbox Cloud Gaming',
    'Xbox Console Companion',
    'Xbox Game Bar',
    'Xbox Network'
];

const GAMERTAG_FORMATS = [
    /^[A-Za-z0-9]{1,15}$/, // Gamertag básica
    /^[A-Za-z0-9 ]{1,15}$/, // Com espaço
    /^[A-Za-z0-9]{1,12}[0-9]{1,3}$/, // Números no final
];

client.on('ready', async () => {
    // console.clear(); // Remover clear para não apagar logs na nuvem
    console.log('='.repeat(60));
    console.log('🎮 XBOX SCANNER INICIALIZADO 🎮');
    console.log('='.repeat(60));
    console.log(`✅ Bot conectado como: ${client.user.tag}`);
    console.log(`🏠 Servidores disponíveis: ${client.guilds.cache.size}`);
    console.log('='.repeat(60));
    console.log('🌐 Conectado ao Dashboard');
    console.log('='.repeat(60));
    console.log('🌐 Dashboard disponível em: http://localhost:3000');
    console.log('💡 Use o dashboard para controlar o scanner');
    console.log('='.repeat(60));

    // Atualizar dashboard com lista de servidores
    const servers = client.guilds.cache.map(guild => ({
        name: guild.name,
        memberCount: guild.memberCount
    }));
    dashboard.setServers(servers);
});

// Escutar eventos de controle do dashboard
dashboard.scannerEvents.on('scan-control', async (data) => {
    console.log('🎮 Evento de controle recebido:', data);
    if (data.action === 'toggle') {
        if (!isScanning) {
            // Iniciar scan
            console.log('\n🌐 Scan iniciado via dashboard!');
            startXboxScan();
        } else {
            console.log('\n⚠️ Scan já está em andamento!');
        }
    }
});


async function startXboxScan() {
    if (isScanning) {
        console.log('⚠️  Scan já está em andamento!');
        return;
    }

    console.log('\n🎮 INICIANDO SCAN POR GAMERTAGS XBOX...');
    console.log('='.repeat(50));
    console.log('🔍 Buscando usuários com Xbox:');
    console.log('='.repeat(50));

    isScanning = true;
    totalScanned = 0;
    totalFound = 0;

    // Atualizar dashboard
    dashboard.setScanningStatus(true);

    scanAllGuilds().then(() => {
        isScanning = false;
        dashboard.setScanningStatus(false);
        console.log('\n✅ Scan completo!');
    }).catch(error => {
        console.error('❌ Erro durante o scan:', error.message);
        isScanning = false;
        dashboard.setScanningStatus(false);
    });
}

async function scanAllGuilds() {
    const guilds = client.guilds.cache;
    const guildCount = guilds.size;

    console.log(`\n🔍 Escaneando ${guildCount} servidores...`);

    for (const [guildId, guild] of guilds) {
        try {
            dashboard.setCurrentServer(guild.name);
            const result = await scanGuild(guild);
            console.log(`📊 ${guild.name}: ${result.scanned} membros, ${result.found} gamertags`);
        } catch (error) {
            console.error(`❌ Erro em ${guild.name}:`, error.message);
        }
    }

    dashboard.setCurrentServer(null);

    console.log('\n' + '='.repeat(40));
    console.log('🎮 SCAN COMPLETO!');
    console.log(`👥 Total escaneado: ${totalScanned} usuários`);
    console.log(`✅ Gamertags encontradas: ${totalFound}`);
    console.log('='.repeat(40));
}

async function scanGuild(guild) {
    let scanned = 0;
    let found = 0;

    try {
        await guild.members.fetch();

        for (const [memberId, member] of guild.members.cache) {
            if (member.user.bot) continue;

            scanned++;
            totalScanned++;

            // Verificar cache
            if (checkedUsers.has(memberId)) {
                continue;
            }

            // Verificar se tem sinais de gamertag Xbox
            const xboxInfo = await checkForXboxGamertag(member);

            if (xboxInfo && xboxInfo.confidence === 'HIGH') {
                found++;
                totalFound++;

                checkedUsers.add(memberId);

                await sendGamertagInfo(member, guild, xboxInfo);

                // Atualizar dashboard com novo usuário Xbox
                const accountAge = Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365));
                dashboard.addXboxUser({
                    username: member.user.username,
                    gamertag: xboxInfo.gamertag,
                    avatar: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
                    server: guild.name,
                    detectionType: xboxInfo.type,
                    accountAge: accountAge,
                    status: member.presence?.status || 'offline'
                });

                // Pausa para evitar rate limit
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Feedback a cada 50 membros
            if (scanned % 50 === 0) {
                console.log(`   📈 ${guild.name}: ${scanned} membros...`);
                dashboard.updateProgress(totalScanned);
            }
        }

        return { scanned, found };

    } catch (error) {
        console.error(`Erro ao escanear ${guild.name}:`, error.message);
        return { scanned: 0, found: 0 };
    }
}

async function checkForXboxGamertag(member) {
    const user = member.user;
    const username = user.username;
    const displayName = member.displayName;

    // Verificar ambos: username e display name
    const namesToCheck = [username];
    if (displayName && displayName !== username) {
        namesToCheck.push(displayName);
    }

    for (const name of namesToCheck) {
        // 1. Verificar padrões específicos de Xbox
        for (const pattern of XBOX_GAMERTAG_PATTERNS) {
            if (pattern.test(name)) {
                return {
                    gamertag: name,
                    confidence: 'HIGH',
                    type: 'xbox_keyword',
                    keyword: name.match(pattern)[0],
                    source: 'username'
                };
            }
        }

        // 2. Verificar formato de gamertag com prefixos/sufixos
        const gamertagMatch = extractGamertagFromName(name);
        if (gamertagMatch) {
            return {
                gamertag: gamertagMatch.gamertag,
                confidence: 'HIGH',
                type: gamertagMatch.type,
                prefix: gamertagMatch.prefix,
                source: 'username'
            };
        }

        // 3. Verificar formato de gamertag limpa (3-15 caracteres alfanuméricos)
        const cleanName = name.replace(/[^A-Za-z0-9]/g, '');
        if (cleanName.length >= 3 && cleanName.length <= 15) {
            // Verificar se parece uma gamertag (não apenas um nome comum)
            if (looksLikeGamertag(cleanName)) {
                // Verificar outros sinais para aumentar confiança
                const hasOtherSigns = await hasGamingIndicators(member);

                if (hasOtherSigns) {
                    return {
                        gamertag: cleanName,
                        confidence: 'HIGH',
                        type: 'clean_gamertag',
                        source: 'username'
                    };
                }
            }
        }
    }

    // 4. Verificar atividades (presence) de jogos Xbox
    const xboxActivity = checkXboxActivities(member);
    if (xboxActivity) {
        return {
            gamertag: username,
            confidence: 'HIGH',
            type: 'xbox_activity',
            activity: xboxActivity,
            source: 'activity'
        };
    }

    // 5. Verificar se o usuário tem características de gamer hardcore
    const isHardcoreGamer = await checkHardcoreGamer(member);
    if (isHardcoreGamer) {
        return {
            gamertag: username,
            confidence: 'MEDIUM',
            type: 'hardcore_gamer',
            details: isHardcoreGamer.details,
            source: 'multiple_indicators'
        };
    }

    return null;
}

function extractGamertagFromName(name) {
    // Padrões comuns de gamertags em nomes
    const patterns = [
        // GT: Gamertag
        /^(?:gt|gamertag)[:\s]+([A-Za-z0-9_]{3,15})$/i,
        // [GT] Gamertag
        /^\[(?:gt|gamertag)\]\s*([A-Za-z0-9_]{3,15})$/i,
        // (GT) Gamertag
        /^\((?:gt|gamertag)\)\s*([A-Za-z0-9_]{3,15})$/i,
        // Gamertag | GT
        /^([A-Za-z0-9_]{3,15})\s*[|\-]\s*(?:gt|gamertag)$/i,
        // Xbox: Gamertag
        /^xbox[:\s]+([A-Za-z0-9_]{3,15})$/i,
        // XBL: Gamertag
        /^xbl[:\s]+([A-Za-z0-9_]{3,15})$/i,
        // Gamertag (Xbox)
        /^([A-Za-z0-9_]{3,15})\s*\((?:xbox|xbl)\)$/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = name.match(patterns[i]);
        if (match) {
            return {
                gamertag: match[1],
                type: 'formatted_gamertag',
                prefix: patterns[i].toString().substring(0, 30)
            };
        }
    }

    return null;
}

function looksLikeGamertag(text) {
    // Gamertags geralmente não são palavras comuns
    const commonWords = [
        'admin', 'mod', 'owner', 'user', 'test', 'hello', 'world',
        'discord', 'server', 'bot', 'system', 'null', 'undefined'
    ];

    if (commonWords.includes(text.toLowerCase())) {
        return false;
    }

    // Verificar se tem padrão de gamertag
    // Muitos números, números no final, etc.
    const hasManyNumbers = (text.match(/\d/g) || []).length >= 2;
    const endsWithNumbers = /\d{2,}$/.test(text);
    const hasUnderscores = text.includes('_');
    const hasXxPattern = /x+/i.test(text);

    // Gamertags frequentemente têm essas características
    return hasManyNumbers || endsWithNumbers || hasUnderscores || hasXxPattern;
}

async function hasGamingIndicators(member) {
    const user = member.user;

    // 1. Verificar conta antiga (mais provável ser gamer)
    const accountAge = Date.now() - user.createdAt.getTime();
    const accountAgeInYears = accountAge / (1000 * 60 * 60 * 24 * 365);

    if (accountAgeInYears < 1) {
        return false; // Conta muito nova
    }

    // 2. Verificar avatar animado (usuários premium são mais ativos)
    const hasAnimatedAvatar = user.avatar && user.avatar.startsWith('a_');

    // 3. Verificar presença em jogos
    const hasGameActivity = member.presence &&
        member.presence.activities &&
        member.presence.activities.length > 0;

    // 4. Verificar discriminator baixo (usuários antigos)
    const isOldUser = user.discriminator !== '0' && parseInt(user.discriminator) < 5000;

    // Pelo menos 2 indicadores
    const indicators = [
        accountAgeInYears > 2,
        hasAnimatedAvatar,
        hasGameActivity,
        isOldUser
    ].filter(Boolean).length;

    return indicators >= 2;
}

function checkXboxActivities(member) {
    if (!member.presence || !member.presence.activities) {
        return null;
    }

    for (const activity of member.presence.activities) {
        // Verificar jogos específicos do Xbox
        if (XBOX_GAMES.some(game =>
            activity.name.toLowerCase().includes(game.toLowerCase())
        )) {
            return activity.name;
        }

        // Verificar se está "Jogando" (type = 0) qualquer jogo
        if (activity.type === 0) {
            // Jogos populares no Xbox
            const xboxPopularGames = [
                'minecraft', 'fortnite', 'call of duty', 'warzone',
                'halo', 'forza', 'gears of war', 'sea of thieves',
                'grand theft auto', 'gta', 'fifa', 'nba 2k', 'madden'
            ];

            if (xboxPopularGames.some(game =>
                activity.name.toLowerCase().includes(game)
            )) {
                return activity.name;
            }
        }
    }

    return null;
}

async function checkHardcoreGamer(member) {
    const user = member.user;
    const indicators = [];

    try {
        // 1. Conta muito antiga (> 5 anos)
        const accountAge = Date.now() - user.createdAt.getTime();
        const accountAgeInYears = accountAge / (1000 * 60 * 60 * 24 * 365);

        if (accountAgeInYears > 5) {
            indicators.push(`Conta antiga (${Math.floor(accountAgeInYears)} anos)`);
        }

        // 2. Avatar animado (Nitro)
        if (user.avatar && user.avatar.startsWith('a_')) {
            indicators.push('Avatar animado (Nitro)');
        }

        // 3. Tentar obter banner
        let hasBanner = false;
        try {
            const fetchedUser = await client.users.fetch(user.id, { force: true });
            if (fetchedUser.banner) {
                hasBanner = true;
                indicators.push('Banner personalizado');
            }
        } catch (e) {
            // Ignorar
        }

        // 4. Discriminator baixo ou personalizado
        if (user.discriminator === '0') {
            indicators.push('Nome personalizado');
        } else if (parseInt(user.discriminator) < 1000) {
            indicators.push('Discriminator baixo (usuário antigo)');
        }

        // 5. Verificar badges
        const badges = user.flags?.toArray() || [];
        if (badges.length > 0) {
            indicators.push(`Badges: ${badges.length}`);
        }

        // Se tiver pelo menos 3 indicadores fortes
        if (indicators.length >= 3) {
            return {
                details: indicators.join(', ')
            };
        }

    } catch (error) {
        // Ignorar erros
    }

    return null;
}

async function sendGamertagInfo(member, guild, xboxInfo) {
    const user = member.user;
    const username = user.username;
    const userId = user.id;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });

    // Informações da conta
    const createdAt = user.createdAt ? user.createdAt.toLocaleDateString('pt-BR') : 'Desconhecido';
    const accountAge = Date.now() - user.createdAt.getTime();
    const accountAgeInYears = Math.floor(accountAge / (1000 * 60 * 60 * 24 * 365));

    // Status
    const status = member.presence?.status || 'offline';
    const statusEmoji = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        offline: '⚫'
    }[status] || '⚫';

    console.log(`🎮 ${xboxInfo.gamertag} - ${xboxInfo.type}`);

    // Buscar mais informações
    let bannerURL = null;
    let badges = [];

    try {
        const fetchedUser = await client.users.fetch(userId, { force: true });

        if (fetchedUser.banner) {
            bannerURL = fetchedUser.bannerURL({ dynamic: true, size: 1024 });
        }

        badges = fetchedUser.flags?.toArray() || [];

    } catch (error) {
        // Ignorar erros
    }

    // Criar embed
    const embed = new MessageEmbed()
        .setColor('#107C10') // Verde Xbox
        .setTitle(`🎮 XBOX DETECTADA 🎮`)
        .setDescription(`**Usuário com possível conta Xbox**`)
        .addFields([
            {
                name: '👤 Nome de Usuário',
                value: `\`${username}\``,
                inline: true
            },
            {
                name: '🎮 Gamertag Detectada',
                value: `\`${xboxInfo.gamertag}\``,
                inline: true
            },
            {
                name: '🌐 Servidor',
                value: `\`${guild.name}\``,
                inline: true
            },
            {
                name: `${statusEmoji} Status`,
                value: `\`${status}\``,
                inline: true
            },
            {
                name: '📅 Conta Criada',
                value: `\`${createdAt}\` (\`${accountAgeInYears} anos\`)`,
                inline: true
            },
            {
                name: '👥 Membros no Servidor',
                value: `\`${guild.memberCount}\``,
                inline: true
            }
        ])
        .setThumbnail(avatarURL)
        .setTimestamp()
        .setFooter(`ID: ${userId} | XBOX Scanner`);

    // Adicionar banner
    if (bannerURL) {
        embed.setImage(bannerURL);
    }

    // Adicionar informações da detecção
    embed.addField(
        '🔍 Tipo de Detecção',
        `\`${xboxInfo.type}\`\nConfiança: \`${xboxInfo.confidence}\``,
        true
    );

    if (xboxInfo.keyword) {
        embed.addField(
            '🔤 Palavra-chave',
            `\`${xboxInfo.keyword}\``,
            true
        );
    }

    if (xboxInfo.activity) {
        embed.addField(
            '🎯 Atividade Atual',
            `\`${xboxInfo.activity}\``,
            true
        );
    }

    // Adicionar badges se houver
    if (badges.length > 0) {
        const badgeNames = badges.map(badge => {
            const badgeMap = {
                'VERIFIED_DEVELOPER': 'Dev Verificado',
                'EARLY_VERIFIED_BOT_DEVELOPER': 'Dev Bot Antigo',
                'DISCORD_CERTIFIED_MODERATOR': 'Moderador Certificado',
                'STAFF': 'Staff Discord',
                'PARTNERED_SERVER_OWNER': 'Parceiro',
                'PREMIUM_EARLY_SUPPORTER': 'Early Supporter',
                'ACTIVE_DEVELOPER': 'Dev Ativo'
            };
            return badgeMap[badge] || badge;
        }).join(', ');

        embed.addField(
            '🏅 Badges',
            `\`${badgeNames}\``,
            false
        );
    }

    // Adicionar estatísticas
    embed.addField(
        '📊 Estatísticas do Scan',
        `Total escaneado: \`${totalScanned}\`\n` +
        `Gamertags encontradas: \`${totalFound}\``,
        false
    );

    const data = {
        content: `🎮 **XBOX DETECTADA: \`${xboxInfo.gamertag}\`** 🎮`,
        embeds: [embed],
    };

    try {
        await axios.post(WEBHOOK_URL, data);
        console.log(`     ✅ Webhook enviado: ${xboxInfo.gamertag}`);
    } catch (error) {
        console.error(`     ❌ Erro no webhook: ${error.message}`);
    }
}


// Iniciar o cliente
client.login(DISCORD_TOKEN).catch(err => {
    console.error('❌ ERRO CRÍTICO AO LOGAR NO DISCORD:', err.message);
    console.log('💡 DICA: Verifique se o DISCORD_TOKEN está correto nas variáveis de ambiente do Render/Railway.');
});

// Tratar CTRL+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando scanner...');
    process.exit(0);
});
