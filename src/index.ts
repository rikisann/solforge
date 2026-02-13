import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import routes from './api/routes';
import { errorHandler, corsHeaders, logRequests } from './api/middleware';
import { RPCConnection } from './utils/connection';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware (relaxed CSP for demo page with wallet integration)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.mainnet-beta.solana.com", "https://mainnet.helius-rpc.com", "https://lite-api.jup.ag", "https://api.dexscreener.com", "https://api.jup.ag", "wss://api.mainnet-beta.solana.com", "wss://mainnet.helius-rpc.com"],
    }
  }
}));

// CORS middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Custom middleware
app.use(corsHeaders);
app.use(logRequests);

// Serve static files from public directory (no caching for dev/demo)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
}));

// API routes
app.use('/', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Startup function
async function startup() {
  try {
    console.log('🚀 Starting SolForge API...');
    
    // Test RPC connections
    const defaultNetwork = RPCConnection.getDefaultNetwork();
    console.log(`📡 Testing ${defaultNetwork} RPC connection...`);
    
    const isConnected = await RPCConnection.testConnection(defaultNetwork);
    if (!isConnected) {
      console.warn(`⚠️  Warning: Could not connect to ${defaultNetwork} RPC`);
    } else {
      console.log(`✅ Connected to ${defaultNetwork} RPC`);
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🌟 SolForge API running on port ${PORT}`);
      console.log(`📚 API Documentation:`);
      console.log(`   Health Check: http://localhost:${PORT}/health`);
      console.log(`   Build Transaction: POST http://localhost:${PORT}/api/build`);
      console.log(`   Natural Language: POST http://localhost:${PORT}/api/build/natural`);
      console.log(`   Protocols: GET http://localhost:${PORT}/api/protocols`);
      console.log(`   Examples: GET http://localhost:${PORT}/api/examples`);
      console.log(`   Quote: POST http://localhost:${PORT}/api/quote`);
      console.log('');
      console.log('🔥 Ready to forge transactions!');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startup();