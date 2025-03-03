/**
 * Worker utilities for Next.js with Turbopack
 */

// Static path to the stockfish worker - this path needs to match the location in public/
const STOCKFISH_WORKER_PATH = '/stockfish/stockfish.worker.js';
const STOCKFISH_WASM_PATH = '/stockfish/stockfish.wasm';
const STOCKFISH_JS_PATH = '/stockfish/stockfish.js';

// Maximum retries to create a worker
const MAX_RETRIES = 3;

/**
 * Check if Stockfish files exist and are accessible
 * This helps diagnose deployment issues
 */
export async function checkStockfishFiles(): Promise<boolean> {
  const filesToCheck = [
    STOCKFISH_WORKER_PATH,
    STOCKFISH_WASM_PATH,
    STOCKFISH_JS_PATH
  ];
  
  console.log('Checking Stockfish files availability...');
  
  try {
    const results = await Promise.all(
      filesToCheck.map(async (path) => {
        try {
          const response = await fetch(path, { method: 'HEAD' });
          const success = response.ok;
          
          if (success) {
            console.log(`✅ ${path} is accessible`);
          } else {
            console.error(`❌ ${path} is not accessible (HTTP ${response.status})`);
          }
          
          return { path, success, status: response.status };
        } catch (error) {
          console.error(`❌ Error checking ${path}:`, error);
          return { path, success: false, error };
        }
      })
    );
    
    // All files should be accessible
    const allFilesAccessible = results.every(r => r.success);
    
    if (!allFilesAccessible) {
      console.error('Some Stockfish files are missing or inaccessible:', 
        results.filter(r => !r.success).map(r => r.path).join(', '));
    }
    
    return allFilesAccessible;
  } catch (error) {
    console.error('Error during Stockfish files check:', error);
    return false;
  }
}

/**
 * Check if Web Workers and WebAssembly are supported in this environment
 */
export function checkBrowserCompatibility(): { workersSupported: boolean; wasmSupported: boolean } {
  // Check for Web Workers support
  const workersSupported = typeof window !== 'undefined' && 'Worker' in window;
  
  // Check for WebAssembly support
  const wasmSupported = typeof WebAssembly === 'object' && 
                        typeof WebAssembly.instantiate === 'function';
  
  // Log findings
  if (!workersSupported) {
    console.error('Web Workers are not supported in this browser.');
  }
  
  if (!wasmSupported) {
    console.error('WebAssembly is not supported in this browser.');
  }
  
  return { workersSupported, wasmSupported };
}

/**
 * Create the Stockfish worker with a static path and retry logic
 * This prevents the "TP1001 new Worker() is not statically analyse-able" error
 * and adds resilience to worker creation
 */
export function createStockfishWorker(retryCount = 0): Worker {
  try {
    // First check browser compatibility
    const { workersSupported, wasmSupported } = checkBrowserCompatibility();
    
    if (!workersSupported) {
      throw new Error('Web Workers are not supported in this browser');
    }
    
    if (!wasmSupported) {
      console.warn('WebAssembly is not supported - Stockfish may run slower in this browser');
    }
    
    // IMPORTANT: For Turbopack to properly analyze this, we must use the
    // variable directly in the Worker constructor - no dynamic paths
    console.log(`Creating Stockfish worker at path: ${STOCKFISH_WORKER_PATH} (attempt ${retryCount + 1})`);
    
    // Check for any content security policy issues
    try {
      const workerTest = new Worker('data:application/javascript,null');
      workerTest.terminate();
    } catch (error) {
      console.warn('Worker from data URL blocked, possible CSP issue:', error);
    }
    
    // Create the worker
    const worker = new Worker(STOCKFISH_WORKER_PATH);
    console.log('Worker constructor call completed');
    
    // Add more detailed error handling for the worker
    worker.onerror = (error) => {
      console.error('Stockfish worker error:', error);
      // Log more details
      console.error('Error message:', error.message);
      console.error('Error filename:', error.filename);
      console.error('Error lineno:', error.lineno);
      console.error('Error colno:', error.colno);
      
      // If we get an error, we could attempt a retry
      if (retryCount < MAX_RETRIES) {
        console.log(`Worker error, retrying (${retryCount + 1}/${MAX_RETRIES})`);
        // But we should terminate the current worker first
        worker.terminate();
        return createStockfishWorker(retryCount + 1);
      }
    };
    
    // Set a handler to confirm worker is alive - extended timeout
    let workerAlive = false;
    const pingTimeout = setTimeout(() => {
      if (!workerAlive && retryCount < MAX_RETRIES) {
        console.warn('Worker did not respond within timeout, retrying...');
        worker.terminate();
        return createStockfishWorker(retryCount + 1);
      } else if (!workerAlive) {
        console.error('Worker did not respond after maximum retries.');
        // Check if files are accessible
        checkStockfishFiles().then(filesExist => {
          if (!filesExist) {
            console.error('Stockfish files are missing or inaccessible. Please check your deployment.');
          }
        });
      }
    }, 20000);
    
    // Add diagnostic logging but don't interfere with initialization
    worker.addEventListener('message', function diagnosticHandler(e) {
      // Confirm worker is alive on first message
      if (!workerAlive) {
        workerAlive = true;
        clearTimeout(pingTimeout);
        console.log('Worker is alive! First message received.');
      }
      
      // Log message type and truncated content for debugging
      const messageType = typeof e.data;
      const messagePreview = messageType === 'string' 
        ? e.data.substring(0, 100) + (e.data.length > 100 ? '...' : '')
        : JSON.stringify(e.data).substring(0, 100) + (JSON.stringify(e.data).length > 100 ? '...' : '');
      
      console.log(`Worker message [${messageType}]:`, messagePreview);
      
      // After UCI initialization, remove this diagnostics handler
      if (typeof e.data === 'string' && e.data.includes('uciok')) {
        console.log('✅ UCI initialization complete, worker is properly configured');
        worker.removeEventListener('message', diagnosticHandler);
      }
    });
    
    // Send a test command to verify worker is functioning
    setTimeout(() => {
      if (workerAlive) {
        console.log('Sending test command to worker');
        worker.postMessage({ cmd: 'command', param: 'uci' });
      }
    }, 200);
    
    return worker;
  } catch (error) {
    console.error('Error creating Stockfish worker:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    // Check file accessibility on error
    checkStockfishFiles().then(filesExist => {
      if (!filesExist) {
        console.error('Stockfish files are missing or inaccessible. Please check your deployment.');
      }
    });
    
    // Retry logic for initialization errors
    if (retryCount < MAX_RETRIES) {
      console.log(`Worker creation failed, retrying (${retryCount + 1}/${MAX_RETRIES})`);
      return createStockfishWorker(retryCount + 1);
    }
    
    throw error;
  }
}