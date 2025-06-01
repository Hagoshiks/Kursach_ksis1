import express, { Request } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Card, createDeck, shuffleDeck, dealCards, dealCommunityCards } from './utils/cards';
import authRoutes from './routes/auth';
import Game from './game';
import { config } from './config/config';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Extend Socket type
declare module 'socket.io' {
  interface Socket {
    user?: any;
  }
}

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Auth middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
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
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string };
    socket.data.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Routes
app.use('/api/auth', authRoutes);

// Protected route example
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Only use the Game class for all game logic and state
const game = new Game(io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (name: string) => {
    const success = game.joinGame(socket.id, name);
    if (!success) {
      socket.emit('error', 'Game is full');
    }
  });

  // Handle all poker actions from frontend
  socket.on('action', (data: { action: string, amount?: number }) => {
    const { action, amount = 0 } = data;
    game.handlePlayerAction(socket.id, action, amount);
  });

  // Legacy handlers for backward compatibility
  socket.on('placeBet', (amount: number) => {
    game.handlePlayerAction(socket.id, 'call', amount);
  });

  socket.on('raise', (amount: number) => {
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
httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 