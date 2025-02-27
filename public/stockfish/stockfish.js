/**
 * Mock Stockfish Worker for Chess AI Integration
 * This file simulates the behavior of the Stockfish chess engine's Web Worker interface.
 */

// Ensure we're in a worker context
const isWorker = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;

// If we're not in a worker, create a minimal worker-like environment
if (!isWorker) {
  // This will only happen if the file is loaded directly in a browser
  console.error('stockfish.js should be loaded as a Web Worker');
}

// Mock Stockfish State
const engine = {
  initialized: false,
  position: 'startpos',
  searching: false,
  skill: 20,
  depth: 15,
  searchDepth: 10,
  
  // Simple map of common positions to "best" moves for the mock engine
  commonPositions: {
    'startpos': ['e2e4', 'd2d4', 'g1f3', 'c2c4'], // Common opening moves
    'e2e4': ['e7e5', 'c7c5', 'e7e6', 'c7c6'],  // Common responses to e4
    'd2d4': ['d7d5', 'g8f6', 'e7e6', 'c7c5'],  // Common responses to d4
    'g1f3': ['g8f6', 'd7d5', 'c7c5'],          // Common responses to Nf3
    'c2c4': ['e7e5', 'c7c5', 'g8f6']           // Common responses to c4
  }
};

// Helper function to process UCI commands
function processCommand(cmd) {
  const tokens = cmd.trim().split(/\s+/);
  const command = tokens[0];
  
  switch (command) {
    case 'uci':
      return handleUCI();
    case 'isready':
      return handleIsReady();
    case 'position':
      return handlePosition(cmd);
    case 'go':
      return handleGo(cmd);
    case 'stop':
      return handleStop();
    case 'setoption':
      return handleSetOption(cmd);
    case 'ucinewgame':
      return handleNewGame();
    default:
      console.log('Unknown command:', cmd);
      return null;
  }
}

// UCI Protocol Handlers
function handleUCI() {
  return [
    'id name Stockfish Mock 15',
    'id author Claude AI',
    'option name Skill Level type spin default 20 min 0 max 20',
    'option name Search Depth type spin default 15 min 1 max 30',
    'uciok'
  ];
}

function handleIsReady() {
  engine.initialized = true;
  return ['readyok'];
}

function handlePosition(cmd) {
  // Extract position information
  if (cmd.includes('startpos')) {
    engine.position = 'startpos';
    
    // Check for moves after startpos
    if (cmd.includes('moves')) {
      const movesStr = cmd.split('moves ')[1];
      if (movesStr) {
        const moves = movesStr.split(' ');
        // Only track the last position for simplicity in the mock
        if (moves.length > 0) {
          engine.position = moves[moves.length - 1];
        }
      }
    }
  } else if (cmd.includes('fen')) {
    // For mock purposes, we're not really parsing FEN correctly
    engine.position = 'custom';
  }
  
  return null; // No response needed for position command
}

function handleGo(cmd) {
  engine.searching = true;
  
  // Parse parameters
  const depthMatch = cmd.match(/depth (\d+)/);
  const movetime = cmd.match(/movetime (\d+)/);
  
  const depth = depthMatch ? parseInt(depthMatch[1]) : engine.searchDepth;
  const thinkTime = movetime ? parseInt(movetime[1]) : 1000;
  
  // Simulate thinking
  const expectedLines = Math.min(depth, 5); // Generate up to 5 analysis lines
  
  // Schedule analysis output with varying depths
  for (let i = 1; i <= expectedLines; i++) {
    const currentDepth = Math.floor((depth * i) / expectedLines);
    const delay = Math.floor((thinkTime * i) / (expectedLines + 1));
    
    setTimeout(() => {
      if (!engine.searching) return; // Stop if search was cancelled
      
      const score = 10 + Math.floor(Math.random() * 40); // Random score between 10-50 centipawns
      const pv = generateRandomPV(3 + i); // Generate random principal variation
      
      self.postMessage(`info depth ${currentDepth} score cp ${score} pv ${pv.join(' ')}`);
    }, delay);
  }
  
  // Schedule the final bestmove response
  setTimeout(() => {
    if (!engine.searching) return; // Stop if search was cancelled
    
    const bestMove = selectBestMove();
    self.postMessage(`bestmove ${bestMove}`);
    engine.searching = false;
  }, thinkTime);
  
  return null; // Async responses will be sent later
}

function handleStop() {
  engine.searching = false;
  
  // If we were searching, send a best move immediately
  const bestMove = selectBestMove();
  return [`bestmove ${bestMove}`];
}

function handleSetOption(cmd) {
  const nameMatch = cmd.match(/name\s+([^\s]+)(?:\s+([^\s]+))?/);
  const valueMatch = cmd.match(/value\s+(\S+)/);
  
  if (!nameMatch || !valueMatch) return null;
  
  const option = (nameMatch[2] ? `${nameMatch[1]} ${nameMatch[2]}` : nameMatch[1]).toLowerCase();
  const value = valueMatch[1];
  
  switch (option) {
    case 'skill level':
      engine.skill = parseInt(value);
      break;
    case 'search depth':
      engine.searchDepth = parseInt(value);
      break;
    default:
      console.log(`Unknown option: ${option}`);
  }
  
  return null; // No response needed for setoption command
}

function handleNewGame() {
  engine.position = 'startpos';
  return null; // No response needed
}

// Helper functions for move generation
function selectBestMove() {
  // Check if we have predetermined moves for this position
  if (engine.position in engine.commonPositions) {
    const moves = engine.commonPositions[engine.position];
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  // Otherwise, generate a random plausible move
  return generateRandomMove();
}

function generateRandomMove() {
  const pieces = ['p', 'n', 'b', 'r', 'q', 'k'];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  const fromFile = files[Math.floor(Math.random() * files.length)];
  const fromRank = ranks[Math.floor(Math.random() * ranks.length)];
  const toFile = files[Math.floor(Math.random() * files.length)];
  const toRank = ranks[Math.floor(Math.random() * ranks.length)];
  
  // Avoid same-square moves
  if (fromFile === toFile && fromRank === toRank) {
    return generateRandomMove();
  }
  
  return `${fromFile}${fromRank}${toFile}${toRank}`;
}

function generateRandomPV(length) {
  const pv = [];
  for (let i = 0; i < length; i++) {
    pv.push(generateRandomMove());
  }
  return pv;
}

// Set up the worker message handler
self.onmessage = function(event) {
  const cmd = event.data;
  
  // Process the command
  const responses = processCommand(cmd);
  
  // Send back any responses
  if (responses) {
    for (const response of responses) {
      self.postMessage(response);
    }
  }
};

// Announce we're ready
console.log('Mock Stockfish worker initialized');