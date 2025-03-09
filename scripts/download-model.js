import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// Add a logger utility
const logger = {
  info: (message, ...data) => {
    console.log(`[INFO] ${message}`, ...data);
  },
  warn: (message, ...data) => {
    console.warn(`[WARN] ${message}`, ...data);
  },
  error: (message, ...data) => {
    console.error(`[ERROR] ${message}`, ...data);
  },
  success: (message, ...data) => {
    console.log(`[SUCCESS] ${message}`, ...data);
  }
};

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create directories
logger.info("Setting up model directories");
const modelsDir = path.join(__dirname, '../public/models/movenet/singlepose/lightning/4');
const multiPoseDir = path.join(__dirname, '../public/models/movenet/multipose/lightning/1');

// Create directories if they don't exist
logger.info(`Creating directory: ${modelsDir}`);
fs.mkdirSync(modelsDir, { recursive: true });
logger.info(`Creating directory: ${multiPoseDir}`);
fs.mkdirSync(multiPoseDir, { recursive: true });

// Function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting download: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode !== 200) {
        logger.error(`Failed to download ${url}, status code: ${response.statusCode}`);
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        logger.info(`Downloading ${url}: ${downloadedBytes} bytes received`);
      });
      
      file.on('finish', () => {
        file.close(() => {
          logger.success(`Downloaded: ${dest} (${downloadedBytes} bytes)`);
          resolve();
        });
      });
    }).on('error', err => {
      fs.unlink(dest, () => {}); // Delete the file on error
      logger.error(`Error downloading ${url}:`, err);
      reject(err);
    });
  });
}

// URLs for single pose model
const singlePoseModelUrl = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json?tfjs-format=file';
const singlePoseShardUrl1 = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/group1-shard1of2.bin?tfjs-format=file';
const singlePoseShardUrl2 = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/group1-shard2of2.bin?tfjs-format=file';

// URLs for multi pose model
const multiPoseModelUrl = 'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/model.json?tfjs-format=file';
const multiPoseShardUrl1 = 'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard1of3.bin?tfjs-format=file';
const multiPoseShardUrl2 = 'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard2of3.bin?tfjs-format=file';
const multiPoseShardUrl3 = 'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard3of3.bin?tfjs-format=file';

// Download models
async function downloadModels() {
  try {
    // Download single pose model
    await downloadFile(singlePoseModelUrl, path.join(modelsDir, 'model.json'));
    await downloadFile(singlePoseShardUrl1, path.join(modelsDir, 'group1-shard1of2.bin'));
    await downloadFile(singlePoseShardUrl2, path.join(modelsDir, 'group1-shard2of2.bin'));
    
    // Download multi pose model
    await downloadFile(multiPoseModelUrl, path.join(multiPoseDir, 'model.json'));
    await downloadFile(multiPoseShardUrl1, path.join(multiPoseDir, 'group1-shard1of3.bin'));
    await downloadFile(multiPoseShardUrl2, path.join(multiPoseDir, 'group1-shard2of3.bin'));
    await downloadFile(multiPoseShardUrl3, path.join(multiPoseDir, 'group1-shard3of3.bin'));
    
    logger.success('All models downloaded successfully');
  } catch (error) {
    logger.error('Error downloading models:', error);
  }
}

downloadModels(); 