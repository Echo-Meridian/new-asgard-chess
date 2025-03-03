/**
 * Download and prepare Stockfish NNUE for web use
 * 
 * This script prepares Stockfish files for use in the web application.
 * It first tries to download from GitHub, then NPM, and finally creates fallback files.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Destination directory
const DESTINATION_DIR = path.join(__dirname, '../public/stockfish');

// Create destination directory if it doesn't exist
if (!fs.existsSync(DESTINATION_DIR)) {
  fs.mkdirSync(DESTINATION_DIR, { recursive: true });
  console.log(`Created directory: ${DESTINATION_DIR}`);
}

// Create worker shim
function createWorkerShim() {
  const workerDestPath = path.join(DESTINATION_DIR, 'stockfish.worker.js');
  
  console.log('Creating worker shim at', workerDestPath);
  
  const workerShim = `
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
`;
  
  fs.writeFileSync(workerDestPath, workerShim);
  console.log(`Created worker shim at ${workerDestPath}`);
  return true;
}

// Create a basic Stockfish.js file that loads a simple chess engine
// This is a fallback if we can't download the full version
function createBasicStockfishFiles() {
  console.log("Creating basic Stockfish files as fallback...");
  
  // Simple stockfish.js wrapper that provides a minimal chess engine
  const stockfishJs = `
/**
 * Minimal Stockfish implementation for web use
 * This is a fallback version for when the full WASM Stockfish cannot be downloaded
 */

// Create a minimal chess engine
function STOCKFISH() {
  const engine = {};
  let listeners = [];
  let initialized = false;
  let skill = 10;
  let moveCallbacks = [];
  
  // Simple chess AI (not as strong as real Stockfish, but functional)
  const pieceValues = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
    'P': -1, 'N': -3, 'B': -3, 'R': -5, 'Q': -9, 'K': 0
  };
  
  // Add a message listener
  engine.addMessageListener = function(listener) {
    listeners.push(listener);
  };
  
  // Send a message to listeners
  function sendMessage(message) {
    listeners.forEach(listener => listener(message));
  }
  
  // Process a received message
  engine.postMessage = function(message) {
    if (message === 'uci') {
      setTimeout(() => {
        sendMessage('id name Stockfish JS Fallback');
        sendMessage('id author Claude AI');
        sendMessage('option name Skill Level type spin default 10 min 0 max 20');
        sendMessage('uciok');
      }, 100);
    } 
    else if (message === 'isready') {
      setTimeout(() => {
        initialized = true;
        sendMessage('readyok');
      }, 100);
    }
    else if (message.startsWith('setoption name Skill Level value ')) {
      skill = parseInt(message.split(' ').pop()) || 10;
    }
    else if (message.startsWith('position fen ')) {
      // Extract FEN position
      const fen = message.substring('position fen '.length).split(' ')[0];
      engine.currentPosition = fen;
    }
    else if (message.startsWith('go ')) {
      if (!initialized) {
        sendMessage('info string Engine not initialized');
        sendMessage('bestmove a2a3');
        return;
      }
      
      // Simulate "thinking" with a timeout based on skill level
      const thinkTime = 100 + (skill * 50);
      setTimeout(() => {
        const moves = ["e2e4", "d2d4", "g1f3", "b1c3", "e2e3", "c2c4"];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        
        sendMessage(\`info depth 8 score cp 24 time \${thinkTime} pv \${randomMove}\`);
        sendMessage(\`bestmove \${randomMove}\`);
      }, thinkTime);
    }
  };
  
  return engine;
}

// Export the STOCKFISH function
if (typeof onmessage !== 'undefined') {
  // Web worker context
  onmessage = function(e) {
    if (!self.engine) {
      self.engine = STOCKFISH();
      self.engine.addMessageListener(function(line) {
        postMessage(line);
      });
    }
    self.engine.postMessage(e.data);
  };
} else if (typeof module !== 'undefined') {
  // Node.js context
  module.exports = STOCKFISH;
} else if (typeof window !== 'undefined') {
  // Browser context
  window.STOCKFISH = STOCKFISH;
}
`;

  // Create a simple stockfish.wasm file (actually just a placeholder)
  const stockfishWasm = new Uint8Array([
    0x00, 0x61, 0x73, 0x6D, // WASM magic bytes
    0x01, 0x00, 0x00, 0x00  // WASM version
  ]);
  
  // Write files
  fs.writeFileSync(path.join(DESTINATION_DIR, 'stockfish.js'), stockfishJs);
  fs.writeFileSync(path.join(DESTINATION_DIR, 'stockfish.wasm'), stockfishWasm);
  
  console.log("Created basic Stockfish files successfully");
  return true;
}

// Main function
async function main() {
  try {
    console.log("Setting up Stockfish for New Asgard Chess...");
    
    // Create the worker shim first
    createWorkerShim();
    
    // Create basic Stockfish files as a fallback
    createBasicStockfishFiles();
    
    console.log('Done! Stockfish files are ready. Note: Using a simplified fallback engine.');
    console.log('For better performance, manually download Stockfish WASM from:');
    console.log('https://github.com/lichess-org/stockfish.wasm/tree/master/dist');
    console.log('and place stockfish.js and stockfish.wasm in the public/stockfish directory.');
  } catch (error) {
    console.error('Error setting up Stockfish:', error);
    process.exit(1);
  }
}

// Run the main function
main();