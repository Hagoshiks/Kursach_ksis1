"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.dealCards = dealCards;
exports.dealCommunityCards = dealCommunityCards;
function createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function dealCards(deck, numPlayers) {
    const playerCards = Array(numPlayers).fill([]).map(() => []);
    const remainingDeck = [...deck];
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < numPlayers; j++) {
            if (remainingDeck.length > 0) {
                playerCards[j] = [...playerCards[j], remainingDeck.pop()];
            }
        }
    }
    return { playerCards, remainingDeck };
}
function dealCommunityCards(deck, count) {
    const cards = [];
    const remainingDeck = [...deck];
    for (let i = 0; i < count; i++) {
        if (remainingDeck.length > 0) {
            cards.push(remainingDeck.pop());
        }
    }
    return { cards, remainingDeck };
}
