const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store: username -> countryCode (1 username = 1 country)
const userCountryMap = new Map();

// Track comment window status
let isCommentWindowOpen = false;
let commentWindowTimeout = null;
const COMMENT_WINDOW_DURATION = 30000; // 30 seconds

// Country name to code mapping
const countryNameToCode = {
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
    "ukraine": "ua", "uae": "ae", "uk": "gb", "usa": "us",
    "uruguay": "uy", "uzbekistan": "uz", "vanuatu": "vu", "vatican": "va",
    "venezuela": "ve", "vietnam": "vn", "yemen": "ye", "zambia": "zm",
    "zimbabwe": "zw"
};

function getCountryCode(countryName) {
    const normalized = countryName.toLowerCase().trim();
    return countryNameToCode[normalized] || null;
}

function generateUsername() {
    const adjectives = ['Cool', 'Super', 'Mega', 'Ultra', 'Pro', 'Master', 'King', 'Queen'];
    const nouns = ['Gamer', 'Player', 'Warrior', 'Ninja', 'Hero', 'Legend', 'Star', 'Boss'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}${noun}${num}`;
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('startRound', () => {
        console.log('Round started');
        isCommentWindowOpen = true;
        userCountryMap.clear(); // Clear previous round data

        // Broadcast to all clients
        io.emit('roundStarted');

        // Close comment window after 30 seconds
        if (commentWindowTimeout) clearTimeout(commentWindowTimeout);
        commentWindowTimeout = setTimeout(() => {
            closeCommentWindow();
        }, COMMENT_WINDOW_DURATION);
    });

    socket.on('comment', (data) => {
        if (!isCommentWindowOpen) return;

        const countryName = data.comment || data.country || '';
        const username = data.username || generateUsername();

        const countryCode = getCountryCode(countryName);

        if (!countryCode) {
            socket.emit('error', { message: 'Invalid country name' });
            return;
        }

        // 🔥 KEY FIX: Check if username already has a country
        if (userCountryMap.has(username)) {
            console.log(`Username ${username} already has country, ignoring`);
            return; // Ignore - same username can't join multiple times
        }

        // Add to map: username -> countryCode
        userCountryMap.set(username, countryCode);

        console.log(`New join: ${username} -> ${countryCode}`);

        // Broadcast to all clients
        io.emit('newComment', {
            countryCode: countryCode,
            username: username,
            timestamp: Date.now()
        });
    });

    socket.on('gameOver', () => {
        console.log('Game over');
        isCommentWindowOpen = false;
        if (commentWindowTimeout) clearTimeout(commentWindowTimeout);
    });

    socket.on('resetRound', () => {
        console.log('Round reset');
        userCountryMap.clear();
        isCommentWindowOpen = false;
        if (commentWindowTimeout) clearTimeout(commentWindowTimeout);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

function closeCommentWindow() {
    if (!isCommentWindowOpen) return;

    console.log('Comment window closed');
    isCommentWindowOpen = false;

    io.emit('commentWindowClosed', {
        totalComments: userCountryMap.size
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
