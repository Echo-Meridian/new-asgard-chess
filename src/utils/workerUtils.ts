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
  // IMPORTANT: For Turbopack to properly analyze this, we must use the
  // variable directly in the Worker constructor - no dynamic paths
  return new Worker(STOCKFISH_WORKER_PATH);
}