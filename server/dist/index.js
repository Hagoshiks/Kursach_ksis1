"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cards_1 = require("./utils/cards");
const auth_1 = __importDefault(require("./routes/auth"));
const game_1 = __importDefault(require("./game"));
const config_1 = require("./config/config");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Auth middleware
const authenticateToken = (req, res, next) => {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
// Socket.io authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        socket.data.userId = decoded.id;
        next();
    }
    catch (error) {
        next(new Error('Authentication error'));
    }
});
// Routes
app.use('/api/auth', auth_1.default);
// Protected route example
app.get('/api/user/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});
const gameState = {
    players: [],
    communityCards: [],
    pot: 0,
    currentPlayer: 0,
    dealer: 0,
    smallBlind: 5,
    bigBlind: 10,
    currentBet: 0,
    phase: 'waiting',
    deck: [],
    minPlayers: 2,
    maxPlayers: 9
};
function startNewHand() {
    gameState.deck = (0, cards_1.shuffleDeck)((0, cards_1.createDeck)());
    gameState.communityCards = [];
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.phase = 'preflop';
    // Reset player states
    gameState.players.forEach(player => {
        player.cards = [];
        player.currentBet = 0;
        player.isActive = true;
    });
    // Deal cards
    const { playerCards, remainingDeck } = (0, cards_1.dealCards)(gameState.deck, gameState.players.length);
    gameState.deck = remainingDeck;
    gameState.players.forEach((player, index) => {
        player.cards = playerCards[index];
    });
    // Set blinds
    const dealerIndex = gameState.dealer;
    const smallBlindIndex = (dealerIndex + 1) % gameState.players.length;
    const bigBlindIndex = (dealerIndex + 2) % gameState.players.length;
    gameState.players[dealerIndex].isDealer = true;
    gameState.players[smallBlindIndex].isSmallBlind = true;
    gameState.players[bigBlindIndex].isBigBlind = true;
    // Post blinds
    gameState.players[smallBlindIndex].chips -= gameState.smallBlind;
    gameState.players[smallBlindIndex].currentBet = gameState.smallBlind;
    gameState.pot += gameState.smallBlind;
    gameState.players[bigBlindIndex].chips -= gameState.bigBlind;
    gameState.players[bigBlindIndex].currentBet = gameState.bigBlind;
    gameState.pot += gameState.bigBlind;
    gameState.currentBet = gameState.bigBlind;
    gameState.currentPlayer = (bigBlindIndex + 1) % gameState.players.length;
}
function nextPhase() {
    switch (gameState.phase) {
        case 'preflop':
            gameState.phase = 'flop';
            const { cards: flopCards, remainingDeck: flopDeck } = (0, cards_1.dealCommunityCards)(gameState.deck, 3);
            gameState.communityCards = flopCards;
            gameState.deck = flopDeck;
            break;
        case 'flop':
            gameState.phase = 'turn';
            const { cards: turnCard, remainingDeck: turnDeck } = (0, cards_1.dealCommunityCards)(gameState.deck, 1);
            gameState.communityCards.push(turnCard[0]);
            gameState.deck = turnDeck;
            break;
        case 'turn':
            gameState.phase = 'river';
            const { cards: riverCard, remainingDeck: riverDeck } = (0, cards_1.dealCommunityCards)(gameState.deck, 1);
            gameState.communityCards.push(riverCard[0]);
            gameState.deck = riverDeck;
            break;
        case 'river':
            gameState.phase = 'showdown';
            break;
        case 'showdown':
            gameState.phase = 'waiting';
            gameState.dealer = (gameState.dealer + 1) % gameState.players.length;
            break;
    }
    gameState.currentBet = 0;
    gameState.players.forEach(player => {
        player.currentBet = 0;
    });
}
const game = new game_1.default(io);
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('joinGame', (name) => {
        const success = game.joinGame(socket.id, name);
        if (!success) {
            socket.emit('error', 'Game is full');
        }
    });
    socket.on('placeBet', (amount) => {
        game.handlePlayerAction(socket.id, 'call', amount);
    });
    socket.on('raise', (amount) => {
        game.handlePlayerAction(socket.id, 'raise', amount);
    });
    socket.on('fold', () => {
        game.handlePlayerAction(socket.id, 'fold');
    });
    socket.on('voteToStart', () => {
        game.voteToStart(socket.id);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
// Start server
httpServer.listen(config_1.config.port, () => {
    console.log(`Server running on port ${config_1.config.port}`);
});
