"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import styles from "./Camera.module.css";

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Carregando modelo...");

  useEffect(() => {
    let poseLandmarker: PoseLandmarker;
    let animationFrameId: number;

    const getPoint = (lm: any[], idx: number) => ({
      x: lm[idx].x,
      y: lm[idx].y,
    });

    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const angleBetween = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number }
    ) => {
      const v1 = { x: a.x - b.x, y: a.y - b.y };
      const v2 = { x: c.x - b.x, y: c.y - b.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.hypot(v1.x, v1.y);
      const mag2 = Math.hypot(v2.x, v2.y);
      if (mag1 === 0 || mag2 === 0) return 0;
      const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
      return toDeg(Math.acos(cos));
    };

    const midpoint = (
      p1: { x: number; y: number },
      p2: { x: number; y: number }
    ) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });

    const evaluatePosture = (lm: any[]) => {
      const msgs: string[] = [];

      const hasRight = lm[24] && lm[26] && lm[28];
      const hasLeft = lm[23] && lm[25] && lm[27];

      let kneeAngleRight = NaN;
      let kneeAngleLeft = NaN;

      if (hasRight)
        kneeAngleRight = angleBetween(
          getPoint(lm, 24),
          getPoint(lm, 26),
          getPoint(lm, 28)
        );

      if (hasLeft)
        kneeAngleLeft = angleBetween(
          getPoint(lm, 23),
          getPoint(lm, 25),
          getPoint(lm, 27)
        );

      const angles = [] as number[];
      if (!Number.isNaN(kneeAngleRight)) angles.push(kneeAngleRight);
      if (!Number.isNaN(kneeAngleLeft)) angles.push(kneeAngleLeft);

      const avgKneeAngle = angles.length
        ? angles.reduce((a, b) => a + b, 0) / angles.length
        : 180;

      let trunkLean = 0;
      if (lm[11] && lm[12] && lm[23] && lm[24]) {
        const shoulder = midpoint(getPoint(lm, 11), getPoint(lm, 12));
        const hip = midpoint(getPoint(lm, 23), getPoint(lm, 24));
        const v = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
        const up = { x: 0, y: -1 };
        const dot = v.x * up.x + v.y * up.y;
        const magV = Math.hypot(v.x, v.y);

        trunkLean =
          magV === 0
            ? 0
            : Math.abs(toDeg(Math.acos(Math.max(-1, Math.min(1, dot / magV)))));
      }

      const squatThreshold = 120;
      const trunkLeanThreshold = 25;

      const isSquatting = avgKneeAngle < squatThreshold;

      if (isSquatting && avgKneeAngle < 60)
        msgs.push("Agachamento muito profundo");

      if (trunkLean > trunkLeanThreshold)
        msgs.push("Tronco inclinado (muito à frente)");

      const postureOk = !(
        trunkLean > trunkLeanThreshold ||
        (isSquatting && avgKneeAngle < 60)
      );

      return {
        isSquatting,
        avgKneeAngle,
        trunkLean,
        postureOk,
        messages: msgs,
      };
    };

    const drawStatusOnCanvas = (
      ctx: CanvasRenderingContext2D,
      text: string
    ) => {
      ctx.font = "14px Inter, system-ui, Arial";
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(8, 8, 500, 40);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 16, 32);
    };

    const initPose = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      startCamera(poseLandmarker);
    };

    const startCamera = async (poseLandmarker: PoseLandmarker) => {
      setStatus("Abrindo câmera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => detectVideo(poseLandmarker);
    };

    const detectVideo = (poseLandmarker: PoseLandmarker) => {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const drawingUtils = new DrawingUtils(ctx);

      const loop = () => {
        poseLandmarker.detectForVideo(video, performance.now(), (result) => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (result.landmarks && result.landmarks.length > 0) {
            const lm = result.landmarks[0];

            drawingUtils.drawLandmarks(lm, { radius: 3, color: "aqua" });
            drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);

            const evalRes = evaluatePosture(lm);

            let message = evalRes.isSquatting
              ? evalRes.postureOk
                ? `🟢 Agachado — OK (${evalRes.avgKneeAngle.toFixed(
                    0
                  )}°)`
                : `🟡 Ajustes: ${evalRes.messages.join(", ")}`
              : "🔵 Em pé";

            setStatus(message);
            drawStatusOnCanvas(ctx, message);
          }
        });

        animationFrameId = requestAnimationFrame(loop);
      };

      loop();
    };

    initPose();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className={styles.mainContainer}>
      <div className={styles.card}>
        <h1 className={styles.title}>Câmera</h1>
        <p className={styles.status}>{status}</p>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={styles.video}
        />

        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className={styles.canvas}
        />
      </div>
    </div>
  );
}