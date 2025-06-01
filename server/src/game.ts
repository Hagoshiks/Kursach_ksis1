import { Server } from 'socket.io';
import { evaluateHand } from './utils/handEvaluator';

export interface Card {
  suit: '♠' | '♥' | '♦' | '♣';
  value: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

interface Player {
  id: string;
  name: string;
  chips: number;
  cards: Card[];
  isActive: boolean;
  currentBet: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasActed: boolean;
}

interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentPlayer: number;
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;
  minimumRaise: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  lastAction: string;
  lastActionAmount: number;
  deck: Card[];
  smallBlindAmount: number;
  bigBlindAmount: number;
  votes: string[];
  lastRaiserIndex: number;
}

class Game {
  private state: GameState;
  private io: Server;
  private votes: Set<string> = new Set();

  constructor(io: Server) {
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
      votes: [],
      lastRaiserIndex: -1
    };
  }

  private createDeck(): Card[] {
    const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
    const values: ('2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A')[] = 
      ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    
    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private dealCards() {
    this.state.deck = this.createDeck();
    this.state.players.forEach(player => {
      player.cards = [this.state.deck.pop()!, this.state.deck.pop()!];
    });
  }

  private dealCommunityCards(count: number) {
    for (let i = 0; i < count; i++) {
      this.state.communityCards.push(this.state.deck.pop()!);
    }
  }

  private moveToNextPhase() {
    switch (this.state.phase) {
      case 'preflop':
        this.state.phase = 'flop';
        this.dealCommunityCards(3);
        this.resetBettingRound();
        break;
      case 'flop':
        this.state.phase = 'turn';
        this.dealCommunityCards(1);
        this.resetBettingRound();
        break;
      case 'turn':
        this.state.phase = 'river';
        this.dealCommunityCards(1);
        this.resetBettingRound();
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.determineWinner();
        // Don't reset betting round - hand is ending
        break;
      default:
        break;
    }
  }

  private resetBettingRound() {
    this.state.currentBet = 0;
    this.state.minimumRaise = this.state.bigBlindAmount;
    this.state.lastRaiserIndex = -1;
    this.state.players.forEach(player => {
      player.currentBet = 0;
      player.hasActed = false;
    });
    
    // Set first player to act (first active player after dealer for post-flop)
    if (this.state.phase !== 'preflop') {
      let firstPlayer = (this.state.dealer + 1) % this.state.players.length;
      while (!this.state.players[firstPlayer].isActive) {
        firstPlayer = (firstPlayer + 1) % this.state.players.length;
      }
      this.state.currentPlayer = firstPlayer;
    }
  }

  private moveToNextPlayer() {
    let nextPlayer = (this.state.currentPlayer + 1) % this.state.players.length;
    while (!this.state.players[nextPlayer].isActive) {
      nextPlayer = (nextPlayer + 1) % this.state.players.length;
    }
    this.state.currentPlayer = nextPlayer;
  }

  private isBettingRoundComplete(): boolean {
    const activePlayers = this.state.players.filter(p => p.isActive);
    if (activePlayers.length <= 1) return true;
    
    // Check if all active players have either:
    // 1. Matched the current bet, or 
    // 2. Are all-in (have 0 chips left)
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0);
    
    if (playersWhoCanAct.length === 0) {
      // All remaining players are all-in
      return true;
    }
    
    // All players who can act must have:
    // 1. Matched the current bet AND
    // 2. Had a chance to act in this betting round
    const allMatchedBet = playersWhoCanAct.every(player => player.currentBet === this.state.currentBet);
    const allHaveActed = activePlayers.every(player => player.hasActed || player.chips === 0);
    
    // If there was a raise, action must return to the raiser (or raiser must have folded)
    if (this.state.lastRaiserIndex >= 0) {
      const raiser = this.state.players[this.state.lastRaiserIndex];
      const actionReturnedToRaiser = !raiser.isActive || this.state.currentPlayer === this.state.lastRaiserIndex;
      return allMatchedBet && allHaveActed && actionReturnedToRaiser;
    }
    
    return allMatchedBet && allHaveActed;
  }

  private determineWinner() {
    const activePlayers = this.state.players.filter(p => p.isActive);
    if (activePlayers.length === 0) return;

    let winnerInfo;

    if (activePlayers.length === 1) {
      // Only one player left (others folded)
      const winner = activePlayers[0];
      winner.chips += this.state.pot;
      winnerInfo = {
        winner: winner.id,
        winnerName: winner.name,
        hand: 'Opponent folded',
        pot: this.state.pot
      };
    } else {
      // Multiple players - evaluate hands
      const playerHands = activePlayers.map(player => ({
        player,
        hand: evaluateHand(player.cards, this.state.communityCards)
      }));

      // Find the best hand
      const bestHand = playerHands.reduce((best, current) => {
        if (current.hand.rank > best.hand.rank) return current;
        if (current.hand.rank === best.hand.rank) {
          // Compare kickers
          for (let i = 0; i < current.hand.value.length; i++) {
            if (current.hand.value[i] > best.hand.value[i]) return current;
            if (current.hand.value[i] < best.hand.value[i]) return best;
          }
        }
        return best;
      });

      // Award pot to winner
      bestHand.player.chips += this.state.pot;
      
      winnerInfo = {
        winner: bestHand.player.id,
        winnerName: bestHand.player.name,
        hand: bestHand.hand.name,
        pot: this.state.pot,
        allHands: playerHands.map(ph => ({
          playerId: ph.player.id,
          playerName: ph.player.name,
          hand: ph.hand.name,
          cards: ph.player.cards
        }))
      };
    }

    // Broadcast showdown state with all cards revealed
    this.broadcastGameState();

    // Broadcast showdown results
    this.io.emit('showdown', winnerInfo);

    // Wait 5 seconds before starting next hand
    setTimeout(() => {
      this.resetForNewHand();
      this.broadcastGameState();
    }, 5000);
  }

  private resetForNewHand() {
    // Reset for next hand
    this.state.pot = 0;
    this.state.communityCards = [];
    this.state.currentBet = 0;
    this.state.players.forEach(player => {
      player.cards = [];
      player.currentBet = 0;
      player.isActive = true;
      player.isDealer = false;
      player.isSmallBlind = false;
      player.isBigBlind = false;
      player.hasActed = false;
    });
    
    // Check if any players are busted (have no chips)
    const playersWithChips = this.state.players.filter(p => p.chips > 0);
    
    if (playersWithChips.length < 2) {
      // Not enough players with chips to continue - go to waiting room
      this.state.phase = 'waiting';
      if (playersWithChips.length === 1) {
        this.io.emit('gameOver', {
          winner: playersWithChips[0].name,
          message: 'Game Over! Winner takes all!'
        });
      }
    } else {
      // Automatically start next hand
      setTimeout(() => {
        this.startNewHand();
      }, 1000); // 1 second delay before next hand
    }
  }

  private startNewHand() {
    this.state.phase = 'preflop';
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = this.state.bigBlindAmount;
    this.state.minimumRaise = this.state.bigBlindAmount;
    this.state.lastRaiserIndex = -1;
    
    // Move dealer button to next player
    this.state.dealer = (this.state.dealer + 1) % this.state.players.length;
    
    // Set dealer positions
    if (this.state.players.length === 2) {
      // Heads-up: dealer is small blind
      this.state.smallBlind = this.state.dealer;
      this.state.bigBlind = (this.state.dealer + 1) % this.state.players.length;
    } else {
      // Multi-player: standard positions
      this.state.smallBlind = (this.state.dealer + 1) % this.state.players.length;
      this.state.bigBlind = (this.state.dealer + 2) % this.state.players.length;
    }
    
    // Set position badges and reset hasActed
    this.state.players.forEach((player, index) => {
      player.isDealer = index === this.state.dealer;
      player.isSmallBlind = index === this.state.smallBlind;
      player.isBigBlind = index === this.state.bigBlind;
      player.currentBet = 0;
      player.isActive = true;
      player.hasActed = false;
    });
    
    // Post blinds
    const smallBlindPlayer = this.state.players[this.state.smallBlind];
    const bigBlindPlayer = this.state.players[this.state.bigBlind];
    
    const smallBlindAmount = Math.min(this.state.smallBlindAmount, smallBlindPlayer.chips);
    const bigBlindAmount = Math.min(this.state.bigBlindAmount, bigBlindPlayer.chips);
    
    smallBlindPlayer.chips -= smallBlindAmount;
    smallBlindPlayer.currentBet = smallBlindAmount;
    smallBlindPlayer.hasActed = true; // Small blind is considered to have acted
    this.state.pot += smallBlindAmount;
    
    bigBlindPlayer.chips -= bigBlindAmount;
    bigBlindPlayer.currentBet = bigBlindAmount;
    // Big blind gets option to raise, so hasActed = false initially
    this.state.pot += bigBlindAmount;
    
    this.state.currentBet = bigBlindAmount;
    
    // First player to act is left of big blind (under the gun)
    this.state.currentPlayer = (this.state.bigBlind + 1) % this.state.players.length;
    
    this.dealCards();
    this.broadcastGameState();
  }

  public voteToStart(playerId: string) {
    if (this.state.phase !== 'waiting') return;
    if (!this.state.players.find(p => p.id === playerId)) return;
    this.votes.add(playerId);
    this.state.votes = Array.from(this.votes);
    this.io.emit('voteStatus', this.state.votes);
    if (this.votes.size === this.state.players.length && this.state.players.length >= 2) {
      this.votes.clear();
      this.state.votes = [];
      this.startNewHand();
    } else {
      this.broadcastGameState();
    }
  }

  public joinGame(playerId: string, name: string) {
    if (this.state.players.length >= 9) {
      return false;
    }

    // Remove any player with the same name (username) or id (ghost/disconnected)
    this.state.players = this.state.players.filter(
      p => p.name !== name && p.id !== playerId
    );
    this.votes.delete(playerId);
    this.state.votes = Array.from(this.votes);

    this.state.players.push({
      id: playerId,
      name,
      chips: 1000,
      cards: [],
      isActive: true,
      currentBet: 0,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasActed: false
    });

    this.broadcastGameState();
    return true;
  }

  public handlePlayerAction(playerId: string, action: string, amount: number = 0) {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || !player.isActive) return;
    
    // Check if it's the player's turn
    if (this.state.currentPlayer !== this.state.players.indexOf(player)) return;

    // Mark player as having acted in this betting round
    player.hasActed = true;

    switch (action) {
      case 'check':
        // Player can only check if no bet has been made this round
        if (this.state.currentBet === player.currentBet) {
          this.state.lastAction = 'check';
          this.state.lastActionAmount = 0;
        } else {
          return; // Can't check if there's a bet to call
        }
        break;

      case 'call':
        const callAmount = Math.min(
          this.state.currentBet - player.currentBet,
          player.chips
        );
        if (callAmount > 0) {
          player.chips -= callAmount;
          player.currentBet += callAmount;
          this.state.pot += callAmount;
          this.state.lastAction = 'call';
          this.state.lastActionAmount = callAmount;
        }
        break;

      case 'raise':
        const totalCallAmount = this.state.currentBet - player.currentBet;
        const raiseAmount = amount;
        const totalAmount = totalCallAmount + raiseAmount;
        
        if (raiseAmount >= this.state.minimumRaise && totalAmount <= player.chips) {
          player.chips -= totalAmount;
          player.currentBet += totalAmount;
          this.state.currentBet = player.currentBet;
          this.state.pot += totalAmount;
          this.state.minimumRaise = raiseAmount;
          this.state.lastAction = 'raise';
          this.state.lastActionAmount = raiseAmount;
          this.state.lastRaiserIndex = this.state.currentPlayer;
          
          // Reset hasActed for all other players since there's a new bet to respond to
          this.state.players.forEach((p, index) => {
            if (index !== this.state.currentPlayer && p.isActive) {
              p.hasActed = false;
            }
          });
        } else {
          return; // Invalid raise
        }
        break;

      case 'fold':
        player.isActive = false;
        this.state.lastAction = 'fold';
        this.state.lastActionAmount = 0;
        break;

      default:
        return; // Invalid action
    }

    // Check if only one player remains (everyone else folded)
    const activePlayers = this.state.players.filter(p => p.isActive);
    if (activePlayers.length === 1) {
      // Award pot to last remaining player
      activePlayers[0].chips += this.state.pot;
      this.resetForNewHand();
      this.broadcastGameState();
      return;
    }

    this.moveToNextPlayer();

    if (this.isBettingRoundComplete()) {
      this.moveToNextPhase();
    }

    this.broadcastGameState();
  }

  private broadcastGameState() {
    this.state.votes = Array.from(this.votes);
    // Convert card objects to strings for frontend compatibility
    const stateForFrontend = {
      ...this.state,
      communityCards: this.state.communityCards.map(card => card.value + card.suit),
      players: this.state.players.map(player => ({
        id: player.id,
        username: player.name,
        chips: player.chips,
        cards: player.cards.map(card => card.value + card.suit),
        bet: player.currentBet,
        isActive: player.isActive,
        isFolded: !player.isActive,
        isDealer: player.isDealer,
        isSmallBlind: player.isSmallBlind,
        isBigBlind: player.isBigBlind,
        lastAction: undefined
      })),
      minPlayers: 2,
      maxPlayers: 9,
      votes: Array.from(this.votes)
    };
    this.io.emit('gameState', stateForFrontend);
  }
}

export default Game; 