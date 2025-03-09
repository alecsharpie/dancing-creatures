# Dancing Creatures 🕺💃

A fun interactive web application that transforms your movements into colorful animated creatures in real-time. Using TensorFlow.js and the MoveNet pose detection model, this project creates a playful experience where your body becomes a living digital puppet.

![Dancing Creatures Demo](screenshot.png)

## Features

- Real-time pose detection using TensorFlow.js
- Animated creature visualization that follows your movements
- Debug mode to visualize detected keypoints
- Works in any modern browser with camera access

## Demo

Visit the live demo: [Dancing Creatures](https://alecsharpie.github.io/dancing-creatures)

## Setup

### Prerequisites

- Node.js
- npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/alecsharpie/dancing-creatures.git
   cd dancing-creatures
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Get the TensorFlow.js MoveNet model:

   **Option 1: Manual download**
   - Visit [Kaggle Models: Google MoveNet](https://www.kaggle.com/models/google/movenet/tfJs?select=model.json)
   - Navigate to TensorFlow.js > multipose-lightning > File Explorer
   - Download all files (model.json and the shard files)
   - Create directory: `public/models/movenet/multipose/lightning/1/`
   - Place the downloaded files in this directory

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Building and Deployment

Build for production:

```
npm run build
```

This will create a `dist` directory with the production build. You can then deploy this directory to your preferred static site hosting service.

To deploy to GitHub Pages:

```
npm run deploy
```

---

## Technology Stack

- React 19
- TypeScript
- TensorFlow.js
- Vite
- HTML5 Canvas API

---

## Development Notes

This project was bootstrapped with Vite using the React TypeScript template.