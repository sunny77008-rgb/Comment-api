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

// Body parsing - LARGE for unlimited comments
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const server = http.createServer(app);

// Socket.IO optimized for speed
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 10e6, // 10MB for large batches
    perMessageDeflate: false // Speed over compression
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


// ==================== YOUTUBE API ROTATION ====================
const YOUTUBE_API_KEYS = [
    process.env.YOUTUBE_API_KEY_1,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
    process.env.YOUTUBE_API_KEY_4,
    process.env.YOUTUBE_API_KEY_5
].filter(key => key && key.length > 0);

let currentKeyIndex = 0;
let keyFailCounts = new Array(YOUTUBE_API_KEYS.length).fill(0);
const MAX_FAILS_PER_KEY = 3;

function getCurrentYouTubeKey() {
    if (YOUTUBE_API_KEYS.length === 0) return null;
    return YOUTUBE_API_KEYS[currentKeyIndex];
}

function rotateYouTubeKey() {
    if (YOUTUBE_API_KEYS.length <= 1) return false;
    keyFailCounts[currentKeyIndex]++;
    const startIndex = currentKeyIndex;
    do {
        currentKeyIndex = (currentKeyIndex + 1) % YOUTUBE_API_KEYS.length;
        if (keyFailCounts[currentKeyIndex] < MAX_FAILS_PER_KEY) {
            console.log("Switched to YouTube API Key " + (currentKeyIndex + 1) + "/" + YOUTUBE_API_KEYS.length);
            return true;
        }
    } while (currentKeyIndex !== startIndex);
    console.log("All YouTube API keys exhausted, resetting counters...");
    keyFailCounts = new Array(YOUTUBE_API_KEYS.length).fill(0);
    currentKeyIndex = 0;
    return true;
}

function resetKeyFailCount() {
    keyFailCounts[currentKeyIndex] = 0;
}

// ==================== GAME STATE ====================
let isRoundActive = false;
let isCommentWindowOpen = false; // NEW: Track if window is open
let currentComments = new Map(); // countryCode -> Set of usernames
let roundStartTime = null;
let commentWindowMs = 30000; // Default 30 sec, but can be any value

// Stats
let totalCommentsReceived = 0;
let commentsRejected = 0;

function getCountryCode(text) {
    if (!text) return null;
    const clean = text.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    return countryMap[clean] || null;
}

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.emit('state', {
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        roundStartTime: roundStartTime,
        commentWindowMs: commentWindowMs,
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        currentComments: Array.from(currentComments.entries()).map(([code, users]) => ({
            countryCode: code,
            userCount: users.size,
            usernames: Array.from(users).slice(0, 5) // Send first 5 only to save bandwidth
        }))
    });

    socket.on('startRound', (data) => {
        isRoundActive = true;
        isCommentWindowOpen = true; // OPEN WINDOW
        roundStartTime = Date.now();
        currentComments.clear();
        totalCommentsReceived = 0;
        commentsRejected = 0;

        // Custom timer if provided (in seconds)
        if (data && data.timerSeconds) {
            commentWindowMs = data.timerSeconds * 1000;
        } else {
            commentWindowMs = 30000; // Default 30 sec
        }

        console.log('🎮 Round started at:', new Date().toISOString());
        console.log('⏰ Timer set to:', commentWindowMs / 1000, 'seconds');

        io.emit('roundStarted', { 
            startTime: roundStartTime, 
            windowMs: commentWindowMs,
            isCommentWindowOpen: true
        });

        // Auto-close after timer
        setTimeout(() => {
            if (isRoundActive && isCommentWindowOpen) {
                closeCommentWindow();
            }
        }, commentWindowMs);
    });

    socket.on('closeComments', () => {
        // Manual close
        closeCommentWindow();
    });

    socket.on('gameOver', () => {
        isRoundActive = false;
        isCommentWindowOpen = false;
        console.log('🏆 Game over');
        console.log('📊 Total comments:', totalCommentsReceived);
        console.log('📊 Total countries:', currentComments.size);
        io.emit('roundEnded', { 
            reason: 'gameOver',
            totalComments: totalCommentsReceived,
            totalCountries: currentComments.size
        });
    });

    socket.on('resetRound', () => {
        isRoundActive = false;
        isCommentWindowOpen = false;
        currentComments.clear();
        totalCommentsReceived = 0;
        commentsRejected = 0;
        console.log('🔄 Round reset');
        io.emit('roundReset');
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

function closeCommentWindow() {
    if (!isCommentWindowOpen) return;

    isCommentWindowOpen = false;
    console.log('🔒 Comment window CLOSED');
    console.log('📊 Total joined:', totalCommentsReceived, 'countries:', currentComments.size);

    io.emit('commentWindowClosed', {
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        countries: Array.from(currentComments.keys())
    });
}


// ==================== YOUTUBE POLLING ====================
let youtubePollingInterval = null;
let activeLiveChatId = null;

function startYouTubePolling(liveChatId) {
    if (youtubePollingInterval) clearInterval(youtubePollingInterval);
    activeLiveChatId = liveChatId;

    if (!getCurrentYouTubeKey()) {
        console.log("No YouTube API keys configured");
        return false;
    }

    console.log("Starting YouTube polling for: " + liveChatId);
    let nextPageToken = "";

    youtubePollingInterval = setInterval(async () => {
        try {
            const key = getCurrentYouTubeKey();
            if (!key) return;

            const url = "https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=" + activeLiveChatId + "&part=snippet,authorDetails&pageToken=" + nextPageToken + "&key=" + key;

            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                if (data.error.code === 403 || data.error.code === 429) {
                    console.log("YouTube API quota exceeded, rotating key...");
                    rotateYouTubeKey();
                }
                return;
            }

            resetKeyFailCount();

            if (data.items && data.items.length > 0) {
                nextPageToken = data.nextPageToken || "";

                data.items.forEach(item => {
                    const username = item.authorDetails?.displayName || "Anonymous";
                    const message = item.snippet?.displayMessage || "";

                    // Process same as regular comment
                    processYouTubeComment(username, message);
                });
            }
        } catch (err) {
            console.error("YouTube polling error:", err.message);
        }
    }, 5000);

    return true;
}

function stopYouTubePolling() {
    if (youtubePollingInterval) {
        clearInterval(youtubePollingInterval);
        youtubePollingInterval = null;
        activeLiveChatId = null;
        console.log("YouTube polling stopped");
    }
}

function processYouTubeComment(username, message) {
    if (!isCommentWindowOpen || !username || !message) return;

    const countryCode = getCountryCode(message);
    if (!countryCode) return;

    if (!currentComments.has(countryCode)) {
        currentComments.set(countryCode, new Set());
    }

    const users = currentComments.get(countryCode);
    if (users.has(username)) return;

    users.add(username);
    totalCommentsReceived++;

    io.emit("newComment", {
        countryCode: countryCode,
        username: username,
        message: message,
        timestamp: Date.now(),
        source: "youtube",
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size
    });
}

// ==================== FAST API ENDPOINTS ====================

// Single comment - ULTRA FAST
app.post('/api/comment', async (req, res) => {
    const startTime = Date.now();

    try {
        const { username, message } = req.body;

        // ULTRA FAST validation (no checks that slow down)
        if (!username || !message || !isCommentWindowOpen) {
            commentsRejected++;
            return res.json({ 
                success: false, 
                error: isCommentWindowOpen ? 'Missing data' : 'Comment window closed',
                processingTimeMs: Date.now() - startTime
            });
        }

        // FAST country lookup
        const countryCode = getCountryCode(message);

        if (!countryCode) {
            commentsRejected++;
            return res.json({ 
                success: false, 
                error: 'Invalid country',
                processingTimeMs: Date.now() - startTime
            });
        }

        // FAST add (no rate limiting for unlimited)
        if (!currentComments.has(countryCode)) {
            currentComments.set(countryCode, new Set());
        }

        const users = currentComments.get(countryCode);

        // Allow same country, different username
        if (users.has(username)) {
            return res.json({ 
                success: false, 
                error: 'Duplicate user',
                processingTimeMs: Date.now() - startTime
            });
        }

        users.add(username);
        totalCommentsReceived++;

        // IMMEDIATE broadcast (no delay)
        io.emit('newComment', {
            countryCode: countryCode,
            username: username,
            message: message,
            timestamp: Date.now(),
            totalComments: totalCommentsReceived,
            totalCountries: currentComments.size
        });

        // ULTRA FAST response (< 5ms target)
        res.json({ 
            success: true, 
            country: countryCode,
            username: username,
            totalComments: totalCommentsReceived,
            totalCountries: currentComments.size,
            processingTimeMs: Date.now() - startTime
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error',
            processingTimeMs: Date.now() - startTime
        });
    }
});

// MEGA BATCH - For extreme speed (up to 1000 comments at once)
app.post('/api/batch', async (req, res) => {
    const startTime = Date.now();

    if (!isCommentWindowOpen) {
        return res.json({ 
            success: false, 
            error: 'Comment window closed',
            processed: 0 
        });
    }

    const { comments } = req.body;

    if (!Array.isArray(comments)) {
        return res.status(400).json({ success: false, error: 'Invalid array' });
    }

    let accepted = 0;
    let rejected = 0;
    const broadcastList = [];

    // Process in chunks for speed
    const CHUNK_SIZE = 100;

    for (let i = 0; i < Math.min(comments.length, 1000); i += CHUNK_SIZE) {
        const chunk = comments.slice(i, i + CHUNK_SIZE);

        for (const comment of chunk) {
            const { username, message } = comment;

            if (!username || !message) {
                rejected++;
                continue;
            }

            const countryCode = getCountryCode(message);

            if (!countryCode) {
                rejected++;
                continue;
            }

            if (!currentComments.has(countryCode)) {
                currentComments.set(countryCode, new Set());
            }

            const users = currentComments.get(countryCode);

            if (users.has(username)) {
                rejected++;
                continue;
            }

            users.add(username);
            accepted++;
            totalCommentsReceived++;

            broadcastList.push({
                countryCode,
                username,
                message,
                timestamp: Date.now()
            });
        }
    }

    // Batch broadcast (single emit for all)
    if (broadcastList.length > 0) {
        io.emit('newCommentsBatch', {
            comments: broadcastList,
            totalComments: totalCommentsReceived,
            totalCountries: currentComments.size
        });
    }

    res.json({
        success: true,
        accepted,
        rejected,
        total: comments.length,
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        processingTimeMs: Date.now() - startTime
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        timestamp: Date.now(),
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        connections: io.engine.clientsCount,
        uptime: process.uptime()
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const stats = {
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        roundStartTime: roundStartTime,
        elapsedTime: isRoundActive ? Date.now() - roundStartTime : 0,
        totalComments: totalCommentsReceived,
        commentsRejected: commentsRejected,
        totalCountries: currentComments.size,
        countries: Array.from(currentComments.entries()).map(([code, users]) => ({
            code,
            name: getCountryName(code),
            userCount: users.size
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

    res.json({ total: countries.length, countries });
});

// Admin endpoints
app.post('/admin/start', (req, res) => {
    const { timerSeconds } = req.body;

    isRoundActive = true;
    isCommentWindowOpen = true;
    roundStartTime = Date.now();
    currentComments.clear();
    totalCommentsReceived = 0;
    commentsRejected = 0;

    // Set custom timer or default 30 sec
    commentWindowMs = timerSeconds ? timerSeconds * 1000 : 30000;

    io.emit('roundStarted', { 
        startTime: roundStartTime, 
        windowMs: commentWindowMs,
        isCommentWindowOpen: true
    });

    // Auto-close
    setTimeout(() => {
        if (isRoundActive && isCommentWindowOpen) {
            closeCommentWindow();
        }
    }, commentWindowMs);

    res.json({ 
        success: true, 
        message: 'Round started',
        timerSeconds: commentWindowMs / 1000,
        timerMs: commentWindowMs
    });
});

app.post('/admin/close', (req, res) => {
    closeCommentWindow();
    res.json({ 
        success: true, 
        message: 'Comment window closed',
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size
    });
});

app.post('/admin/reset', (req, res) => {
    isRoundActive = false;
    isCommentWindowOpen = false;
    currentComments.clear();
    totalCommentsReceived = 0;
    commentsRejected = 0;
    io.emit('roundReset');
    res.json({ success: true, message: 'Game reset' });
});

// Helper
function getCountryName(code) {
    const entry = Object.entries(countryMap).find(([name, c]) => c === code);
    return entry ? entry[0].charAt(0).toUpperCase() + entry[0].slice(1) : code;
}


// ==================== YOUTUBE ENDPOINTS ====================
app.post("/youtube/start", async (req, res) => {
    const { liveChatId, videoId } = req.body;
    if (!liveChatId && !videoId) return res.status(400).json({ error: "Need liveChatId or videoId" });

    let chatId = liveChatId;
    if (videoId && !chatId) {
        try {
            const key = getCurrentYouTubeKey();
            if (!key) return res.status(500).json({ error: "No API keys configured" });

            const url = "https://www.googleapis.com/youtube/v3/videos?id=" + videoId + "&part=liveStreamingDetails&key=" + key;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                if (data.error.code === 403 || data.error.code === 429) {
                    rotateYouTubeKey();
                    return res.status(429).json({ error: "Quota exceeded, key rotated" });
                }
                return res.status(400).json({ error: data.error.message });
            }

            if (data.items?.[0]?.liveStreamingDetails?.activeLiveChatId) {
                chatId = data.items[0].liveStreamingDetails.activeLiveChatId;
            } else {
                return res.status(404).json({ error: "No active live chat found" });
            }
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    const started = startYouTubePolling(chatId);
    if (started) res.json({ success: true, message: "YouTube polling started" });
    else res.status(500).json({ error: "Failed to start polling" });
});

app.post("/youtube/stop", (req, res) => {
    stopYouTubePolling();
    res.json({ success: true, message: "Polling stopped" });
});

app.get("/youtube/status", (req, res) => {
    res.json({
        active: !!youtubePollingInterval,
        liveChatId: activeLiveChatId,
        currentKeyIndex: currentKeyIndex + 1,
        totalKeys: YOUTUBE_API_KEYS.length
    });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('🚀 195 Flags Battle Server - UNLIMITED EDITION');
    console.log('📡 Port:', PORT);
    console.log('⏰ Started at:', new Date().toISOString());
    console.log('');
    console.log('✨ FEATURES:');
    console.log('   ✓ Unlimited countries per round');
    console.log('   ✓ Unlimited comments (no rate limit)');
    console.log('   ✓ Custom timer (30 sec to hours)');
    console.log('   ✓ Ultra-fast processing (< 5ms)');
    console.log('   ✓ Real-time broadcast');
    console.log('   ✓ Auto-close on timer end');
    console.log('');
    console.log('🔥 Endpoints:');
    console.log('  POST /api/comment      - Single comment (ultra fast)');
    console.log('  POST /api/batch        - Batch up to 1000 comments');
    console.log('  POST /admin/start      - Start with custom timer');
    console.log('  POST /admin/close      - Manual close');
    console.log('  GET  /stats            - Real-time stats');
    console.log('');
    console.log('📊 Example: 30 sec round');
    console.log('   POST /admin/start {"timerSeconds": 30}');
    console.log('');
    console.log('📊 Example: 5 hour round');
    console.log('   POST /admin/start {"timerSeconds": 18000}');
});

module.exports = { app, server, io };
