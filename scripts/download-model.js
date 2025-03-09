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

// Function to download a file with retries
function downloadFile(url, dest, retries = 3, timeout = 60000) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting download: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, response => {
      // Handle redirects (status codes 301, 302, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        logger.info(`Following redirect: ${url} -> ${response.headers.location}`);
        // Close the current file stream
        file.close();
        // Delete the empty file
        fs.unlink(dest, () => {});
        // Follow the redirect by calling downloadFile again with the new URL
        downloadFile(response.headers.location, dest, retries, timeout).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        logger.error(`Failed to download ${url}, status code: ${response.statusCode}`);
        file.close();
        fs.unlink(dest, () => {});
        
        if (retries > 0) {
          logger.info(`Retrying download (${retries} attempts left)...`);
          setTimeout(() => {
            downloadFile(url, dest, retries - 1, timeout).then(resolve).catch(reject);
          }, 1000);
          return;
        }
        
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        // Log less frequently to reduce console spam
        if (downloadedBytes % 500000 < chunk.length) {
          logger.info(`Downloading ${url}: ${Math.round(downloadedBytes/1024)} KB received`);
        }
      });
      
      file.on('finish', () => {
        file.close(() => {
          logger.success(`Downloaded: ${dest} (${Math.round(downloadedBytes/1024)} KB)`);
          resolve();
        });
      });
    }).on('error', err => {
      file.close();
      fs.unlink(dest, () => {}); // Delete the file on error
      logger.error(`Error downloading ${url}:`, err);
      
      if (retries > 0) {
        logger.info(`Retrying download (${retries} attempts left)...`);
        setTimeout(() => {
          downloadFile(url, dest, retries - 1, timeout).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });
    
    // Set a timeout for the request
    request.setTimeout(timeout, () => {
      request.abort();
      file.close();
      fs.unlink(dest, () => {});
      logger.error(`Request timeout for ${url}`);
      
      if (retries > 0) {
        logger.info(`Retrying download (${retries} attempts left)...`);
        setTimeout(() => {
          downloadFile(url, dest, retries - 1, timeout).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error(`Request timeout for ${url}`));
      }
    });
  });
}

// URLs for single pose model - using Kaggle direct URLs based on your logs
const singlePoseModelUrl = 'https://www.kaggle.com/models/google/movenet/tfJs/singlepose-lightning/4/model.json?tfjs-format=file&tfhub-redirect=true';
const singlePoseShardUrl1 = 'https://www.kaggle.com/models/google/movenet/tfJs/singlepose-lightning/4/group1-shard1of2.bin?tfjs-format=file&tfhub-redirect=true';
const singlePoseShardUrl2 = 'https://www.kaggle.com/models/google/movenet/tfJs/singlepose-lightning/4/group1-shard2of2.bin?tfjs-format=file&tfhub-redirect=true';

// URLs for multi pose model - using Kaggle direct URLs based on your logs
const multiPoseModelUrl = 'https://www.kaggle.com/models/google/movenet/tfJs/multipose-lightning/1/model.json?tfjs-format=file&tfhub-redirect=true';
const multiPoseShardUrl1 = 'https://www.kaggle.com/models/google/movenet/tfJs/multipose-lightning/1/group1-shard1of3.bin?tfjs-format=file&tfhub-redirect=true';
const multiPoseShardUrl2 = 'https://www.kaggle.com/models/google/movenet/tfJs/multipose-lightning/1/group1-shard2of3.bin?tfjs-format=file&tfhub-redirect=true';
const multiPoseShardUrl3 = 'https://www.kaggle.com/models/google/movenet/tfJs/multipose-lightning/1/group1-shard3of3.bin?tfjs-format=file&tfhub-redirect=true';

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