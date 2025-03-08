import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create directories
const modelsDir = path.join(__dirname, '../public/models/movenet/singlepose/lightning/4');
const multiPoseDir = path.join(__dirname, '../public/models/movenet/multipose/lightning/1');

// Create directories if they don't exist
fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(multiPoseDir, { recursive: true });

// Function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
        console.log(`Downloaded: ${dest}`);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// URLs for single pose model
const singlePoseUrls = [
  'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json?tfjs-format=file',
  'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/group1-shard1of2.bin?tfjs-format=file',
  'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/group1-shard2of2.bin?tfjs-format=file'
];

// URLs for multi pose model
const multiPoseUrls = [
  'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/model.json?tfjs-format=file',
  'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard1of3.bin?tfjs-format=file',
  'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard2of3.bin?tfjs-format=file',
  'https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1/group1-shard3of3.bin?tfjs-format=file'
];

// Download single pose model files
async function downloadSinglePoseModel() {
  try {
    for (const url of singlePoseUrls) {
      const filename = url.split('/').pop().split('?')[0];
      await downloadFile(url, path.join(modelsDir, filename));
    }
    console.log('Single pose model downloaded successfully');
  } catch (error) {
    console.error('Error downloading single pose model:', error);
  }
}

// Download multi pose model files
async function downloadMultiPoseModel() {
  try {
    for (const url of multiPoseUrls) {
      const filename = url.split('/').pop().split('?')[0];
      await downloadFile(url, path.join(multiPoseDir, filename));
    }
    console.log('Multi pose model downloaded successfully');
  } catch (error) {
    console.error('Error downloading multi pose model:', error);
  }
}

// Run downloads
async function downloadModels() {
  await downloadSinglePoseModel();
  await downloadMultiPoseModel();
}

downloadModels(); 