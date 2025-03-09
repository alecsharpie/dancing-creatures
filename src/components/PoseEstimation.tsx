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

// Add this interface after the other interfaces
interface TrackedPose {
  id: string;
  keypoints: Keypoint[];
  lastSeen: number;
  hue: number;
}

// Replace the existing blob creature with this optimized version
const blob: Creature = {
  eyes: (ctx, keypoints) => {
    const leftEye = keypoints.find((kp) => kp.name === "left_eye");
    const rightEye = keypoints.find((kp) => kp.name === "right_eye");

    if (leftEye && rightEye) {
      // Draw simple white circles for eyes
      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, 10, 0, 2 * Math.PI);
      ctx.arc(rightEye.x, rightEye.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
      
      // Draw simple centered pupils
      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, 4, 0, 2 * Math.PI);
      ctx.arc(rightEye.x, rightEye.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "black";
      ctx.fill();
    }
  },
  limbs: (ctx, keypoints) => {
    // Set line style
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Get chest area points
    const leftShoulder = keypoints.find(kp => kp.name === "left_shoulder");
    const rightShoulder = keypoints.find(kp => kp.name === "right_shoulder");

    // Draw simplified chest wiggles if we have the shoulder points
    if (leftShoulder && rightShoulder) {
      const chestCenterX = (leftShoulder.x + rightShoulder.x) / 2;
      const chestCenterY = (leftShoulder.y + rightShoulder.y) / 2 + 20;
      const chestWidth = Math.abs(leftShoulder.x - rightShoulder.x) * 0.8;
      
      // Draw fewer, simpler wiggles
      const hairCount = 5
      const hairSpacing = chestWidth / (hairCount - 1);
      
      ctx.lineWidth = 3; // Thinner lines for wiggles
      
      for (let i = 0; i < hairCount; i++) {
        // Slight position variation
        const offsetX = Math.sin(i * 2.5) * 3;
        const offsetY = Math.cos(i * 1.7) * 2;
        const hairX = chestCenterX - chestWidth/2 + i * hairSpacing + offsetX;
        
        // Shorter length
        const hairLength = 10 + Math.sin(i * 0.8) * 5;
        
        ctx.beginPath();
        ctx.moveTo(hairX, chestCenterY + offsetY);
        
        // Simpler wiggle pattern with fewer curls
        const curlTightness = 5 + Math.sin(i) * 2;
        const curlCount = 2; // Fixed smaller number of curls
        
        // Simple alternating direction
        const curlDirection = i % 2 === 0 ? 1 : -1;
        
        for (let j = 0; j <= curlCount; j++) {
          const t = j / curlCount;
          const curlX = hairX + Math.sin(t * Math.PI * 2 * curlDirection) * curlTightness;
          const curlY = chestCenterY + offsetY + t * hairLength;
          
          if (j === 0) {
            ctx.lineTo(curlX, curlY);
          } else {
            // Simpler control points with less wiggle
            ctx.quadraticCurveTo(
              hairX + Math.sin((j-0.5)/curlCount * Math.PI * 2 * curlDirection) * curlTightness,
              chestCenterY + offsetY + (j-0.5)/curlCount * hairLength,
              curlX, 
              curlY
            );
          }
        }
        
        ctx.stroke();
      }
      
      // Reset line width for limbs
      ctx.lineWidth = 8;
    }
    
    // Draw left side as one continuous bezier curve
    const leftSide = [
      "left_wrist", "left_elbow", "left_shoulder", 
      "left_hip", "left_knee", "left_ankle"
    ];
    
    const leftPoints = leftSide
      .map(name => keypoints.find(kp => kp.name === name))
      .filter(Boolean) as Keypoint[];
    
    if (leftPoints.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
      
      // Draw smooth curve through all points
      for (let i = 1; i < leftPoints.length - 1; i++) {
        const xc = (leftPoints[i].x + leftPoints[i+1].x) / 2;
        const yc = (leftPoints[i].y + leftPoints[i+1].y) / 2;
        ctx.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, xc, yc);
      }
      
      // Connect to the last point
      ctx.quadraticCurveTo(
        leftPoints[leftPoints.length-1].x, 
        leftPoints[leftPoints.length-1].y,
        leftPoints[leftPoints.length-1].x, 
        leftPoints[leftPoints.length-1].y
      );
      
      ctx.stroke();
    }
    
    // Draw right side as one continuous bezier curve
    const rightSide = [
      "right_wrist", "right_elbow", "right_shoulder", 
      "right_hip", "right_knee", "right_ankle"
    ];
    
    const rightPoints = rightSide
      .map(name => keypoints.find(kp => kp.name === name))
      .filter(Boolean) as Keypoint[];
    
    if (rightPoints.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
      
      // Draw smooth curve through all points
      for (let i = 1; i < rightPoints.length - 1; i++) {
        const xc = (rightPoints[i].x + rightPoints[i+1].x) / 2;
        const yc = (rightPoints[i].y + rightPoints[i+1].y) / 2;
        ctx.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, xc, yc);
      }
      
      // Connect to the last point
      ctx.quadraticCurveTo(
        rightPoints[rightPoints.length-1].x, 
        rightPoints[rightPoints.length-1].y,
        rightPoints[rightPoints.length-1].x, 
        rightPoints[rightPoints.length-1].y
      );
      
      ctx.stroke();
    }
  }
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
  const [trackedPoses, setTrackedPoses] = useState<TrackedPose[]>([]);
  const [isDebugRendering, setIsDebugRendering] = useState<boolean>(false);

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
        
        // Add a more user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'absolute';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '10px';
        errorMessage.style.textAlign = 'center';
        errorMessage.innerHTML = `
          <h3>Camera Access Error</h3>
          <p>Please allow camera access to use this application.</p>
          <p>You may need to refresh the page and try again.</p>
        `;
        document.body.appendChild(errorMessage);
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

  // Optimize the pose detection interval
  // Around line 391, increase the detection interval further
  const poseDetectionInterval = 15; // Detect poses less frequently (every 15 frames)

  /**
   * Calculates the distance between two poses for tracking purposes
   * @param pose1 First pose keypoints
   * @param pose2 Second pose keypoints
   * @returns Average distance between corresponding keypoints
   */
  const calculatePoseDistance = (pose1: Keypoint[], pose2: Keypoint[]): number => {
    // Use multiple keypoints for more reliable tracking
    const keyPointPairs = [
      ['nose', 'nose'],
      ['left_shoulder', 'left_shoulder'],
      ['right_shoulder', 'right_shoulder']
    ];
    
    let totalDistance = 0;
    let validPairs = 0;
    
    keyPointPairs.forEach(([name1, name2]) => {
      const kp1 = pose1.find(kp => kp.name === name1);
      const kp2 = pose2.find(kp => kp.name === name2);
      
      if (kp1 && kp2) {
        const distance = Math.sqrt(
          Math.pow(kp1.x - kp2.x, 2) + 
          Math.pow(kp1.y - kp2.y, 2)
        );
        totalDistance += distance;
        validPairs++;
      }
    });
    
    return validPairs > 0 ? totalDistance / validPairs : Infinity;
  };

  // Run pose detection loop
  useEffect(() => {
    let animationFrameId: number;
    let isDetecting = false;
    let frameCount = 0;
    
    // Create a separate debug canvas and context
    let debugCtx: CanvasRenderingContext2D | null = null;
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = canvasSize.width;
    debugCanvas.height = canvasSize.height;
    debugCtx = debugCanvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false // Optimize for performance
    });

    // Define detectPose first, before it's used
    async function detectPose() {
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
      frameCount++;
      
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
  
      try {
        // Around line 391, increase the detection interval
        const shouldEstimatePose = frameCount % poseDetectionInterval === 0;
        
        if (shouldEstimatePose) {
          const poses = await detector.estimatePoses(video, {
            maxPoses: 2,
            flipHorizontal: false,
            scoreThreshold: 0.4
          });
          
          // Transform keypoints to canvas coordinates
          const currentPoses = poses
            .filter(pose => {
              const avgScore = pose.keypoints.reduce((sum, kp) => sum + (kp.score || 0), 0) / pose.keypoints.length;
              return avgScore > 0.45;
            })
            .map(pose => ({
              keypoints: pose.keypoints
                .filter(kp => kp.score && kp.score > 0.4)
                .map((keypoint) => ({
                  name: keypoint.name || 'unknown',
                  x: canvas.width - (keypoint.x / video.videoWidth) * canvas.width,
                  y: (keypoint.y / video.videoHeight) * canvas.height,
                  score: keypoint.score
                }))
            }))
            .filter(pose => pose.keypoints.length >= 7);
          
          // Update tracked poses with simpler matching
          const now = Date.now();
          const updatedTrackedPoses = [...trackedPoses];
          
          // Match current poses with tracked poses
          currentPoses.forEach(currentPose => {
            let closestDistance = 40;
            let closestPoseIndex = -1;
            
            updatedTrackedPoses.forEach((trackedPose, index) => {
              const distance = calculatePoseDistance(currentPose.keypoints, trackedPose.keypoints);
              if (distance < closestDistance) {
                closestDistance = distance;
                closestPoseIndex = index;
              }
            });
            
            if (closestPoseIndex !== -1 && closestDistance < 40) {
              // Update existing tracked pose
              updatedTrackedPoses[closestPoseIndex] = {
                ...updatedTrackedPoses[closestPoseIndex],
                keypoints: currentPose.keypoints,
                lastSeen: now
              };
            } else {
              // Add new tracked pose
              const isTooClose = updatedTrackedPoses.some(pose => 
                calculatePoseDistance(currentPose.keypoints, pose.keypoints) < 100
              );
              
              if (!isTooClose && currentPose.keypoints.length >= 8) {
                const newHue = Math.floor(Math.random() * 360);
                updatedTrackedPoses.push({
                  id: Math.random().toString(36).substring(2, 9),
                  keypoints: currentPose.keypoints,
                  lastSeen: now,
                  hue: newHue
                });
              }
            }
          });
          
          // Remove poses that haven't been seen recently
          const filteredPoses = updatedTrackedPoses
            .filter(pose => now - pose.lastSeen < 1500)
            .filter(pose => pose.keypoints.length >= 7);
          
          setTrackedPoses(filteredPoses);
        }
        
        // Draw all tracked poses on the main canvas
        trackedPoses.forEach(pose => {
          // Use the tracked pose's consistent hue
          ctx.strokeStyle = `hsla(${pose.hue}, 100%, 50%, 0.7)`;
          
          // Draw the creature
          blob.limbs(ctx, pose.keypoints);
          blob.eyes(ctx, pose.keypoints);
        });
        
        // Handle debug rendering separately
        if (debugMode && isDebugRendering && debugCtx) {
          try {
            // Clear the debug canvas first
            debugCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw video feed with opacity
            debugCtx.save();
            debugCtx.globalAlpha = 0.9;
            debugCtx.scale(-1, 1);
            debugCtx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            debugCtx.restore();
            
            // Draw the same creatures as in normal mode
            trackedPoses.forEach(pose => {
              // Use the same color as normal mode
              debugCtx!.strokeStyle = `hsla(${pose.hue}, 100%, 50%, 0.7)`;
              debugCtx!.lineWidth = 4; // Slightly thinner than normal mode
              
              // Draw the creature using the same function
              blob.limbs(debugCtx!, pose.keypoints);
              blob.eyes(debugCtx!, pose.keypoints);
              
              // Add minimal keypoint indicators on top
              const keyPoints = ["nose", "left_shoulder", "right_shoulder", 
                                "left_elbow", "right_elbow", "left_wrist", "right_wrist",
                                "left_hip", "right_hip", "left_knee", "right_knee"];
              
              const debugKeypoints = pose.keypoints.filter(kp => keyPoints.includes(kp.name));
              
              // Draw small dots at keypoints
              debugKeypoints.forEach((keypoint) => {
                debugCtx!.beginPath();
                debugCtx!.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
                debugCtx!.fillStyle = "white";
                debugCtx!.fill();
                
                // Only label the most important points
                if (["nose", "left_shoulder", "right_shoulder"].includes(keypoint.name)) {
                  debugCtx!.fillStyle = "white";
                  debugCtx!.font = "10px Arial";
                  debugCtx!.fillText(keypoint.name, keypoint.x + 5, keypoint.y - 5);
                }
              });
            });
            
            // Replace the main canvas content with the debug canvas
            // Use a direct replacement instead of clearing first to reduce flickering
            ctx.globalCompositeOperation = 'copy';
            ctx.drawImage(debugCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
          } catch (debugError) {
            logger.error("Debug rendering error, disabling debug mode:", debugError);
            setIsDebugRendering(false);
            setDebugMode(false);
          }
        }
      } catch (error) {
        logger.error("Error in pose estimation:", error);
      }
  
      isDetecting = false;
      animationFrameId = requestAnimationFrame(detectPose);
    }
  
    // Now use detectPose after it's defined
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameId = requestAnimationFrame(detectPose);
      return;
    }
  
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
    isDebugRendering,
    canvasSize,
    isLoading,
    trackedPoses,
  ]);

  // Simplify toggle debug mode function
  const toggleDebugMode = useCallback(() => {
    if (!debugMode) {
      setDebugMode(true);
      // Make debug rendering immediate
      setIsDebugRendering(true);
    } else {
      // Simple toggle off
      setIsDebugRendering(false);
      setDebugMode(false);
    }
  }, [debugMode]);

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
    <div 
      ref={containerRef} 
      style={containerStyle} 
      data-debug={debugMode ? "true" : "false"}
    >
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
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Loading model...</p>
          <p>This may take a moment on slower connections</p>
          <div style={{ 
            width: '100%', 
            height: '10px', 
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '5px',
            marginTop: '15px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              backgroundColor: 'rgba(59, 130, 246, 0.7)',
              borderRadius: '5px',
              animation: 'loading 1.5s infinite ease-in-out'
            }}></div>
          </div>
          <style>{`
            @keyframes loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
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