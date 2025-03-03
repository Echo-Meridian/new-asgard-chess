
/**
 * Stockfish WebWorker shim
 */

// Import the Stockfish WASM module
importScripts('stockfish.js');

// Create the Stockfish engine
const stockfish = STOCKFISH();

// Set up messaging
stockfish.addMessageListener((line) => {
  postMessage(line);
});

// Listen for messages from the main thread
self.onmessage = (e) => {
  const message = e.data;
  
  if (typeof message === 'object' && message.cmd) {
    switch (message.cmd) {
      case 'command':
        // Send a UCI command to the engine
        stockfish.postMessage(message.param);
        break;
        
      default:
        console.error('Unknown command:', message.cmd);
        break;
    }
  } else if (typeof message === 'string') {
    // Direct string message (legacy support)
    stockfish.postMessage(message);
  }
};

// Let the main thread know the worker is ready
postMessage('Worker initialized');
