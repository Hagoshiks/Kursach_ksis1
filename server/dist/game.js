"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handEvaluator_1 = require("./utils/handEvaluator");
class Game {
    constructor(io) {
        this.votes = new Set();
        this.io = io;
        this.state = {
            players: [],
            communityCards: [],
            pot: 0,
            currentPlayer: 0,
            dealer: 0,
            smallBlind: 0,
            bigBlind: 0,
            currentBet: 0,
            minimumRaise: 0,
            phase: 'waiting',
            lastAction: '',
            lastActionAmount: 0,
            deck: [],
            smallBlindAmount: 5,
            bigBlindAmount: 10,
            votes: []
        };
    }
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value });
            }
        }
        return this.shuffleDeck(deck);
    }
    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    dealCards() {
        this.state.deck = this.createDeck();
        this.state.players.forEach(player => {
            player.cards = [this.state.deck.pop(), this.state.deck.pop()];
        });
    }
    dealCommunityCards(count) {
        for (let i = 0; i < count; i++) {
            this.state.communityCards.push(this.state.deck.pop());
        }
    }
    moveToNextPhase() {
        switch (this.state.phase) {
            case 'preflop':
                this.state.phase = 'flop';
                this.dealCommunityCards(3);
                break;
            case 'flop':
                this.state.phase = 'turn';
                this.dealCommunityCards(1);
                break;
            case 'turn':
                this.state.phase = 'river';
                this.dealCommunityCards(1);
                break;
            case 'river':
                this.state.phase = 'showdown';
                this.determineWinner();
                break;
            default:
                break;
        }
        this.resetBettingRound();
    }
    resetBettingRound() {
        this.state.currentBet = 0;
        this.state.minimumRaise = this.state.bigBlindAmount;
        this.state.players.forEach(player => {
            player.currentBet = 0;
        });
    }
    moveToNextPlayer() {
        let nextPlayer = (this.state.currentPlayer + 1) % this.state.players.length;
        while (!this.state.players[nextPlayer].isActive) {
            nextPlayer = (nextPlayer + 1) % this.state.players.length;
        }
        this.state.currentPlayer = nextPlayer;
    }
    isBettingRoundComplete() {
        const activePlayers = this.state.players.filter(p => p.isActive);
        return activePlayers.every(player => player.currentBet === this.state.currentBet || player.chips === 0);
    }
    determineWinner() {
        const activePlayers = this.state.players.filter(p => p.isActive);
        if (activePlayers.length === 0)
            return;
        // Evaluate each player's hand
        const playerHands = activePlayers.map(player => ({
            player,
            hand: (0, handEvaluator_1.evaluateHand)(player.cards, this.state.communityCards)
        }));
        // Find the best hand
        const bestHand = playerHands.reduce((best, current) => {
            if (current.hand.rank > best.hand.rank)
                return current;
            if (current.hand.rank === best.hand.rank) {
                // Compare kickers
                for (let i = 0; i < current.hand.value.length; i++) {
                    if (current.hand.value[i] > best.hand.value[i])
                        return current;
                    if (current.hand.value[i] < best.hand.value[i])
                        return best;
                }
            }
            return best;
        });
        // Award pot to winner
        bestHand.player.chips += this.state.pot;
        // Broadcast results
        this.io.emit('showdown', {
            winner: bestHand.player.id,
            hand: bestHand.hand.name,
            players: playerHands.map(ph => ({
                id: ph.player.id,
                hand: ph.hand.name
            }))
        });
        // Reset for next hand
        this.state.phase = 'waiting';
        this.state.pot = 0;
        this.state.communityCards = [];
        this.state.players.forEach(player => {
            player.cards = [];
            player.currentBet = 0;
            player.isActive = true;
        });
    }
    startNewHand() {
        this.state.phase = 'preflop';
        this.state.communityCards = [];
        this.state.pot = 0;
        this.state.currentBet = 0;
        this.state.minimumRaise = this.state.bigBlindAmount;
        // Move dealer button
        this.state.dealer = (this.state.dealer + 1) % this.state.players.length;
        this.state.smallBlind = (this.state.dealer + 1) % this.state.players.length;
        this.state.bigBlind = (this.state.dealer + 2) % this.state.players.length;
        // Post blinds
        const smallBlindPlayer = this.state.players[this.state.smallBlind];
        const bigBlindPlayer = this.state.players[this.state.bigBlind];
        smallBlindPlayer.chips -= this.state.smallBlindAmount;
        smallBlindPlayer.currentBet = this.state.smallBlindAmount;
        this.state.pot += this.state.smallBlindAmount;
        bigBlindPlayer.chips -= this.state.bigBlindAmount;
        bigBlindPlayer.currentBet = this.state.bigBlindAmount;
        this.state.pot += this.state.bigBlindAmount;
        this.state.currentBet = this.state.bigBlindAmount;
        this.state.currentPlayer = (this.state.bigBlind + 1) % this.state.players.length;
        this.dealCards();
        this.broadcastGameState();
    }
    voteToStart(playerId) {
        if (this.state.phase !== 'waiting')
            return;
        if (!this.state.players.find(p => p.id === playerId))
            return;
        this.votes.add(playerId);
        this.state.votes = Array.from(this.votes);
        this.io.emit('voteStatus', this.state.votes);
        if (this.votes.size === this.state.players.length && this.state.players.length >= 2) {
            this.votes.clear();
            this.state.votes = [];
            this.startNewHand();
        }
        else {
            this.broadcastGameState();
        }
    }
    joinGame(playerId, name) {
        if (this.state.players.length >= 9) {
            return false;
        }
        this.state.players.push({
            id: playerId,
            name,
            chips: 1000,
            cards: [],
            isActive: true,
            currentBet: 0,
            isDealer: false,
            isSmallBlind: false,
            isBigBlind: false
        });
        this.votes.delete(playerId);
        this.state.votes = Array.from(this.votes);
        this.broadcastGameState();
        return true;
    }
    handlePlayerAction(playerId, action, amount = 0) {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player || !player.isActive)
            return;
        switch (action) {
            case 'call':
                const callAmount = Math.min(this.state.currentBet - player.currentBet, player.chips);
                player.chips -= callAmount;
                player.currentBet += callAmount;
                this.state.pot += callAmount;
                this.state.lastAction = 'call';
                this.state.lastActionAmount = callAmount;
                break;
            case 'raise':
                if (amount >= this.state.minimumRaise && amount <= player.chips) {
                    const totalBet = this.state.currentBet + amount;
                    player.chips -= totalBet;
                    player.currentBet = totalBet;
                    this.state.currentBet = totalBet;
                    this.state.pot += totalBet;
                    this.state.minimumRaise = amount;
                    this.state.lastAction = 'raise';
                    this.state.lastActionAmount = amount;
                }
                break;
            case 'fold':
                player.isActive = false;
                this.state.lastAction = 'fold';
                this.state.lastActionAmount = 0;
                break;
        }
        this.moveToNextPlayer();
        if (this.isBettingRoundComplete()) {
            this.moveToNextPhase();
        }
        this.broadcastGameState();
    }
    broadcastGameState() {
        this.state.votes = Array.from(this.votes);
        this.io.emit('gameState', this.state);
    }
}
exports.default = Game;
