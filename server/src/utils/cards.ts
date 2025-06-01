export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values: Card['value'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], numPlayers: number): { playerCards: Card[][], remainingDeck: Card[] } {
  const playerCards: Card[][] = Array(numPlayers).fill([]).map(() => []);
  const remainingDeck = [...deck];

  // Deal 2 cards to each player
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < numPlayers; j++) {
      if (remainingDeck.length > 0) {
        playerCards[j] = [...playerCards[j], remainingDeck.pop()!];
      }
    }
  }

  return { playerCards, remainingDeck };
}

export function dealCommunityCards(deck: Card[], count: number): { cards: Card[], remainingDeck: Card[] } {
  const cards: Card[] = [];
  const remainingDeck = [...deck];

  for (let i = 0; i < count; i++) {
    if (remainingDeck.length > 0) {
      cards.push(remainingDeck.pop()!);
    }
  }

  return { cards, remainingDeck };
} 