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

// Replace the existing blob creature with this enhanced kawaii version
const blob: Creature = {
  eyes: (ctx, keypoints) => {
    const leftEye = keypoints.find((kp) => kp.name === "left_eye");
    const rightEye = keypoints.find((kp) => kp.name === "right_eye");
    const nose = keypoints.find((kp) => kp.name === "nose");

    if (leftEye && rightEye) {
      // Draw eye whites with slightly oval shape for kawaii look
      ctx.beginPath();
      ctx.ellipse(leftEye.x, leftEye.y, 14, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(rightEye.x, rightEye.y, 14, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      
      // Draw pupils - make them follow the nose direction
      if (nose) {
        const leftPupilX = leftEye.x + (nose.x - leftEye.x) * 0.2;
        const leftPupilY = leftEye.y + (nose.y - leftEye.y) * 0.2;
        const rightPupilX = rightEye.x + (nose.x - rightEye.x) * 0.2;
        const rightPupilY = rightEye.y + (nose.y - rightEye.y) * 0.2;
        
        // Larger kawaii pupils
        ctx.beginPath();
        ctx.arc(leftPupilX, leftPupilY, 8, 0, 2 * Math.PI);
        ctx.arc(rightPupilX, rightPupilY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
        
        // Add multiple shine spots to eyes for kawaii sparkle
        ctx.beginPath();
        ctx.arc(leftPupilX - 3, leftPupilY - 3, 3, 0, 2 * Math.PI);
        ctx.arc(rightPupilX - 3, rightPupilY - 3, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "white";
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(leftPupilX + 2, leftPupilY - 1, 1.5, 0, 2 * Math.PI);
        ctx.arc(rightPupilX + 2, rightPupilY - 1, 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = "white";
        ctx.fill();
      } else {
        // Fallback if nose not detected
        ctx.beginPath();
        ctx.arc(leftEye.x, leftEye.y, 8, 0, 2 * Math.PI);
        ctx.arc(rightEye.x, rightEye.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
      }
      
      // Add cute eyelashes (3 on each eye)
      const eyelashLength = 8;
      
      // Left eye lashes
      ctx.beginPath();
      ctx.moveTo(leftEye.x - 10, leftEye.y - 10);
      ctx.lineTo(leftEye.x - 10 - Math.cos(Math.PI/4) * eyelashLength, 
                leftEye.y - 10 - Math.sin(Math.PI/4) * eyelashLength);
      
      ctx.moveTo(leftEye.x - 5, leftEye.y - 15);
      ctx.lineTo(leftEye.x - 5, leftEye.y - 15 - eyelashLength);
      
      ctx.moveTo(leftEye.x + 5, leftEye.y - 15);
      ctx.lineTo(leftEye.x + 5, leftEye.y - 15 - eyelashLength);
      
      // Right eye lashes
      ctx.moveTo(rightEye.x + 10, rightEye.y - 10);
      ctx.lineTo(rightEye.x + 10 + Math.cos(Math.PI/4) * eyelashLength, 
                rightEye.y - 10 - Math.sin(Math.PI/4) * eyelashLength);
      
      ctx.moveTo(rightEye.x + 5, rightEye.y - 15);
      ctx.lineTo(rightEye.x + 5, rightEye.y - 15 - eyelashLength);
      
      ctx.moveTo(rightEye.x - 5, rightEye.y - 15);
      ctx.lineTo(rightEye.x - 5, rightEye.y - 15 - eyelashLength);
      
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw kawaii mouth if nose and eyes are visible
    if (nose && leftEye && rightEye) {
      const mouthY = nose.y + 25;
      const mouthWidth = Math.abs(leftEye.x - rightEye.x) * 0.7;
      
      // Cute smile
      ctx.beginPath();
      ctx.moveTo(nose.x - mouthWidth/2, mouthY);
      ctx.quadraticCurveTo(
        nose.x, mouthY + 15,
        nose.x + mouthWidth/2, mouthY
      );
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Add blush circles on cheeks
      ctx.beginPath();
      ctx.arc(nose.x - mouthWidth/2 - 15, mouthY, 10, 0, Math.PI * 2);
      ctx.arc(nose.x + mouthWidth/2 + 15, mouthY, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 150, 150, 0.5)";
      ctx.fill();
    }
  },
  limbs: (ctx, keypoints) => {
    // Get the current color for use in fur
    const currentColor = ctx.strokeStyle.toString();
    const currentHue = currentColor.match(/hsla\((\d+)/)?.[1] || "0";
    
    // Draw body outline connecting shoulders and hips
    const torsoPoints = [
      keypoints.find((kp) => kp.name === "left_shoulder"),
      keypoints.find((kp) => kp.name === "right_shoulder"),
      keypoints.find((kp) => kp.name === "right_hip"),
      keypoints.find((kp) => kp.name === "left_hip")
    ].filter(Boolean) as Keypoint[];
    
    if (torsoPoints.length === 4) {
      // Calculate center of torso for fur origin
      const centerX = (torsoPoints[0].x + torsoPoints[1].x + torsoPoints[2].x + torsoPoints[3].x) / 4;
      const centerY = (torsoPoints[0].y + torsoPoints[1].y + torsoPoints[2].y + torsoPoints[3].y) / 4;
      
      // Draw the base body shape
      ctx.beginPath();
      ctx.moveTo(torsoPoints[0].x, torsoPoints[0].y);
      ctx.lineTo(torsoPoints[1].x, torsoPoints[1].y);
      ctx.lineTo(torsoPoints[2].x, torsoPoints[2].y);
      ctx.lineTo(torsoPoints[3].x, torsoPoints[3].y);
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Add a semi-transparent fill
      const fillColor = currentColor.replace('0.7', '0.3');
      ctx.fillStyle = fillColor;
      ctx.fill();
      
      // Add fuzzy fur all around the torso
      const furLength = 15;
      const furDensity = 40; // Number of fur strands
      
      for (let i = 0; i < furDensity; i++) {
        const t = i / furDensity;
        let furX, furY;
        
        // Distribute fur around the torso perimeter
        if (t < 0.25) {
          // Top edge (between shoulders)
          const progress = t * 4;
          furX = torsoPoints[0].x + (torsoPoints[1].x - torsoPoints[0].x) * progress;
          furY = torsoPoints[0].y + (torsoPoints[1].y - torsoPoints[0].y) * progress;
        } else if (t < 0.5) {
          // Right edge (right shoulder to right hip)
          const progress = (t - 0.25) * 4;
          furX = torsoPoints[1].x + (torsoPoints[2].x - torsoPoints[1].x) * progress;
          furY = torsoPoints[1].y + (torsoPoints[2].y - torsoPoints[1].y) * progress;
        } else if (t < 0.75) {
          // Bottom edge (between hips)
          const progress = (t - 0.5) * 4;
          furX = torsoPoints[2].x + (torsoPoints[3].x - torsoPoints[2].x) * progress;
          furY = torsoPoints[2].y + (torsoPoints[3].y - torsoPoints[2].y) * progress;
        } else {
          // Left edge (left hip to left shoulder)
          const progress = (t - 0.75) * 4;
          furX = torsoPoints[3].x + (torsoPoints[0].x - torsoPoints[3].x) * progress;
          furY = torsoPoints[3].y + (torsoPoints[0].y - torsoPoints[3].y) * progress;
        }
        
        // Calculate direction away from center
        const dx = furX - centerX;
        const dy = furY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normalizedDx = dx / dist;
        const normalizedDy = dy / dist;
        
        // Draw fur strand
        const furVariation = Math.random() * 5; // Vary fur length
        ctx.beginPath();
        ctx.moveTo(furX, furY);
        ctx.lineTo(
          furX + normalizedDx * (furLength + furVariation), 
          furY + normalizedDy * (furLength + furVariation)
        );
        
        // Vary fur color slightly
        const hueVariation = Math.floor(Math.random() * 20 - 10);
        ctx.strokeStyle = `hsla(${parseInt(currentHue) + hueVariation}, 100%, 50%, 0.6)`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.stroke();
      }
      
      // Reset stroke style for limbs
      ctx.strokeStyle = currentColor;
    }

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
        // Draw limb with curved lines
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.quadraticCurveTo(
          points[1].x,
          points[1].y,
          points[2].x,
          points[2].y
        );
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.stroke();
        
        // Add fuzzy fur along the limbs
        const segments = 12; // Number of fur segments along the limb
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          
          // Quadratic bezier formula to get points along the curve
          const x = Math.pow(1-t, 2) * points[0].x + 
                   2 * (1-t) * t * points[1].x + 
                   Math.pow(t, 2) * points[2].x;
          
          const y = Math.pow(1-t, 2) * points[0].y + 
                   2 * (1-t) * t * points[1].y + 
                   Math.pow(t, 2) * points[2].y;
          
          // Calculate tangent vector (perpendicular to limb)
          const tx = 2 * (1-t) * (points[1].x - points[0].x) + 
                    2 * t * (points[2].x - points[1].x);
          const ty = 2 * (1-t) * (points[1].y - points[0].y) + 
                    2 * t * (points[2].y - points[1].y);
          
          // Normalize and rotate 90 degrees to get perpendicular
          const length = Math.sqrt(tx*tx + ty*ty);
          const perpX = -ty / length;
          const perpY = tx / length;
          
          // Draw multiple fur strands at each point
          const furCount = 4;
          for (let j = 0; j < furCount; j++) {
            const angle = (j / furCount) * Math.PI * 2;
            const rotatedX = perpX * Math.cos(angle) - perpY * Math.sin(angle);
            const rotatedY = perpX * Math.sin(angle) + perpY * Math.cos(angle);
            
            const furLength = 5 + Math.random() * 8;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
              x + rotatedX * furLength,
              y + rotatedY * furLength
            );
            
            // Vary fur color slightly
            const hueVariation = Math.floor(Math.random() * 20 - 10);
            ctx.strokeStyle = `hsla(${parseInt(currentHue) + hueVariation}, 100%, 50%, 0.6)`;
            ctx.lineWidth = 1 + Math.random() * 1.5;
            ctx.stroke();
          }
        }
        
        // Reset stroke style
        ctx.strokeStyle = currentColor;
        
        // Add joints at each point
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
          
          // Add small fur tufts at joints
          const jointFurCount = 8;
          for (let i = 0; i < jointFurCount; i++) {
            const angle = (i / jointFurCount) * Math.PI * 2;
            const furLength = 4 + Math.random() * 4;
            
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(
              point.x + Math.cos(angle) * furLength,
              point.y + Math.sin(angle) * furLength
            );
            
            // Vary fur color slightly
            const hueVariation = Math.floor(Math.random() * 20 - 10);
            ctx.strokeStyle = `hsla(${parseInt(currentHue) + hueVariation}, 100%, 50%, 0.6)`;
            ctx.lineWidth = 1 + Math.random();
            ctx.stroke();
          }
        });
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
  const [trackedPoses, setTrackedPoses] = useState<TrackedPose[]>([]);

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
    
    // Helper function to calculate distance between poses
    const calculatePoseDistance = (pose1: Keypoint[], pose2: Keypoint[]): number => {
      // Use nose position as reference point for tracking
      const nose1 = pose1.find(kp => kp.name === 'nose');
      const nose2 = pose2.find(kp => kp.name === 'nose');
      
      if (!nose1 || !nose2) return Infinity;
      
      return Math.sqrt(
        Math.pow(nose1.x - nose2.x, 2) + 
        Math.pow(nose1.y - nose2.y, 2)
      );
    };
  
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
        
        // Transform keypoints to canvas coordinates
        const currentPoses = poses.map(pose => ({
          keypoints: pose.keypoints.map((keypoint) => ({
            name: keypoint.name || 'unknown',
            x: canvas.width - (keypoint.x / video.videoWidth) * canvas.width,
            y: (keypoint.y / video.videoHeight) * canvas.height,
            score: keypoint.score
          }))
        }));
        
        // Update tracked poses
        const now = Date.now();
        const updatedTrackedPoses = [...trackedPoses];
        
        // Match current poses with tracked poses
        currentPoses.forEach(currentPose => {
          // Find the closest tracked pose
          let closestDistance = 100; // Threshold for considering it the same person
          let closestPoseIndex = -1;
          
          updatedTrackedPoses.forEach((trackedPose, index) => {
            const distance = calculatePoseDistance(currentPose.keypoints, trackedPose.keypoints);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestPoseIndex = index;
            }
          });
          
          if (closestPoseIndex !== -1) {
            // Update existing tracked pose
            updatedTrackedPoses[closestPoseIndex] = {
              ...updatedTrackedPoses[closestPoseIndex],
              keypoints: currentPose.keypoints,
              lastSeen: now
            };
          } else {
            // Add new tracked pose with a unique hue
            const newHue = Math.floor(Math.random() * 360);
            updatedTrackedPoses.push({
              id: Math.random().toString(36).substring(2, 9),
              keypoints: currentPose.keypoints,
              lastSeen: now,
              hue: newHue
            });
          }
        });
        
        // Remove poses that haven't been seen recently (3 seconds)
        const filteredPoses = updatedTrackedPoses.filter(
          pose => now - pose.lastSeen < 3000
        );
        
        setTrackedPoses(filteredPoses);
        
        // Draw all tracked poses
        filteredPoses.forEach(pose => {
          // Use the tracked pose's consistent hue
          ctx.strokeStyle = `hsla(${pose.hue}, 100%, 50%, 0.7)`;
          
          // Draw the creature
          blob.limbs(ctx, pose.keypoints);
          blob.eyes(ctx, pose.keypoints);
          
          // Draw debug information if enabled
          if (debugMode) {
            pose.keypoints.forEach((keypoint) => {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = `hsl(${pose.hue}, 100%, 50%)`;
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
    trackedPoses,
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