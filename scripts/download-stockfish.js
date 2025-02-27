#!/usr/bin/env node

/**
 * Script to download Stockfish WASM files
 * 
 * Usage: 
 *   node scripts/download-stockfish.js
 * 
 * This will download the necessary Stockfish files to the public/stockfish directory
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
// Using a known working release tag
const STOCKFISH_RELEASE = 'sf-nnue-0.22.1';
const BASE_URL = `https://github.com/lichess-org/stockfish.wasm/releases/download/${STOCKFISH_RELEASE}`;
const FILES = [
  'stockfish.js',
  'stockfish.wasm', 
  'stockfish.worker.js'
];
const TARGET_DIR = path.resolve(__dirname, '../public/stockfish');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  console.log(`Creating directory: ${TARGET_DIR}`);
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

/**
 * Download a file from a URL to a local path
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${filePath}...`);
    
    const file = fs.createWriteStream(filePath);
    
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded ${filePath}`);
        resolve();
      });
    }).on('error', err => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log(`Downloading Stockfish WASM files (${STOCKFISH_RELEASE})...`);
  
  try {
    // Download each file
    for (const file of FILES) {
      const url = `${BASE_URL}/${file}`;
      const filePath = path.join(TARGET_DIR, file);
      
      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`File ${filePath} already exists, skipping.`);
        continue;
      }
      
      await downloadFile(url, filePath);
    }
    
    console.log('\n✅ All Stockfish files downloaded successfully!');
    console.log(`Files are located in: ${TARGET_DIR}`);
    
  } catch (error) {
    console.error('\n❌ Error downloading Stockfish files:', error.message);
    process.exit(1);
  }
}

// Run the script
main();