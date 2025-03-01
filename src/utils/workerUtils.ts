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
    
    // Setup test message to verify worker is functioning
    worker.onmessage = function(e) {
      console.log('Worker message received:', e.data);
    };
    
    // Test the worker with a simple UCI command
    worker.postMessage('uci');
    
    return worker;
  } catch (error) {
    console.error('Error creating Stockfish worker:', error);
    throw error;
  }
}