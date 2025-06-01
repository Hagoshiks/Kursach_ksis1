# Texas Hold'em Poker Game

A multiplayer Texas Hold'em poker game built with React, Node.js, and Socket.io.

## Features

- Real-time multiplayer gameplay
- Modern UI with Material-UI
- Full Texas Hold'em poker rules
- Player betting and folding
- Community cards display
- Player chips and bets tracking

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup

1. Install dependencies:
```bash
npm run install-all
```

2. Create a `.env` file in the server directory:
```
PORT=5000
CLIENT_URL=http://localhost:3000
```

3. Start the development servers:
```bash
npm start
```

This will start both the client (port 3000) and server (port 5000).

## How to Play

1. Open http://localhost:3000 in your browser
2. Enter your name and join the game
3. Wait for other players to join
4. The game will automatically start when there are enough players
5. Use the betting controls to place bets or fold
6. Follow standard Texas Hold'em poker rules

## Development

- Client code is in the `client` directory
- Server code is in the `server` directory
- The game uses WebSocket for real-time communication
- State management is handled on the server side 