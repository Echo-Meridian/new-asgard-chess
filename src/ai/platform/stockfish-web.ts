/**
 * Web-specific implementation of the StockfishEngine
 * Uses a Web Worker to communicate with the Stockfish WASM engine
 */
import type { StockfishConfig, MoveAnalysis, StockfishEngine } from '@/ai/stockfish';

/**
 * Web-specific implementation of the Stockfish engine
 * This uses a Web Worker to communicate with the Stockfish WASM engine
 */
export class StockfishEngineWeb implements StockfishEngine {
  private worker: Worker | null = null;
  private initialized: boolean = false;
  private isReady: boolean = false;
  private wasmSupported: boolean = typeof WebAssembly === 'object';
  
  // Path to Stockfish worker
  private readonly STOCKFISH_PATH = '/stockfish/stockfish.worker.js';
  
  // Maximum time to wait for engine to respond (ms)
  private readonly ENGINE_TIMEOUT = 10000;
  
  /**
   * Initialize the Stockfish engine
   */
  async init(): Promise<boolean> {
    // If already initialized, just return success
    if (this.initialized) {
      return true;
    }
    
    try {
      console.log('Creating Stockfish worker...');
      this.worker = new Worker(this.STOCKFISH_PATH);
      
      // Set up message handler
      this.worker.onmessage = this.handleMessage.bind(this);
      
      // Set up error handler
      this.worker.onerror = (error) => {
        console.error('Stockfish worker error:', error);
        throw new Error(`Worker error: ${error.message}`);
      };
      
      // Initialize UCI protocol
      await this.sendCommand('uci');
      
      // Wait for engine to be ready
      await this.sendCommand('isready');
      this.isReady = true;
      
      // Set default options for mobile
      await this.sendCommand('setoption name Hash value 16');
      await this.sendCommand('setoption name Threads value 1');
      
      this.initialized = true;
      console.log('Stockfish engine initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Stockfish engine:', error);
      this.dispose();
      return false;
    }
  }
  
  /**
   * Set position on the board using FEN notation
   */
  async setPosition(fen: string): Promise<void> {
    await this.sendCommand(`position fen ${fen}`);
  }
  
  /**
   * Get the best move for the current position
   */
  async getBestMove(config: StockfishConfig = {}): Promise<string> {
    const { depth = 12, time = 1000 } = config;
    
    return new Promise<string>((resolve, reject) => {
      // Set up a timeout
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for best move'));
      }, time + this.ENGINE_TIMEOUT);
      
      // Set skill level if specified
      if (config.elo) {
        this.setSkillLevel(config.elo).catch(error => {
          console.error('Error setting skill level:', error);
        });
      }
      
      // Listen for bestmove response
      const messageHandler = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          const data = event.data;
          const match = data.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
          
          if (match) {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', messageHandler);
            resolve(match[1]);
          }
        }
      };
      
      this.worker?.addEventListener('message', messageHandler);
      
      // Send command to find best move
      this.sendCommand(`go depth ${depth} movetime ${time}`)
        .catch(error => {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', messageHandler);
          reject(error);
        });
    });
  }
  
  /**
   * Analyze the current position
   */
  async analyzePosition(config: StockfishConfig = {}): Promise<MoveAnalysis> {
    const { depth = 12, time = 1000 } = config;
    
    return new Promise<MoveAnalysis>((resolve, reject) => {
      // Set up a timeout
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for analysis'));
      }, time + this.ENGINE_TIMEOUT);
      
      let bestAnalysis: MoveAnalysis | null = null;
      
      // Set skill level if specified
      if (config.elo) {
        this.setSkillLevel(config.elo).catch(error => {
          console.error('Error setting skill level:', error);
        });
      }
      
      // Listen for info and bestmove responses
      const messageHandler = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          const data = event.data;
          
          // Parse info string for move analysis
          if (data.startsWith('info depth')) {
            const scoreMatch = data.match(/score cp (-?\d+)/);
            const depthMatch = data.match(/depth (\d+)/);
            const pvMatch = data.match(/pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
            
            if (scoreMatch && depthMatch && pvMatch) {
              const score = parseInt(scoreMatch[1]);
              const depth = parseInt(depthMatch[1]);
              const move = pvMatch[1];
              
              bestAnalysis = { move, score, depth };
            }
          }
          
          // Resolve when bestmove is found
          if (data.startsWith('bestmove')) {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', messageHandler);
            
            if (bestAnalysis) {
              resolve(bestAnalysis);
            } else {
              const match = data.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
              if (match) {
                resolve({ move: match[1], score: 0, depth: 0 });
              } else {
                reject(new Error('Failed to parse bestmove'));
              }
            }
          }
        }
      };
      
      this.worker?.addEventListener('message', messageHandler);
      
      // Send command to analyze position
      this.sendCommand(`go depth ${depth} movetime ${time}`)
        .catch(error => {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', messageHandler);
          reject(error);
        });
    });
  }
  
  /**
   * Set the skill level of the engine (ELO rating)
   */
  async setSkillLevel(elo: number): Promise<void> {
    // Convert ELO to skill level (0-20)
    // Approximate formula: skill = (elo - 1000) / 90
    const skillLevel = Math.max(0, Math.min(20, Math.floor((elo - 1000) / 90)));
    
    await this.sendCommand(`setoption name Skill Level value ${skillLevel}`);
  }
  
  /**
   * Stop the current analysis
   */
  async stop(): Promise<void> {
    await this.sendCommand('stop');
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.isReady = false;
    }
  }
  
  /**
   * Send a command to the Stockfish engine
   */
  private async sendCommand(command: string): Promise<void> {
    if (!this.worker) {
      throw new Error('Stockfish engine not initialized');
    }
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, this.ENGINE_TIMEOUT);
      
      try {
        // Use the correct format for Stockfish WebWorker
        this.worker!.postMessage({
          cmd: 'command',
          param: command
        });
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      } finally {
        clearTimeout(timeout);
      }
    });
  }
  
  /**
   * Handle messages from the Stockfish worker
   */
  private handleMessage(event: MessageEvent): void {
    // We handle specific message patterns in the respective methods
    // This is a general message handler for debugging
    if (typeof event.data === 'string') {
      const data = event.data;
      
      // Log readyok and uciok messages
      if (data.includes('readyok')) {
        this.isReady = true;
        console.log('Stockfish engine is ready');
      } else if (data.includes('uciok')) {
        console.log('UCI initialization complete');
      }
    }
  }
}