import React, { useRef, useEffect, useState, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";

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

// Creature definitions
const creatures: Record<string, Creature> = {
  blob: {
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
  },
  // Add more creatures here
};

const PoseEstimation: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 640, height: 480 });
  const [currentCreature, setCurrentCreature] = useState<string>("blob");
  const [multiPoseMode, setMultiPoseMode] = useState<boolean>(false);
  const [isChangingMode, setIsChangingMode] = useState<boolean>(false);

  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = window.innerHeight - 100;
      setCanvasSize({ width, height });
    }
  }, []);

  const createDetector = useCallback(async () => {
    setIsChangingMode(true);
    if (detector) {
      await detector.dispose();
    }
    
    try {
      const modelType = multiPoseMode
        ? poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
      
      // Get the base URL for the models - ensure it has a trailing slash
      let baseUrl = import.meta.env.BASE_URL || '/';
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      
      // Log the full URL to help with debugging
      const modelUrl = multiPoseMode
        ? `${baseUrl}assets/models/movenet_multipose_lightning_1.json`
        : `${baseUrl}assets/models/movenet_singlepose_lightning_4.json`;
      
      console.log("Attempting to load model from:", modelUrl);
      
      // Configure the detector to use local model files
      const detectorConfig = {
        modelType,
        modelUrl
      };
      
      let newDetector;
      try {
        newDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          detectorConfig
        );
      } catch (localModelError) {
        console.warn("Failed to load local model, falling back to CDN:", localModelError);
        
        // Fall back to the CDN model if local model fails
        newDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType }
        );
      }
      
      setDetector(newDetector);
    } catch (error) {
      console.error("Error creating detector:", error);
    } finally {
      setIsChangingMode(false);
    }
  }, [multiPoseMode, detector]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  useEffect(() => {
    const initializeTF = async () => {
      await tf.ready();
      await tf.setBackend("webgl");
      createDetector();
    };

    initializeTF();
  }, [createDetector]);

  useEffect(() => {
    if (!isChangingMode) {
      createDetector();
    }
  }, [multiPoseMode, createDetector, isChangingMode]);

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
        console.error("Error setting up camera:", error);
      }
    };

    setupCamera();
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let isDetecting = false;

    const detectPose = async () => {
      if (
        isChangingMode ||
        !detector ||
        !videoRef.current ||
        !canvasRef.current ||
        !isVideoReady ||
        isDetecting
      ) {
        animationFrameId = requestAnimationFrame(detectPose);
        return;
      }

      isDetecting = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        isDetecting = false;
        animationFrameId = requestAnimationFrame(detectPose);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (debugMode) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      try {
        const poses = await detector.estimatePoses(video);

        poses.forEach((tfPose: any, index: number) => {
          const keypoints = tfPose.keypoints.map((keypoint: any) => ({
            name: keypoint.name || 'unknown',
            x: canvas.width - (keypoint.x / video.videoWidth) * canvas.width,
            y: (keypoint.y / video.videoHeight) * canvas.height,
            score: keypoint.score
          }));

          const creature = creatures[currentCreature];
          const hue = multiPoseMode ? (index * 137) % 360 : 120;
          ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.7)`;

          creature.limbs(ctx, keypoints);
          creature.eyes(ctx, keypoints);

          if (debugMode) {
            keypoints.forEach((keypoint: Keypoint) => {
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
        console.error("Error in pose estimation:", error);
      }

      isDetecting = false;
      animationFrameId = requestAnimationFrame(detectPose);
    };

    detectPose();

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
    currentCreature,
    multiPoseMode,
    isChangingMode,
  ]);

  const toggleDebugMode = useCallback(() => setDebugMode((prev) => !prev), []);

  const changeCreature = useCallback(() => {
    const creatureNames = Object.keys(creatures);
    const currentIndex = creatureNames.indexOf(currentCreature);
    const nextIndex = (currentIndex + 1) % creatureNames.length;
    setCurrentCreature(creatureNames[nextIndex]);
  }, [currentCreature]);

  const toggleMultiPoseMode = useCallback(() => {
    if (!isChangingMode) {
      setMultiPoseMode((prev) => !prev);
    }
  }, [isChangingMode]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h1 style={{ textAlign: "center", margin: "10px 0", fontSize: "1.5rem", fontWeight: "bold" }}>
        Dancing Creatures
      </h1>
      <div style={{ flex: 1, position: "relative" }}>
        <video
          ref={videoRef}
          style={{ display: "none" }}
          width={canvasSize.width}
          height={canvasSize.height}
        />
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            border: "1px solid black",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </div>
      <div style={{ padding: "10px", textAlign: "center" }}>
        <button 
          onClick={toggleDebugMode} 
          style={{ 
            marginRight: "10px",
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          {debugMode ? "Disable Debug Mode" : "Enable Debug Mode"}
        </button>
        <button 
          onClick={changeCreature}
          style={{ 
            marginRight: "10px",
            padding: "8px 16px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Change Creature
        </button>
        <button 
          onClick={toggleMultiPoseMode}
          disabled={isChangingMode}
          style={{ 
            padding: "8px 16px",
            backgroundColor: isChangingMode ? "#9ca3af" : "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isChangingMode ? "not-allowed" : "pointer"
          }}
        >
          {isChangingMode
            ? "Changing Mode..."
            : multiPoseMode
            ? "Single Person Mode"
            : "Multiple People Mode"}
        </button>
      </div>
    </div>
  );
};

export default PoseEstimation;