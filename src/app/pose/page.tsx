"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseDetector } from "@/services/PoseDetector";
import { SquatEvaluator, SquatPhase } from "@/core/evaluation/SquatEvaluator";
import styles from "./Camera.module.css";

interface SessionStats {
  total: number;
  correct: number;
  incorrect: number;
  startTime: number | null;
  elapsed: number; // seconds
}

type SessionState = "idle" | "active" | "finished";

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Carregando...");

  // Session state held in refs so the animation loop reads current values
  const sessionStateRef = useRef<SessionState>("idle");
  const statsRef = useRef<SessionStats>({
    total: 0,
    correct: 0,
    incorrect: 0,
    startTime: null,
    elapsed: 0,
  });
  const prevPhaseRef = useRef<SquatPhase>("detecting");
  const repWasIncorrectRef = useRef(false); // was the descent phase incorrectly executed?

  // React state for UI updates
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [stats, setStats] = useState<SessionStats>({
    total: 0,
    correct: 0,
    incorrect: 0,
    startTime: null,
    elapsed: 0,
  });

  // Ticker for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionStateRef.current === "active" && statsRef.current.startTime !== null) {
        const elapsed = Math.floor((Date.now() - statsRef.current.startTime) / 1000);
        statsRef.current.elapsed = elapsed;
        setStats((s) => ({ ...s, elapsed }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const startSession = useCallback(() => {
    statsRef.current = {
      total: 0,
      correct: 0,
      incorrect: 0,
      startTime: Date.now(),
      elapsed: 0,
    };
    prevPhaseRef.current = "detecting";
    repWasIncorrectRef.current = false;
    sessionStateRef.current = "active";
    setStats({ ...statsRef.current });
    setSessionState("active");
  }, []);

  const finishSession = useCallback(() => {
    if (statsRef.current.startTime !== null) {
      statsRef.current.elapsed = Math.floor(
        (Date.now() - statsRef.current.startTime) / 1000
      );
    }
    sessionStateRef.current = "finished";
    setStats({ ...statsRef.current });
    setSessionState("finished");
  }, []);

  const resetSession = useCallback(() => {
    sessionStateRef.current = "idle";
    setSessionState("idle");
  }, []);

  // repErrors acumula os erros de postura durante a descida
  const repErrorsRef = useRef<string[]>([]);

  // Called every frame — only runs logic when phase actually changed (debounced)
  const handlePhaseChange = useCallback((newPhase: SquatPhase, errors: string[]) => {
    if (sessionStateRef.current !== "active") return;

    const prev = prevPhaseRef.current;

    // New descent starts: reset error accumulator
    if (prev === "standing" && (newPhase === "squatting" || newPhase === "too_deep")) {
      repErrorsRef.current = [];
      repWasIncorrectRef.current = false;
    }

    // While squatting/too_deep: accumulate any posture errors
    if (newPhase === "squatting" || newPhase === "too_deep") {
      if (errors.length > 0) {
        repWasIncorrectRef.current = true;
        // keep unique errors
        for (const e of errors) {
          if (!repErrorsRef.current.includes(e)) repErrorsRef.current.push(e);
        }
      }
      if (newPhase === "too_deep") {
        repWasIncorrectRef.current = true;
      }
    }

    // Rep completed: squatting/too_deep → standing
    if ((prev === "squatting" || prev === "too_deep") && newPhase === "standing") {
      statsRef.current.total += 1;
      if (repWasIncorrectRef.current) {
        statsRef.current.incorrect += 1;
      } else {
        statsRef.current.correct += 1;
      }
      repWasIncorrectRef.current = false;
      repErrorsRef.current = [];
      setStats({ ...statsRef.current });
    }

    prevPhaseRef.current = newPhase;
  }, []);

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
              drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);

              const res = evaluator.evaluate(lm);

              setStatus(res.label);

              // phaseChanged is debounced inside the evaluator — only true
              // after DEBOUNCE_FRAMES consecutive frames of the same phase
              if (evaluator.phaseChanged) {
                handlePhaseChange(evaluator.phase, res.messages);
              }
            }
          });

          animationId = requestAnimationFrame(loop);
        };

        loop();
      };
    };

    init();
    return () => cancelAnimationFrame(animationId);
  }, [handlePhaseChange]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.card}>
        <h1 className={styles.title}>Câmera</h1>
        <p className={styles.status}>{status}</p>

        {/* Session stats panel */}
        {(sessionState === "active" || sessionState === "finished") && (
          <div className={styles.statsPanel}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Corretas</span>
              <span className={`${styles.statValue} ${styles.correct}`}>{stats.correct}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Incorretas</span>
              <span className={`${styles.statValue} ${styles.incorrect}`}>{stats.incorrect}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Tempo</span>
              <span className={styles.statValue}>{formatTime(stats.elapsed)}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          {sessionState === "idle" && (
            <button className={styles.button} onClick={startSession}>
              Realizar Sessão
            </button>
          )}
          {sessionState === "active" && (
            <button className={`${styles.button} ${styles.buttonDanger}`} onClick={finishSession}>
              Finalizar Sessão
            </button>
          )}
          {sessionState === "finished" && (
            <button className={styles.button} onClick={resetSession}>
              Nova Sessão
            </button>
          )}
        </div>

        <video ref={videoRef} autoPlay muted playsInline className={styles.video} />
        <canvas ref={canvasRef} width={640} height={480} className={styles.canvas} />
      </div>
    </div>
  );
}