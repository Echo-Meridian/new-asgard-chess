/**
 * Stockfish chess engine interface
 * A cross-platform, streamlined implementation focused on simplicity and reliability
 * Supporting Web, iOS, and Android platforms
 */
// stockfish.ts
import { Platform } from 'react-native';
import { StockfishIOS } from './platform/stockfish-ios';
import { StockfishAndroid } from './platform/stockfish-android';

// Export the platform-specific implementation
export const Stockfish = Platform.OS === 'ios' ? StockfishIOS : StockfishAndroid;
// Configuration options for Stockfish engine
export interface StockfishConfig {
  depth?: number;   // Search depth (higher = stronger but slower)
  time?: number;    // Time in milliseconds to think
  elo?: number;     // Target ELO rating for skill level
}

// Move information returned from analysis
export interface MoveAnalysis {
  move: string;     // Move in UCI format (e.g. "e2e4")
  score: number;    // Centipawn score
  depth: number;    // Depth of analysis
}

/**
 * Platform-agnostic Stockfish engine interface
 * This defines the common interface that all platform-specific implementations must follow
 */
export interface StockfishEngine {
  init(): Promise<boolean>;
  setPosition(fen: string): Promise<void>;
  getBestMove(config?: StockfishConfig): Promise<string>;
  analyzePosition(config?: StockfishConfig): Promise<MoveAnalysis>;
  setSkillLevel(elo: number): Promise<void>;
  stop?(): Promise<void>;
  dispose(): void;
}

/**
 * Platform detection utility
 */
export function detectPlatform(): 'web' | 'ios' | 'android' {
  // In a real implementation, this would use more sophisticated detection
  // For now, we'll assume we're in a web environment
  
  // Check for React Native environment
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  
  if (isReactNative) {
    // Check for iOS vs Android
    if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return 'ios';
    } else {
      return 'android';
    }
  }
  
  // Default to web
  return 'web';
}

/**
 * Factory function to create a platform-specific Stockfish engine instance
 */
async function createStockfishEngine(): Promise<StockfishEngine> {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'ios': {
      const { StockfishEngineIOS } = await import('./platform/stockfish-ios');
      return new StockfishEngineIOS();
    }
    case 'android': {
      const { StockfishEngineAndroid } = await import('./platform/stockfish-android');
      return new StockfishEngineAndroid();
    }
    case 'web':
    default: {
      const { StockfishEngineWeb } = await import('./platform/stockfish-web');
      return new StockfishEngineWeb();
    }
  }
}

// Create and export a singleton instance
let _stockfishInstance: StockfishEngine | null = null;

export const stockfish: StockfishEngine = {
  async init(): Promise<boolean> {
    if (_stockfishInstance) {
      return _stockfishInstance.init();
    }
    
    try {
      _stockfishInstance = await createStockfishEngine();
      return _stockfishInstance.init();
    } catch (error) {
      console.error('Failed to create Stockfish engine:', error);
      return false;
    }
  },
  
  async setPosition(fen: string): Promise<void> {
    if (!_stockfishInstance) {
      await this.init();
    }
    
    if (!_stockfishInstance) {
      throw new Error('Stockfish engine initialization failed');
    }
    
    return _stockfishInstance.setPosition(fen);
  },
  
  async getBestMove(config: StockfishConfig = {}): Promise<string> {
    if (!_stockfishInstance) {
      await this.init();
    }
    
    if (!_stockfishInstance) {
      throw new Error('Stockfish engine initialization failed');
    }
    
    return _stockfishInstance.getBestMove(config);
  },
  
  async analyzePosition(config: StockfishConfig = {}): Promise<MoveAnalysis> {
    if (!_stockfishInstance) {
      await this.init();
    }
    
    if (!_stockfishInstance) {
      throw new Error('Stockfish engine initialization failed');
    }
    
    return _stockfishInstance.analyzePosition(config);
  },
  
  async setSkillLevel(elo: number): Promise<void> {
    if (!_stockfishInstance) {
      await this.init();
    }
    
    if (!_stockfishInstance) {
      throw new Error('Stockfish engine initialization failed');
    }
    
    return _stockfishInstance.setSkillLevel(elo);
  },
  
  async stop(): Promise<void> {
    if (!_stockfishInstance) {
      return;
    }
    
    if (_stockfishInstance.stop) {
      return _stockfishInstance.stop();
    }
  },
  
  dispose(): void {
    if (_stockfishInstance) {
      _stockfishInstance.dispose();
      _stockfishInstance = null;
    }
  }
};