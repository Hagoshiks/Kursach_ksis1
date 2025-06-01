import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

interface User {
  id: number;
  username: string;
  chips: number;
}

interface GameState {
  players: {
    id: number;
    username: string;
    chips: number;
    cards: string[];
    bet: number;
    isActive: boolean;
    isFolded: boolean;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    lastAction?: string;
  }[];
  communityCards: string[];
  pot: number;
  currentPlayer: number;
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;
  minimumRaise: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  lastAction?: string;
  lastActionAmount?: number;
  minPlayers: number;
  maxPlayers: number;
  votes?: number[];
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showCards, setShowCards] = useState(false);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [votes, setVotes] = useState<number[]>([]);
  const [showdownInfo, setShowdownInfo] = useState<any>(null);
  const [showGameStartConfirmation, setShowGameStartConfirmation] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  // Detect when all votes are collected and show confirmation
  useEffect(() => {
    console.log('Vote check:', { 
      gameState: gameState?.phase, 
      votesLength: votes.length, 
      playersLength: gameState?.players.length,
      showGameStartConfirmation
    });
    
    // Trigger confirmation when votes just completed (regardless of phase)
    if (gameState && votes.length > 0 && 
        votes.length === gameState.players.length && gameState.players.length >= 2 && 
        !showGameStartConfirmation) {
      console.log('Triggering game start confirmation!');
      setShowGameStartConfirmation(true);
      // Hide confirmation after 3 seconds
      setTimeout(() => {
        setShowGameStartConfirmation(false);
      }, 3000);
    }
  }, [votes, gameState, showGameStartConfirmation]);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        connectToGame(data.user);
      } else {
        localStorage.removeItem('token');
      }
    } catch (err) {
      console.error('Token verification failed:', err);
      localStorage.removeItem('token');
    }
  };

  const connectToGame = (user: User) => {
    const newSocket = io('http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to game server');
      setIsConnected(true);
      setError(null);
      newSocket.emit('joinGame', user.username);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from game server');
      setIsConnected(false);
    });

    newSocket.on('error', (error: string) => {
      console.error('Game server error:', error);
      setError(error);
    });

    newSocket.on('gameState', (state: GameState) => {
      console.log('Received game state:', state);
      setGameState(state);
      setVotes(state.votes || []);
      if (state.phase === 'showdown') {
        setShowCards(true);
        setTimeout(() => setShowCards(false), 6000);
      }
    });

    newSocket.on('showdown', (winnerInfo: any) => {
      console.log('Showdown results:', winnerInfo);
      setShowdownInfo(winnerInfo);
      setTimeout(() => setShowdownInfo(null), 6000);
    });

    newSocket.on('gameOver', (gameOverInfo: any) => {
      console.log('Game Over:', gameOverInfo);
      alert(`🏆 ${gameOverInfo.message}\nWinner: ${gameOverInfo.winner}`);
    });

    newSocket.on('voteStatus', (votes: number[]) => {
      setVotes(votes);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      connectToGame(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    setUser(null);
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  const handleAction = (action: string, amount?: number) => {
    if (!socket || !gameState) return;

    if (action === 'raise') {
      if (!amount || amount < gameState.minimumRaise) {
        setError(`Minimum raise is ${gameState.minimumRaise}`);
        return;
      }
    }

    socket.emit('action', { action, amount });
    setShowRaiseSlider(false);
  };

  const handleRaiseSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!gameState) return;
    const value = parseInt(e.target.value);
    setRaiseAmount(value);
  };

  const openRaiseSlider = () => {
    if (!gameState || !currentPlayer) return;
    // Initialize raise amount to minimum raise
    setRaiseAmount(gameState.minimumRaise);
    setShowRaiseSlider(true);
  };

  const getCardColor = (card: string) => {
    return card.includes('♥') || card.includes('♦') ? 'red' : 'black';
  };

  const renderCard = (card: string, isHidden: boolean = false) => {
    if (isHidden) {
      return (
        <div className="card hidden">
          🂠
        </div>
      );
    }

    if (!card || card === '') {
      return <div className="card hidden">🂠</div>;
    }

    // Parse card string (e.g., "A♠", "K♥", "10♦", "J♣")
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const colorClass = getCardColor(card);

    return (
      <div className={`card ${colorClass}`}>
        <div className="card-corner top-left">
          <div className="card-rank">{rank}</div>
          <div className="card-suit-small">{suit}</div>
        </div>
        <div className="card-suit-large">{suit}</div>
        <div className="card-corner bottom-right">
          <div className="card-rank">{rank}</div>
          <div className="card-suit-small">{suit}</div>
        </div>
      </div>
    );
  };

  const getAvatar = (username: string) => {
    // Safety check for undefined/null username
    if (!username || typeof username !== 'string') {
      username = 'Unknown';
    }
    
    const colors = ['#1976d2', '#43a047', '#d32f2f', '#fbc02d', '#8e24aa', '#00897b'];
    const color = colors[username.charCodeAt(0) % colors.length];
    const initials = username.slice(0, 2).toUpperCase();
    return (
      <div style={{
        background: color,
        borderRadius: '50%',
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: 22,
        margin: '0 auto 0.5rem auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>{initials}</div>
    );
  };

  const getPlayerPositionBadge = (player: GameState['players'][0]) => {
    if (player.isDealer) return <span className="badge dealer">D</span>;
    if (player.isSmallBlind) return <span className="badge sb">SB</span>;
    if (player.isBigBlind) return <span className="badge bb">BB</span>;
    return null;
  };

  const renderWaitingRoom = () => {
    if (!gameState) return null;
    return (
      <div className="waiting-room">
        <div className="waiting-info">
          <h2>Waiting for Players</h2>
          <div className="player-count">
            {gameState.players.length} / {gameState.maxPlayers} Players
          </div>
          <div className="min-players">
            Game starts with {gameState.minPlayers} players
          </div>
          <div className="table-info">
            <div className="info-item">
              <span className="label">Small Blind:</span>
              <span className="value">$5</span>
            </div>
            <div className="info-item">
              <span className="label">Big Blind:</span>
              <span className="value">$10</span>
            </div>
            <div className="info-item">
              <span className="label">Starting Stack:</span>
              <span className="value">$1000</span>
            </div>
          </div>
        </div>
        <div className="join-instructions">
          <button 
            className="instructions-button"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            How to Join
          </button>
          {showInstructions && (
            <div className="instructions-content">
              <h3>How to Join the Game:</h3>
              <ol>
                <li>Open a new browser window or incognito mode</li>
                <li>Go to <code>http://localhost:3000</code></li>
                <li>Create a new account or sign in</li>
                <li>You'll automatically join the waiting room</li>
                <li>Game starts when {gameState.minPlayers} players join</li>
              </ol>
              <div className="share-link">
                <p>Share this link with friends:</p>
                <code>http://localhost:3000</code>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleVoteToStart = () => {
    if (socket) {
      socket.emit('voteToStart');
    }
  };

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-logo">♠️ ♥️ ♣️ ♦️</div>
          <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <button
            className="switch-auth"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <h2>Loading game...</h2>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  if (gameState.phase === 'waiting') {
    return (
      <div className="game-container">
        <div className="game-header">
          <div className="game-title">
            <h2>Texas Hold'em Poker</h2>
          </div>
          <div className="user-info">
            <div className="user-stats">
              <span className="username">{user.username}</span>
              <span className="chips">${user.chips}</span>
            </div>
            <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
        {renderWaitingRoom()}
        {gameState.players.length >= 2 && (
          <div className="waiting-vote-room">
            <div className="waiting-info">
              <h2>Waiting for Players</h2>
              <div className="player-count">
                {gameState.players.length} / {gameState.maxPlayers} Players
              </div>
              <div className="min-players">
                Game starts with {gameState.minPlayers} players
              </div>
            </div>
            <div className="vote-section">
              <button
                className="vote-to-start-btn"
                onClick={handleVoteToStart}
                disabled={votes.includes(user.id)}
              >
                {votes.includes(user.id) ? '✅ Voted!' : '🗳️ Vote to Start'}
              </button>
              
              <div className="vote-status">
                <div className="vote-header">
                  <h3>🎲 Ready to Play?</h3>
                  <div className="vote-progress">
                    <span className="vote-count">{votes.length} / {gameState.players.length}</span>
                    <span className="vote-label">players ready</span>
                  </div>
                </div>
                
                <div className="players-vote-list">
                  {gameState.players.map((p) => (
                    <div 
                      key={p.id} 
                      className={`player-vote-card ${votes.includes(p.id) ? 'voted' : 'pending'}`}
                    >
                      <div className="vote-player-avatar">
                        {getAvatar(p.username)}
                      </div>
                      <div className="vote-player-info">
                        <span className="vote-player-name">{p.username}</span>
                        <div className="vote-status-indicator">
                          {votes.includes(p.id) ? (
                            <span className="ready">✅ Ready</span>
                          ) : (
                            <span className="waiting">⏳ Waiting...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {votes.length === gameState.players.length ? (
                  <div className="vote-complete">
                    <span className="starting-message">🚀 Starting game...</span>
                  </div>
                ) : (
                  <div className="vote-incomplete">
                    <span className="waiting-message">
                      Waiting for {gameState.players.length - votes.length} more player{gameState.players.length - votes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Game Start Confirmation Modal */}
        {showGameStartConfirmation && (
          <div className="game-start-overlay">
            <div className="game-start-modal">
              <div className="game-start-icon">🚀</div>
              <h2 className="game-start-title">Starting Game...</h2>
              <p className="game-start-subtitle">All players ready! Dealing cards now.</p>
              <div className="game-start-progress">
                <div className="progress-bar"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.username === user.username);
  const currentPlayerIndex = gameState.players.findIndex(p => p.username === user.username);
  const isPlayerTurn = currentPlayerIndex === gameState.currentPlayer;
  const callAmount = gameState.currentBet - (currentPlayer?.bet || 0);

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title">
          <h2>Texas Hold'em Poker</h2>
          <div className="game-phase">{gameState.phase.toUpperCase()}</div>
        </div>
        <div className="user-info">
          <div className="user-stats">
            <span className="username">{user.username}</span>
            <span className="chips">${user.chips}</span>
          </div>
          <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      <div className="game-table">
        {/* Table Center Area */}
        <div className="table-center">
          <div className="table-info">
            <div className="pot">💰 ${gameState.pot}</div>
            {gameState.lastAction && (
              <div className="last-action">
                {gameState.lastAction} {gameState.lastActionAmount ? `$${gameState.lastActionAmount}` : ''}
              </div>
            )}
            {showdownInfo && (
              <div className="showdown-results">
                <div className="winner-announcement">
                  🏆 {showdownInfo.winnerName} wins ${showdownInfo.pot}!
                </div>
                <div className="winning-hand">
                  {showdownInfo.hand}
                </div>
              </div>
            )}
          </div>

          <div className="community-cards">
            {gameState.communityCards.map((card, index) => (
              <React.Fragment key={index}>
                {renderCard(card)}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Players positioned around the table */}
        <div className="players">
          {gameState.players.map((player, index) => (
            <div
              key={player.id}
              className={`player-card ${index === gameState.currentPlayer ? 'active' : ''} ${player.username === user.username ? 'self' : ''} ${player.isFolded ? 'folded' : ''}`}
            >
              <div className="player-info">
                <div className="player-header">
                  <span className="player-name">{player.username}</span>
                  {getPlayerPositionBadge(player)}
                </div>
                <div className="player-chips">
                  <span className="chips">${player.chips}</span>
                  {player.bet > 0 && <div className="bet">Bet: ${player.bet}</div>}
                </div>
                {player.lastAction && (
                  <div className="player-action">{player.lastAction}</div>
                )}
              </div>
              <div className="player-cards">
                {player.cards.map((card, index) => (
                  <React.Fragment key={index}>
                    {renderCard(card, player.username !== user.username && !showCards)}
                  </React.Fragment>
                ))}
              </div>
              {player.isFolded && <div className="folded">FOLDED</div>}
            </div>
          ))}
        </div>
      </div>
      
      {isPlayerTurn && (
        <div className="poker-actions-bar">
          {/* Show CHECK button when no bet to call */}
          {callAmount === 0 && (
            <button 
              className="action-button check"
              onClick={() => handleAction('check')}
            >
              CHECK
            </button>
          )}
          
          {/* Show CALL button when there's a bet to call */}
          {callAmount > 0 && (
            <button 
              className="action-button call"
              onClick={() => handleAction('call')}
            >
              CALL ${callAmount}
            </button>
          )}
          
          {/* RAISE button - always available */}
          <button 
            className="action-button raise"
            onClick={() => openRaiseSlider()}
            disabled={!currentPlayer || currentPlayer.chips < gameState.minimumRaise}
          >
            {callAmount > 0 ? 'RAISE' : 'BET'}
          </button>
          
          {/* FOLD button - always available */}
          <button 
            className="action-button fold"
            onClick={() => handleAction('fold')}
          >
            FOLD
          </button>
          
          {/* Raise controls */}
          {showRaiseSlider && (
            <div className="raise-controls">
              <div className="raise-info">
                <span>To call: ${callAmount}</span>
                <span>Raise by: ${raiseAmount}</span>
                <span>Total bet: ${callAmount + raiseAmount}</span>
              </div>
              <input
                type="range"
                min={gameState.minimumRaise}
                max={Math.max(gameState.minimumRaise, (currentPlayer?.chips || 0) - callAmount)}
                value={raiseAmount}
                onChange={handleRaiseSlider}
                className="raise-slider"
              />
              <div className="raise-amount-display">
                Raise: ${raiseAmount}
              </div>
              <div className="raise-buttons">
                <button 
                  className="action-button confirm-raise"
                  onClick={() => handleAction('raise', raiseAmount)}
                  disabled={raiseAmount < gameState.minimumRaise || (callAmount + raiseAmount) > (currentPlayer?.chips || 0)}
                >
                  {callAmount > 0 ? `RAISE TO $${callAmount + raiseAmount}` : `BET $${raiseAmount}`}
                </button>
                <button 
                  className="action-button cancel-raise"
                  onClick={() => setShowRaiseSlider(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isPlayerTurn && gameState.phase !== 'showdown' && (
        <div className="waiting-turn">
          <div className="turn-indicator">
            {(() => {
              const activePlayer = gameState.players[gameState.currentPlayer];
              return activePlayer ? `Waiting for ${activePlayer.username} to act...` : 'Waiting for next player...';
            })()}
          </div>
        </div>
      )}
      
      {showGameStartConfirmation && (
        <div className="game-start-overlay">
          <div className="game-start-modal">
            <div className="game-start-icon">🚀</div>
            <h2 className="game-start-title">Starting Game...</h2>
            <p className="game-start-subtitle">All players ready! Dealing cards now.</p>
            <div className="game-start-progress">
              <div className="progress-bar"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 