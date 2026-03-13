const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// CORS for all origins
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
}));

// Body parsing - INCREASED for 5 APIs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const server = http.createServer(app);

// Socket.IO optimized for 5 APIs
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 5e6, // 5MB for batch comments
    perMessageDeflate: false // Faster for high volume
});

// ==================== COUNTRY MAPPING ====================
const countryMap = {
    "afghanistan": "af", "albania": "al", "algeria": "dz", "andorra": "ad", 
    "angola": "ao", "antigua": "ag", "argentina": "ar", "armenia": "am", 
    "australia": "au", "austria": "at", "azerbaijan": "az", "bahamas": "bs", 
    "bahrain": "bh", "bangladesh": "bd", "barbados": "bb", "belarus": "by", 
    "belgium": "be", "belize": "bz", "benin": "bj", "bhutan": "bt", 
    "bolivia": "bo", "bosnia": "ba", "botswana": "bw", "brazil": "br", 
    "brunei": "bn", "bulgaria": "bg", "burkina": "bf", "burundi": "bi", 
    "cambodia": "kh", "cameroon": "cm", "canada": "ca", "cape verde": "cv", 
    "central african": "cf", "chad": "td", "chile": "cl", "china": "cn", 
    "colombia": "co", "comoros": "km", "congo": "cg", "costa rica": "cr", 
    "croatia": "hr", "cuba": "cu", "cyprus": "cy", "czechia": "cz", 
    "denmark": "dk", "djibouti": "dj", "dominica": "dm", "dominican": "do", 
    "ecuador": "ec", "egypt": "eg", "el salvador": "sv", "equatorial guinea": "gq", 
    "eritrea": "er", "estonia": "ee", "eswatini": "sz", "ethiopia": "et", 
    "fiji": "fj", "finland": "fi", "france": "fr", "gabon": "ga", 
    "gambia": "gm", "georgia": "ge", "germany": "de", "ghana": "gh", 
    "greece": "gr", "grenada": "gd", "guatemala": "gt", "guinea": "gn", 
    "guinea-bissau": "gw", "guyana": "gy", "haiti": "ht", "honduras": "hn", 
    "hungary": "hu", "iceland": "is", "india": "in", "indonesia": "id", 
    "iran": "ir", "iraq": "iq", "ireland": "ie", "israel": "il", 
    "italy": "it", "jamaica": "jm", "japan": "jp", "jordan": "jo", 
    "kazakhstan": "kz", "kenya": "ke", "kiribati": "ki", "north korea": "kp", 
    "south korea": "kr", "kuwait": "kw", "kyrgyzstan": "kg", "laos": "la", 
    "latvia": "lv", "lebanon": "lb", "lesotho": "ls", "liberia": "lr", 
    "libya": "ly", "liechtenstein": "li", "lithuania": "lt", "luxembourg": "lu", 
    "madagascar": "mg", "malawi": "mw", "malaysia": "my", "maldives": "mv", 
    "mali": "ml", "malta": "mt", "marshall": "mh", "mauritania": "mr", 
    "mauritius": "mu", "mexico": "mx", "micronesia": "fm", "moldova": "md", 
    "monaco": "mc", "mongolia": "mn", "montenegro": "me", "morocco": "ma", 
    "mozambique": "mz", "myanmar": "mm", "namibia": "na", "nauru": "nr", 
    "nepal": "np", "netherlands": "nl", "new zealand": "nz", "nicaragua": "ni", 
    "niger": "ne", "nigeria": "ng", "macedonia": "mk", "norway": "no", 
    "oman": "om", "pakistan": "pk", "palau": "pw", "panama": "pa", 
    "papua": "pg", "paraguay": "py", "peru": "pe", "philippines": "ph", 
    "poland": "pl", "portugal": "pt", "qatar": "qa", "romania": "ro", 
    "russia": "ru", "rwanda": "rw", "saint kitts": "kn", "saint lucia": "lc", 
    "saint vincent": "vc", "samoa": "ws", "san marino": "sm", "sao tome": "st", 
    "saudi arabia": "sa", "senegal": "sn", "serbia": "rs", "seychelles": "sc", 
    "sierra leone": "sl", "singapore": "sg", "slovakia": "sk", "slovenia": "si", 
    "solomon": "sb", "somalia": "so", "south africa": "za", "south sudan": "ss", 
    "spain": "es", "sri lanka": "lk", "sudan": "sd", "suriname": "sr", 
    "sweden": "se", "switzerland": "ch", "syria": "sy", "taiwan": "tw", 
    "tajikistan": "tj", "tanzania": "tz", "thailand": "th", "timor": "tl", 
    "togo": "tg", "tonga": "to", "trinidad": "tt", "tunisia": "tn", 
    "turkey": "tr", "turkmenistan": "tm", "tuvalu": "tv", "uganda": "ug", 
    "ukraine": "ua", "uae": "ae", "uk": "gb", "usa": "us", "america": "us",
    "uruguay": "uy", "uzbekistan": "uz", "vanuatu": "vu", "vatican": "va", 
    "venezuela": "ve", "vietnam": "vn", "yemen": "ye", "zambia": "zm", 
    "zimbabwe": "zw"
};

// ==================== 5 API CONFIGURATION ====================
const API_CONFIG = {
    api1: { name: 'YouTube', maxRequestsPerMin: 100, priority: 1 },
    api2: { name: 'TikTok', maxRequestsPerMin: 100, priority: 2 },
    api3: { name: 'Instagram', maxRequestsPerMin: 100, priority: 3 },
    api4: { name: 'Facebook', maxRequestsPerMin: 100, priority: 4 },
    api5: { name: 'Twitch', maxRequestsPerMin: 100, priority: 5 }
};

// ==================== GAME STATE ====================
let isRoundActive = false;
let currentComments = new Map(); // countryCode -> Set of usernames
let roundStartTime = null;
let commentWindowMs = 30000; // 30 seconds

// Rate limiting for 5 APIs
const apiRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// API stats tracking
const apiStats = new Map();

function getCountryCode(text) {
    if (!text) return null;
    const clean = text.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    return countryMap[clean] || null;
}

function checkRateLimit(apiId) {
    const config = API_CONFIG[apiId] || API_CONFIG.api1;
    const now = Date.now();

    if (!apiRateLimits.has(apiId)) {
        apiRateLimits.set(apiId, { 
            count: 1, 
            resetTime: now + RATE_LIMIT_WINDOW,
            totalToday: 1
        });
        return true;
    }

    const limit = apiRateLimits.get(apiId);

    // Reset if window passed
    if (now > limit.resetTime) {
        limit.count = 1;
        limit.resetTime = now + RATE_LIMIT_WINDOW;
        limit.totalToday++;
        return true;
    }

    // Check limit
    if (limit.count >= config.maxRequestsPerMin) {
        return false;
    }

    limit.count++;
    limit.totalToday++;
    return true;
}

function getApiStats() {
    const stats = {};
    for (const [apiId, config] of Object.entries(API_CONFIG)) {
        const limit = apiRateLimits.get(apiId);
        stats[apiId] = {
            name: config.name,
            currentMinute: limit ? limit.count : 0,
            maxPerMinute: config.maxRequestsPerMin,
            totalToday: limit ? limit.totalToday : 0,
            resetIn: limit ? Math.max(0, Math.ceil((limit.resetTime - Date.now()) / 1000)) : 0
        };
    }
    return stats;
}

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Send current state with API stats
    socket.emit('state', {
        roundActive: isRoundActive,
        roundStartTime: roundStartTime,
        commentWindowMs: commentWindowMs,
        apiStats: getApiStats(),
        currentComments: Array.from(currentComments.entries()).map(([code, users]) => ({
            countryCode: code,
            usernames: Array.from(users)
        }))
    });

    socket.on('startRound', () => {
        isRoundActive = true;
        roundStartTime = Date.now();
        currentComments.clear();
        apiRateLimits.clear();

        // Reset API stats
        for (const apiId of Object.keys(API_CONFIG)) {
            apiStats.set(apiId, { commentsReceived: 0, countriesJoined: new Set() });
        }

        console.log('🎮 Round started at:', new Date().toISOString());
        io.emit('roundStarted', { 
            startTime: roundStartTime, 
            windowMs: commentWindowMs,
            apiStats: getApiStats()
        });
    });

    socket.on('gameOver', () => {
        isRoundActive = false;
        console.log('🏆 Game over');
        console.log('📊 API Stats:', getApiStats());
        io.emit('roundEnded', { 
            reason: 'gameOver',
            finalStats: getApiStats()
        });
    });

    socket.on('resetRound', () => {
        isRoundActive = false;
        currentComments.clear();
        console.log('🔄 Round reset');
        io.emit('roundReset');
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// ==================== API ENDPOINTS FOR 5 APIs ====================

// Single comment endpoint - OPTIMIZED
app.post('/api/comment', async (req, res) => {
    const startTime = Date.now();

    try {
        const { username, message, apiKey, apiId = 'api1' } = req.body;

        // Validation
        if (!username || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing username or message',
                processingTimeMs: Date.now() - startTime
            });
        }

        // Check API config exists
        if (!API_CONFIG[apiId]) {
            return res.status(400).json({
                success: false,
                error: `Invalid apiId. Use: ${Object.keys(API_CONFIG).join(', ')}`,
                processingTimeMs: Date.now() - startTime
            });
        }

        // Check round active
        if (!isRoundActive) {
            return res.json({ 
                success: false, 
                error: 'No active round',
                apiId,
                processingTimeMs: Date.now() - startTime
            });
        }

        // Check time window
        if (roundStartTime && (Date.now() - roundStartTime > commentWindowMs)) {
            return res.json({ 
                success: false, 
                error: 'Comment window closed',
                apiId,
                processingTimeMs: Date.now() - startTime
            });
        }

        // Rate limiting per API
        if (!checkRateLimit(apiId)) {
            return res.status(429).json({ 
                success: false, 
                error: 'Rate limit exceeded for this API',
                apiId,
                apiName: API_CONFIG[apiId].name,
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
                processingTimeMs: Date.now() - startTime
            });
        }

        // Get country code
        const countryCode = getCountryCode(message);

        if (!countryCode) {
            return res.json({ 
                success: false, 
                error: 'Invalid country name',
                apiId,
                processingTimeMs: Date.now() - startTime
            });
        }

        // Add to current comments
        if (!currentComments.has(countryCode)) {
            currentComments.set(countryCode, new Set());
        }

        const users = currentComments.get(countryCode);

        // Check duplicate username for this country
        if (users.has(username)) {
            return res.json({ 
                success: false, 
                error: 'User already joined this country',
                apiId,
                processingTimeMs: Date.now() - startTime
            });
        }

        users.add(username);

        // Update API stats
        if (!apiStats.has(apiId)) {
            apiStats.set(apiId, { commentsReceived: 0, countriesJoined: new Set() });
        }
        const stats = apiStats.get(apiId);
        stats.commentsReceived++;
        stats.countriesJoined.add(countryCode);

        // Broadcast IMMEDIATELY
        const broadcastData = {
            countryCode: countryCode,
            username: username,
            message: message,
            timestamp: Date.now(),
            apiId: apiId,
            apiName: API_CONFIG[apiId].name,
            totalInCountry: users.size
        };

        io.emit('newComment', broadcastData);

        // Fast response
        res.json({ 
            success: true, 
            country: countryCode,
            countryName: getCountryName(countryCode),
            username: username,
            apiId: apiId,
            apiName: API_CONFIG[apiId].name,
            totalUsersInCountry: users.size,
            processingTimeMs: Date.now() - startTime
        });

    } catch (error) {
        console.error('Comment processing error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            processingTimeMs: Date.now() - startTime
        });
    }
});

// Batch endpoint for each API
app.post('/api/:apiId/comment', async (req, res) => {
    const { apiId } = req.params;
    const startTime = Date.now();

    // Validate API ID
    if (!API_CONFIG[apiId]) {
        return res.status(400).json({
            success: false,
            error: `Invalid API. Use: ${Object.keys(API_CONFIG).join(', ')}`
        });
    }

    const { username, message } = req.body;

    if (!username || !message) {
        return res.status(400).json({
            success: false,
            error: 'Missing username or message'
        });
    }

    // Forward to main handler with apiId
    req.body.apiId = apiId;

    // Reuse same logic
    try {
        if (!isRoundActive) {
            return res.json({ success: false, error: 'No active round', apiId });
        }

        if (roundStartTime && (Date.now() - roundStartTime > commentWindowMs)) {
            return res.json({ success: false, error: 'Comment window closed', apiId });
        }

        if (!checkRateLimit(apiId)) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                apiId,
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
            });
        }

        const countryCode = getCountryCode(message);

        if (!countryCode) {
            return res.json({ success: false, error: 'Invalid country', apiId });
        }

        if (!currentComments.has(countryCode)) {
            currentComments.set(countryCode, new Set());
        }

        const users = currentComments.get(countryCode);

        if (users.has(username)) {
            return res.json({ success: false, error: 'Duplicate user', apiId });
        }

        users.add(username);

        io.emit('newComment', {
            countryCode,
            username,
            message,
            timestamp: Date.now(),
            apiId,
            apiName: API_CONFIG[apiId].name
        });

        res.json({
            success: true,
            country: countryCode,
            username,
            apiId,
            processingTimeMs: Date.now() - startTime
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Batch comments for high volume
app.post('/api/:apiId/batch', async (req, res) => {
    const { apiId } = req.params;
    const startTime = Date.now();

    if (!API_CONFIG[apiId]) {
        return res.status(400).json({
            success: false,
            error: `Invalid API. Use: ${Object.keys(API_CONFIG).join(', ')}`
        });
    }

    const { comments } = req.body;

    if (!Array.isArray(comments) || comments.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid comments array'
        });
    }

    if (!isRoundActive) {
        return res.json({
            success: false,
            error: 'No active round',
            apiId,
            processed: 0
        });
    }

    const results = [];
    let accepted = 0;
    let rejected = 0;

    // Process batch quickly
    for (const comment of comments.slice(0, 50)) { // Max 50 per batch
        const { username, message } = comment;

        if (!username || !message) {
            rejected++;
            results.push({ username, success: false, error: 'Missing data' });
            continue;
        }

        const countryCode = getCountryCode(message);

        if (!countryCode) {
            rejected++;
            results.push({ username, success: false, error: 'Invalid country' });
            continue;
        }

        if (!currentComments.has(countryCode)) {
            currentComments.set(countryCode, new Set());
        }

        const users = currentComments.get(countryCode);

        if (users.has(username)) {
            rejected++;
            results.push({ username, success: false, error: 'Duplicate' });
            continue;
        }

        users.add(username);
        accepted++;

        io.emit('newComment', {
            countryCode,
            username,
            message,
            timestamp: Date.now(),
            apiId,
            apiName: API_CONFIG[apiId].name,
            batch: true
        });

        results.push({ username, success: true, countryCode });
    }

    res.json({
        success: true,
        apiId,
        accepted,
        rejected,
        total: comments.length,
        processingTimeMs: Date.now() - startTime,
        results
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        timestamp: Date.now(),
        roundActive: isRoundActive,
        connections: io.engine.clientsCount,
        uptime: process.uptime(),
        apis: Object.keys(API_CONFIG).length,
        apiStats: getApiStats()
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const stats = {
        roundActive: isRoundActive,
        roundStartTime: roundStartTime,
        elapsedTime: isRoundActive ? Date.now() - roundStartTime : 0,
        remainingTime: isRoundActive ? Math.max(0, commentWindowMs - (Date.now() - roundStartTime)) : 0,
        totalCountries: currentComments.size,
        totalComments: Array.from(currentComments.values()).reduce((sum, users) => sum + users.size, 0),
        apiStats: getApiStats(),
        countries: Array.from(currentComments.entries()).map(([code, users]) => ({
            code,
            name: getCountryName(code),
            userCount: users.size,
            users: Array.from(users).slice(0, 10) // Limit to 10 users in response
        })),
        connections: io.engine.clientsCount
    };

    res.json(stats);
});

// Get supported countries
app.get('/countries', (req, res) => {
    const countries = Object.entries(countryMap).map(([name, code]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        code,
        flag: `https://flagcdn.com/w40/${code}.png`
    }));

    res.json({
        total: countries.length,
        countries
    });
});

// Admin endpoints
app.post('/admin/start', (req, res) => {
    isRoundActive = true;
    roundStartTime = Date.now();
    currentComments.clear();

    for (const apiId of Object.keys(API_CONFIG)) {
        apiStats.set(apiId, { commentsReceived: 0, countriesJoined: new Set() });
    }

    io.emit('roundStarted', { 
        startTime: roundStartTime, 
        windowMs: commentWindowMs,
        apiStats: getApiStats()
    });

    res.json({ success: true, message: 'Round started', apiStats: getApiStats() });
});

app.post('/admin/reset', (req, res) => {
    isRoundActive = false;
    currentComments.clear();
    apiRateLimits.clear();
    io.emit('roundReset');
    res.json({ success: true, message: 'Game reset' });
});

// Helper function
function getCountryName(code) {
    const entry = Object.entries(countryMap).find(([name, c]) => c === code);
    return entry ? entry[0].charAt(0).toUpperCase() + entry[0].slice(1) : code;
}

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('🚀 195 Flags Battle Server - 5 API Edition');
    console.log('📡 Port:', PORT);
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('⏰ Started at:', new Date().toISOString());
    console.log('');
    console.log('📊 5 API Endpoints:');
    Object.entries(API_CONFIG).forEach(([id, config]) => {
        console.log(`  ${id}: ${config.name} (${config.maxRequestsPerMin} req/min)`);
    });
    console.log('');
    console.log('🔥 Quick Routes:');
    console.log('  POST /api/api1/comment  - YouTube comments');
    console.log('  POST /api/api2/comment  - TikTok comments');
    console.log('  POST /api/api3/comment  - Instagram comments');
    console.log('  POST /api/api4/comment  - Facebook comments');
    console.log('  POST /api/api5/comment  - Twitch comments');
    console.log('  POST /api/:apiId/batch  - Batch comments (50 max)');
    console.log('  GET  /stats             - Real-time stats');
});

module.exports = { app, server, io };
