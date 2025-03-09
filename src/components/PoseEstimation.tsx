import React, { useRef, useEffect, useState, useCallback } from "react";
import * as tf from "@tensorflow/tfjs-core";
// Import required backends
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

// Logger utility with consistent styling
const logger = {
  info: (message: string, ...data: any[]) => {
    console.log(`%c[INFO] ${message}`, 'color: #3b82f6', ...data);
  },
  warn: (message: string, ...data: any[]) => {
    console.warn(`%c[WARN] ${message}`, 'color: #f59e0b', ...data);
  },
  error: (message: string, ...data: any[]) => {
    console.error(`%c[ERROR] ${message}`, 'color: #ef4444', ...data);
  },
  success: (message: string, ...data: any[]) => {
    console.log(`%c[SUCCESS] ${message}`, 'color: #10b981', ...data);
  }
};

// Define TypeScript interfaces
interface Keypoint {
  name: string;
  x: number;
  y: number;
  score?: number;
}

interface Creature {
  eyes: (ctx: CanvasRenderingContext2D, keypoints: Keypoint[]) => void;
  limbs: (ctx: CanvasRenderingContext2D, keypoints: Keypoint[]) => void;
}

interface CanvasSize {
  width: number;
  height: number;
}

// Simplified to just one creature
const blob: Creature = {
  eyes: (ctx, keypoints) => {
    const leftEye = keypoints.find((kp) => kp.name === "left_eye");
    const rightEye = keypoints.find((kp) => kp.name === "right_eye");

    if (leftEye && rightEye) {
      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, 10, 0, 2 * Math.PI);
      ctx.arc(rightEye.x, rightEye.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, 5, 0, 2 * Math.PI);
      ctx.arc(rightEye.x, rightEye.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "black";
      ctx.fill();
    }
  },
  limbs: (ctx, keypoints) => {
    const limbs = [
      ["left_shoulder", "left_elbow", "left_wrist"],
      ["right_shoulder", "right_elbow", "right_wrist"],
      ["left_hip", "left_knee", "left_ankle"],
      ["right_hip", "right_knee", "right_ankle"],
    ];

    limbs.forEach((limb) => {
      const points = limb
        .map((name) => keypoints.find((kp) => kp.name === name))
        .filter(Boolean) as Keypoint[];
        
      if (points.length === 3) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.quadraticCurveTo(
          points[1].x,
          points[1].y,
          points[2].x,
          points[2].y
        );
        ctx.lineWidth = 10;
        ctx.stroke();
      }
    });
  },
};

const PoseEstimation: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 640, height: 480 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = window.innerHeight - 100;
      setCanvasSize({ width, height });
    }
  }, []);

  // Initialize TensorFlow and create detector
  useEffect(() => {
    const setupTensorFlow = async () => {
      logger.info("Setting up TensorFlow.js");
      setIsLoading(true);
      
      try {
        // Initialize TensorFlow.js
        await tf.ready();
        logger.info("TensorFlow.js is ready");
        
        // Set backend to WebGL for better performance
        await tf.setBackend('webgl');
        logger.info("Using backend:", tf.getBackend());
        
        // Get model path based on environment
        const baseUrl = import.meta.env.DEV ? '' : '/dancing-creatures';
        const modelPath = `${baseUrl}/models/movenet/multipose/lightning/1/model.json`;
        logger.info("Loading model from:", modelPath);
        
        // Create detector configuration
        const detectorConfig = {
          modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
          modelUrl: modelPath,
          enableSmoothing: true,
          multiPoseMaxDimension: 256,
          minPoseScore: 0.2
        };
        
        // Create detector
        const newDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet, 
          detectorConfig
        );
        
        logger.success("Model loaded successfully");
        setDetector(newDetector);
      } catch (error) {
        logger.error("Error setting up TensorFlow:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    setupTensorFlow();
    
    // Cleanup
    return () => {
      if (detector) {
        detector.dispose();
      }
    };
  }, []);

  // Set up canvas size and handle window resizing
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  // Set up camera
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play();
            setIsVideoReady(true);
          };
        }
      } catch (error) {
        logger.error("Error setting up camera:", error);
        setIsLoading(false);
      }
    };

    setupCamera();
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      const video = videoRef.current;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Run pose detection loop
  useEffect(() => {
    let animationFrameId: number;
    let isDetecting = false;
  
    const detectPose = async () => {
      // Skip if not ready
      if (
        !detector ||
        !videoRef.current ||
        !canvasRef.current ||
        !isVideoReady ||
        isDetecting ||
        isLoading
      ) {
        animationFrameId = requestAnimationFrame(detectPose);
        return;
      }
  
      isDetecting = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
  
      if (!ctx) {
        logger.warn("Could not get canvas context");
        isDetecting = false;
        animationFrameId = requestAnimationFrame(detectPose);
        return;
      }
  
      // Clear previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      // Show video feed in debug mode
      if (debugMode) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      }
  
      try {
        // Estimate poses
        const poses = await detector.estimatePoses(video, {
          maxPoses: 2,
          flipHorizontal: false
        });
        
        // Process detected poses
        poses.forEach((pose, index) => {
          // Transform keypoints to canvas coordinates
          const keypoints = pose.keypoints.map((keypoint) => ({
            name: keypoint.name || 'unknown',
            x: canvas.width - (keypoint.x / video.videoWidth) * canvas.width,
            y: (keypoint.y / video.videoHeight) * canvas.height,
            score: keypoint.score
          }));
  
          // Use different colors for each person
          const hue = (index * 137) % 360; // Golden ratio ensures good color distribution
          ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.7)`;
  
          // Draw the creature
          blob.limbs(ctx, keypoints);
          blob.eyes(ctx, keypoints);
  
          // Draw debug information if enabled
          if (debugMode) {
            keypoints.forEach((keypoint) => {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
              ctx.fill();
              ctx.fillStyle = "white";
              ctx.fillText(keypoint.name, keypoint.x + 5, keypoint.y - 5);
            });
          }
        });
      } catch (error) {
        logger.error("Error in pose estimation:", error);
      }
  
      isDetecting = false;
      animationFrameId = requestAnimationFrame(detectPose);
    };
  
    // Start detection loop
    detectPose();
  
    // Cleanup animation frame on unmount
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    detector,
    isVideoReady,
    debugMode,
    canvasSize,
    isLoading,
  ]);

  // Toggle debug mode
  const toggleDebugMode = useCallback(() => setDebugMode((prev) => !prev), []);

  // UI styles
  const containerStyle = {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    position: "relative" as const,
    backgroundColor: "#000"
  };

  const canvasStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  };

  const loadingStyle = {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "white",
    padding: "20px",
    borderRadius: "10px",
    textAlign: "center" as const
  };

  const controlsStyle = { 
    position: "absolute" as const, 
    bottom: "20px", 
    right: "20px", 
    zIndex: 10 
  };

  const buttonStyle = { 
    padding: "8px 16px",
    backgroundColor: "rgba(59, 130, 246, 0.7)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    backdropFilter: "blur(4px)"
  };

  const titleStyle = {
    position: "absolute" as const,
    top: "10px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "white",
    textShadow: "0 0 5px rgba(0,0,0,0.7)",
    fontSize: "1.2rem",
    fontWeight: "bold",
    opacity: 0.7,
    zIndex: 10
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Hidden video element for camera feed */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        width={canvasSize.width}
        height={canvasSize.height}
      />
      
      {/* Canvas for drawing */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={canvasStyle}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div style={loadingStyle}>
          <p>Loading model...</p>
          <p>This may take a moment</p>
        </div>
      )}
      
      {/* Debug controls */}
      <div style={controlsStyle}>
        <button onClick={toggleDebugMode} style={buttonStyle}>
          {debugMode ? "Hide Debug" : "Debug"}
        </button>
      </div>
      
      {/* Title */}
      <div style={titleStyle}>
        Dancing Creatures
      </div>
    </div>
  );
};

export default PoseEstimation;