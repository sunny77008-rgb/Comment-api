const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 10e6,
    perMessageDeflate: false
});

// Country mapping
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

// YouTube API Setup
const youtubeKeys = [
    process.env.YOUTUBE_API_KEY_1,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
    process.env.YOUTUBE_API_KEY_4,
    process.env.YOUTUBE_API_KEY_5
].filter(k => k);

let currentKeyIndex = 0;
let keyFailCount = new Array(youtubeKeys.length).fill(0);
let youtubeInterval = null;
let activeChatId = null;

function getCurrentKey() {
    return youtubeKeys[currentKeyIndex] || null;
}

function rotateKey() {
    if (youtubeKeys.length <= 1) return false;
    keyFailCount[currentKeyIndex]++;
    currentKeyIndex = (currentKeyIndex + 1) % youtubeKeys.length;
    console.log("Rotated to API key " + (currentKeyIndex + 1));
    return true;
}

// Game State
let isRoundActive = false;
let isCommentWindowOpen = false;
let currentComments = new Map();
let roundStartTime = null;
let commentWindowMs = 30000;
let totalCommentsReceived = 0;
let commentsRejected = 0;

function getCountryCode(text) {
    if (!text) return null;
    const clean = text.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    return countryMap[clean] || null;
}

function processYouTubeComment(username, message) {
    if (!isCommentWindowOpen || !username || !message) return;
    const countryCode = getCountryCode(message);
    if (!countryCode) return;
    if (!currentComments.has(countryCode)) currentComments.set(countryCode, new Set());
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

function startYouTubePolling(liveChatId) {
    if (youtubeInterval) clearInterval(youtubeInterval);
    activeChatId = liveChatId;
    if (!getCurrentKey()) {
        console.error("No YouTube API keys configured");
        return false;
    }
    console.log("Starting YouTube polling for: " + liveChatId);
    let nextPageToken = "";
    youtubeInterval = setInterval(async () => {
        try {
            const key = getCurrentKey();
            if (!key) return;
            const url = "https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=" + activeChatId + "&part=snippet,authorDetails&pageToken=" + nextPageToken + "&key=" + key;
            const res = await fetch(url);
            const data = await res.json();
            if (data.error) {
                if (data.error.code === 403 || data.error.code === 429) {
                    console.log("Quota exceeded, rotating...");
                    rotateKey();
                }
                return;
            }
            if (data.items) {
                nextPageToken = data.nextPageToken || "";
                data.items.forEach(item => {
                    const user = item.authorDetails?.displayName || "Anonymous";
                    const msg = item.snippet?.displayMessage || "";
                    processYouTubeComment(user, msg);
                });
            }
        } catch (err) {
            console.error("YouTube error:", err.message);
        }
    }, 5000);
    return true;
}

function stopYouTubePolling() {
    if (youtubeInterval) {
        clearInterval(youtubeInterval);
        youtubeInterval = null;
        activeChatId = null;
    }
}

function closeCommentWindow() {
    if (!isCommentWindowOpen) return;
    isCommentWindowOpen = false;
    console.log("Comment window closed. Total: " + totalCommentsReceived);
    io.emit("commentWindowClosed", {
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        countries: Array.from(currentComments.keys())
    });
}

// Socket.IO
io.on("connection", (socket) => {
    console.log("Client connected: " + socket.id);

    socket.emit("state", {
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        roundStartTime: roundStartTime,
        commentWindowMs: commentWindowMs,
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size
    });

    socket.on("startRound", (data) => {
        isRoundActive = true;
        isCommentWindowOpen = true;
        roundStartTime = Date.now();
        currentComments.clear();
        totalCommentsReceived = 0;
        commentsRejected = 0;
        commentWindowMs = data?.timerSeconds ? data.timerSeconds * 1000 : 30000;

        console.log("Round started, timer: " + commentWindowMs + "ms");
        io.emit("roundStarted", { 
            startTime: roundStartTime, 
            windowMs: commentWindowMs,
            isCommentWindowOpen: true
        });

        setTimeout(() => {
            if (isRoundActive && isCommentWindowOpen) closeCommentWindow();
        }, commentWindowMs);
    });

    socket.on("gameOver", () => {
        isRoundActive = false;
        isCommentWindowOpen = false;
        io.emit("roundEnded", { reason: "gameOver" });
    });

    socket.on("resetRound", () => {
        isRoundActive = false;
        isCommentWindowOpen = false;
        currentComments.clear();
        totalCommentsReceived = 0;
        io.emit("roundReset");
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected: " + socket.id);
    });
});

// API Endpoints
app.post("/api/comment", async (req, res) => {
    const startTime = Date.now();
    try {
        const { username, message } = req.body;
        if (!username || !message || !isCommentWindowOpen) {
            return res.json({ success: false, error: "Invalid" });
        }
        const countryCode = getCountryCode(message);
        if (!countryCode) return res.json({ success: false, error: "Invalid country" });

        if (!currentComments.has(countryCode)) currentComments.set(countryCode, new Set());
        const users = currentComments.get(countryCode);
        if (users.has(username)) return res.json({ success: false, error: "Duplicate" });

        users.add(username);
        totalCommentsReceived++;

        io.emit("newComment", {
            countryCode: countryCode,
            username: username,
            message: message,
            timestamp: Date.now(),
            totalComments: totalCommentsReceived,
            totalCountries: currentComments.size
        });

        res.json({ success: true, country: countryCode });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/youtube/start", async (req, res) => {
    const { liveChatId, videoId } = req.body;
    if (!liveChatId && !videoId) return res.status(400).json({ error: "Need liveChatId or videoId" });

    let chatId = liveChatId;
    if (videoId && !chatId) {
        try {
            const key = getCurrentKey();
            if (!key) return res.status(500).json({ error: "No API keys" });
            const url = "https://www.googleapis.com/youtube/v3/videos?id=" + videoId + "&part=liveStreamingDetails&key=" + key;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) return res.status(400).json({ error: data.error.message });
            if (data.items?.[0]?.liveStreamingDetails?.activeLiveChatId) {
                chatId = data.items[0].liveStreamingDetails.activeLiveChatId;
            } else {
                return res.status(404).json({ error: "No active chat" });
            }
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    const started = startYouTubePolling(chatId);
    if (started) res.json({ success: true, message: "YouTube polling started" });
    else res.status(500).json({ error: "Failed to start" });
});

app.post("/youtube/stop", (req, res) => {
    stopYouTubePolling();
    res.json({ success: true });
});

app.get("/youtube/status", (req, res) => {
    res.json({
        active: !!youtubeInterval,
        currentKey: currentKeyIndex + 1,
        totalKeys: youtubeKeys.length
    });
});

app.get("/", (req, res) => {
    res.json({
        status: "running",
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        totalComments: totalCommentsReceived,
        connections: io.engine.clientsCount
    });
});

app.get("/stats", (req, res) => {
    res.json({
        roundActive: isRoundActive,
        isCommentWindowOpen: isCommentWindowOpen,
        totalComments: totalCommentsReceived,
        totalCountries: currentComments.size,
        connections: io.engine.clientsCount
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
    console.log("YouTube keys configured: " + youtubeKeys.length);
});
