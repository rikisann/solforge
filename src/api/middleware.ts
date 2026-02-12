import { Request, Response, NextFunction } from 'express';
import { BuildIntent, NaturalLanguageIntent } from '../utils/types';

// Rate limiting store (in-memory for MVP, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 100
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }

    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // New window
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }

    clientData.count++;
    next();
  };
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('API Error:', error);

  // Handle specific error types
  if (error.message.includes('Invalid public key')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address provided'
    });
  }

  if (error.message.includes('Insufficient funds')) {
    return res.status(400).json({
      success: false,
      error: 'Insufficient funds for transaction'
    });
  }

  if (error.message.includes('Jupiter')) {
    return res.status(502).json({
      success: false,
      error: 'External swap service unavailable'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : error.message
  });
}

export function validateBuildIntent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { intent, params, payer } = req.body as BuildIntent;

  if (!intent || typeof intent !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Intent is required and must be a string'
    });
  }

  if (!params || typeof params !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Params is required and must be an object'
    });
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format (basic check)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

export function validateNaturalIntent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { prompt, payer } = req.body as NaturalLanguageIntent;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required and must be a non-empty string'
    });
  }

  if (prompt.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Prompt too long. Maximum 500 characters allowed.'
    });
  }

  if (!payer || typeof payer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Payer wallet address is required'
    });
  }

  // Validate wallet address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payer)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer wallet address format'
    });
  }

  next();
}

export function corsHeaders(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}

export function logRequests(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}