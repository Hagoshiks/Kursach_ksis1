import { Card } from '../game';

interface HandRank {
  rank: number;
  name: string;
  value: number[];
}

const HAND_RANKS = {
  ROYAL_FLUSH: 10,
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  ONE_PAIR: 2,
  HIGH_CARD: 1
};

const CARD_VALUES: { [key: string]: number } = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
  const allCards = [...holeCards, ...communityCards];
  const possibleHands = getPossibleHands(allCards);
  return findBestHand(possibleHands);
}

function getPossibleHands(cards: Card[]): Card[][] {
  const hands: Card[][] = [];
  const n = cards.length;
  
  // Generate all possible 5-card combinations
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            hands.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }
  
  return hands;
}

function findBestHand(hands: Card[][]): HandRank {
  let bestHand: HandRank = { rank: 0, name: '', value: [] };
  
  for (const hand of hands) {
    const rank = evaluateFiveCardHand(hand);
    if (rank.rank > bestHand.rank || 
        (rank.rank === bestHand.rank && compareHandValues(rank.value, bestHand.value) > 0)) {
      bestHand = rank;
    }
  }
  
  return bestHand;
}

function evaluateFiveCardHand(hand: Card[]): HandRank {
  const values = hand.map(card => CARD_VALUES[card.value]).sort((a, b) => b - a);
  const suits = hand.map(card => card.suit);
  
  // Check for flush
  const isFlush = suits.every(suit => suit === suits[0]);
  
  // Check for straight
  const isStraight = values.every((value, index) => 
    index === 0 || value === values[index - 1] - 1
  );
  
  // Check for royal flush
  if (isFlush && isStraight && values[0] === 14) {
    return { rank: HAND_RANKS.ROYAL_FLUSH, name: 'Royal Flush', value: values };
  }
  
  // Check for straight flush
  if (isFlush && isStraight) {
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, name: 'Straight Flush', value: values };
  }
  
  // Check for four of a kind
  const valueCounts = countValues(values);
  const fourOfAKind = Object.entries(valueCounts).find(([_, count]) => count === 4);
  if (fourOfAKind) {
    const kicker = values.find(v => v !== parseInt(fourOfAKind[0]));
    return { 
      rank: HAND_RANKS.FOUR_OF_A_KIND, 
      name: 'Four of a Kind', 
      value: [parseInt(fourOfAKind[0]), kicker!] 
    };
  }
  
  // Check for full house
  const threeOfAKind = Object.entries(valueCounts).find(([_, count]) => count === 3);
  const pair = Object.entries(valueCounts).find(([_, count]) => count === 2);
  if (threeOfAKind && pair) {
    return { 
      rank: HAND_RANKS.FULL_HOUSE, 
      name: 'Full House', 
      value: [parseInt(threeOfAKind[0]), parseInt(pair[0])] 
    };
  }
  
  // Check for flush
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, name: 'Flush', value: values };
  }
  
  // Check for straight
  if (isStraight) {
    return { rank: HAND_RANKS.STRAIGHT, name: 'Straight', value: values };
  }
  
  // Check for three of a kind
  if (threeOfAKind) {
    const kickers = values.filter(v => v !== parseInt(threeOfAKind[0])).slice(0, 2);
    return { 
      rank: HAND_RANKS.THREE_OF_A_KIND, 
      name: 'Three of a Kind', 
      value: [parseInt(threeOfAKind[0]), ...kickers] 
    };
  }
  
  // Check for two pair
  const pairs = Object.entries(valueCounts)
    .filter(([_, count]) => count === 2)
    .map(([value]) => parseInt(value))
    .sort((a, b) => b - a);
  
  if (pairs.length === 2) {
    const kicker = values.find(v => !pairs.includes(v));
    return { 
      rank: HAND_RANKS.TWO_PAIR, 
      name: 'Two Pair', 
      value: [...pairs, kicker!] 
    };
  }
  
  // Check for one pair
  if (pairs.length === 1) {
    const kickers = values.filter(v => v !== pairs[0]).slice(0, 3);
    return { 
      rank: HAND_RANKS.ONE_PAIR, 
      name: 'One Pair', 
      value: [pairs[0], ...kickers] 
    };
  }
  
  // High card
  return { rank: HAND_RANKS.HIGH_CARD, name: 'High Card', value: values.slice(0, 5) };
}

function countValues(values: number[]): { [key: number]: number } {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {} as { [key: number]: number });
}

function compareHandValues(values1: number[], values2: number[]): number {
  for (let i = 0; i < values1.length; i++) {
    if (values1[i] !== values2[i]) {
      return values1[i] - values2[i];
    }
  }
  return 0;
} 