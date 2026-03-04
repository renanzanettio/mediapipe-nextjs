"use client";

import { useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseDetector } from "@/services/PoseDetector";
import { SquatEvaluator } from "@/core/evaluation/SquatEvaluator";
import styles from "./Camera.module.css";

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Carregando...");

  useEffect(() => {
    const detector = new PoseDetector();
    const evaluator = new SquatEvaluator();
    let animationId: number;

    const init = async () => {
      await detector.init();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      videoRef.current.onloadeddata = () => {
        const ctx = canvasRef.current!.getContext("2d")!;
        const drawingUtils = new DrawingUtils(ctx);

        const loop = () => {
          detector.detect(videoRef.current!, performance.now(), (result) => {
            ctx.clearRect(0, 0, 640, 480);
            ctx.drawImage(videoRef.current!, 0, 0, 640, 480);

            if (result.landmarks?.length) {
              const lm = result.landmarks[0];

              drawingUtils.drawLandmarks(lm);
              drawingUtils.drawConnectors(
                lm,
                PoseLandmarker.POSE_CONNECTIONS
              );

              const res = evaluator.evaluate(lm);
              setStatus(res.label);
            }
          });

          animationId = requestAnimationFrame(loop);
        };

        loop();
      };
    };

    init();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    // <div>
    //   <p>{status}</p>
    //   <video ref={videoRef} autoPlay muted playsInline className={styles.video}/>
    //   <canvas ref={canvasRef} width={640} height={480}/>
    // </div>

      <div className={styles.mainContainer}>
        <div className={styles.card}>
          <h1 className={styles.title}>Câmera</h1>
          <p className={styles.status}>{status}</p>

          <video ref={videoRef} autoPlay muted playsInline className={styles.video}/>


          <canvas ref={canvasRef} width={640} height={480} className={styles.canvas}/>

        </div>
      </div>

  );
}