import { ProtocolHandler } from '../utils/types';

// Import protocol handlers
import { SystemProtocol } from './system';
import { SPLTokenProtocol } from './spl-token';
import { JupiterProtocol } from './jupiter';
import { MemoProtocol } from './memo';
import { JitoProtocol } from './jito';

export class ProtocolRegistry {
  private static handlers: Map<string, ProtocolHandler> = new Map();
  
  static {
    // Register priority protocols (order matters for conflict resolution)
    this.register(new SystemProtocol());
    this.register(new SPLTokenProtocol());
    this.register(new JupiterProtocol());
    this.register(new MemoProtocol());
    this.register(new JitoProtocol());
  }

  static register(handler: ProtocolHandler): void {
    // Register by protocol name
    this.handlers.set(handler.name, handler);
    
    // Also register by supported intents for quick lookup
    for (const intent of handler.supportedIntents) {
      this.handlers.set(intent, handler);
    }
  }

  static getHandler(intentOrName: string): ProtocolHandler | undefined {
    return this.handlers.get(intentOrName);
  }

  static getAllProtocols(): ProtocolHandler[] {
    const protocols = new Set<ProtocolHandler>();
    
    for (const handler of this.handlers.values()) {
      protocols.add(handler);
    }
    
    return Array.from(protocols);
  }

  static getProtocolInfo() {
    return this.getAllProtocols().map(handler => ({
      name: handler.name,
      description: handler.description,
      supportedActions: handler.supportedIntents,
      documentation: `/api/protocols/${handler.name}`
    }));
  }

  static isSupported(intent: string): boolean {
    return this.handlers.has(intent);
  }
}

// Export individual protocols for direct access if needed
export { SystemProtocol, SPLTokenProtocol, JupiterProtocol, MemoProtocol, JitoProtocol };