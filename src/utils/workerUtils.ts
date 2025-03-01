/**
 * Worker utilities for Next.js with Turbopack
 */

// Static path to the stockfish worker
const STOCKFISH_WORKER_PATH = '/stockfish/stockfish.js';

/**
 * Create the Stockfish worker with a static path
 * This prevents the "TP1001 new Worker() is not statically analyse-able" error
 */
export function createStockfishWorker(): Worker {
  try {
    // IMPORTANT: For Turbopack to properly analyze this, we must use the
    // variable directly in the Worker constructor - no dynamic paths
    console.log('Creating Stockfish worker at path:', STOCKFISH_WORKER_PATH);
    const worker = new Worker(STOCKFISH_WORKER_PATH);
    
    // Log only the first few messages to confirm the worker is alive
    // but don't keep the handler to avoid interfering with stockfish.ts
    let messageCount = 0;
    worker.onmessage = function(e) {
      if (messageCount < 3) {
        console.log('Worker initialization message:', e.data);
        messageCount++;
      } else {
        // After logging a few messages, remove our handler
        // This allows stockfish.ts to set its own handler
        worker.onmessage = null;
      }
    };
    
    // Test the worker with a simple UCI command
    worker.postMessage('uci');
    
    return worker;
  } catch (error) {
    console.error('Error creating Stockfish worker:', error);
    throw error;
  }
}