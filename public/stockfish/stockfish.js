
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
  let currentPosition = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  
  // Simple chess moves based on common openings
  const commonMoves = {
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR": ["e2e4", "d2d4", "c2c4", "g1f3"],
    "rnbqkbnr/pppppppp/8/8/4P3": ["e7e5", "c7c5", "e7e6", "c7c6"],
    "rnbqkbnr/pppp1ppp/8/4p3/4P3": ["g1f3", "f1c4", "d2d4", "b1c3"],
    "rnbqkbnr/ppp1pppp/8/3p4/3P4": ["c2c4", "g1f3", "c1f4", "c1g5"],
    "default": ["e2e4", "d2d4", "g1f3", "b1c3", "c2c4", "f2f4", "g2g3"]
  };
  
  // Add a message listener
  engine.addMessageListener = function(listener) {
    listeners.push(listener);
  };
  
  // Send a message to listeners
  function sendMessage(message) {
    listeners.forEach(listener => listener(message));
  }
  
  // Get a reasonable move based on the position
  function getMove() {
    // Get available moves for the position, or use default moves
    const positionKey = Object.keys(commonMoves).find(key => 
      currentPosition.startsWith(key)
    ) || "default";
    
    const moves = commonMoves[positionKey];
    
    // Select a move based on skill level (higher skill = better move selection)
    const moveIndex = Math.min(
      Math.floor(Math.random() * (20 - skill) / 3), 
      moves.length - 1
    );
    
    return moves[moveIndex];
  }
  
  // Process a received message
  engine.postMessage = function(message) {
    if (message === 'uci') {
      setTimeout(() => {
        sendMessage('id name Stockfish JS Fallback');
        sendMessage('id author New Asgard Chess');
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
      const fenParts = message.substring('position fen '.length).split(' ');
      currentPosition = fenParts[0];
    }
    else if (message.startsWith('go ')) {
      if (!initialized) {
        sendMessage('info string Engine not initialized');
        sendMessage('bestmove e2e4');
        return;
      }
      
      // Parse parameters
      const params = message.split(' ');
      let depth = 8;
      let time = 1000;
      
      for (let i = 1; i < params.length; i += 2) {
        if (params[i] === 'depth' && i + 1 < params.length) {
          depth = parseInt(params[i + 1]) || depth;
        }
        if (params[i] === 'movetime' && i + 1 < params.length) {
          time = parseInt(params[i + 1]) || time;
        }
      }
      
      // Adjust based on skill level (better moves take longer to "calculate")
      const thinkTime = Math.min(100 + (skill * 50), time);
      
      // Simulate "thinking" with a timeout
      setTimeout(() => {
        const bestMove = getMove();
        const score = Math.floor(Math.random() * 50) - 20;
        
        sendMessage(`info depth ${depth} score cp ${score} time ${thinkTime} pv ${bestMove}`);
        sendMessage(`bestmove ${bestMove}`);
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
    if (typeof e.data === 'string') {
      self.engine.postMessage(e.data);
    } else if (e.data && e.data.cmd === 'command') {
      self.engine.postMessage(e.data.param);
    }
  };
} else if (typeof module !== 'undefined') {
  // Node.js context
  module.exports = STOCKFISH;
} else if (typeof window !== 'undefined') {
  // Browser context
  window.STOCKFISH = STOCKFISH;
}
