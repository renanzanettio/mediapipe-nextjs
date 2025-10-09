// "use client";

// import { useEffect, useRef, useState } from "react";
// import {
//   FilesetResolver,
//   PoseLandmarker,
//   DrawingUtils,
// } from "@mediapipe/tasks-vision";

// export default function PoseSquatPage() {
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const [status, setStatus] = useState("Carregando modelo...");

//   useEffect(() => {
//     let poseLandmarker: PoseLandmarker;
//     let animationFrameId: number;

//     const loadPose = async () => {
//       const vision = await FilesetResolver.forVisionTasks(
//         "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
//       );

//       poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
//         baseOptions: {
//           modelAssetPath:
//             "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
//         },
//         runningMode: "VIDEO",
//         numPoses: 1,
//       });

//       setStatus("Modelo carregado! Iniciando câmera...");

//       // Ativa câmera
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { width: 640, height: 480 },
//       });
//       if (!videoRef.current) return;
//       videoRef.current.srcObject = stream;

//       videoRef.current.onloadeddata = () => {
//         setStatus("Analisando...");
//         detectPose();
//       };
//     };

//     const detectPose = async () => {
//       if (!videoRef.current || !poseLandmarker) return;

//       const video = videoRef.current;
//       const canvas = canvasRef.current!;
//       const ctx = canvas.getContext("2d")!;
//       const drawingUtils = new DrawingUtils(ctx);

//       const loop = async () => {
//         poseLandmarker.detectForVideo(video, performance.now(), (result) => {
//           ctx.clearRect(0, 0, canvas.width, canvas.height);
//           ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//           if (result.landmarks && result.landmarks.length > 0) {
//             const lm = result.landmarks[0];
//             drawingUtils.drawLandmarks(lm, { radius: 3, color: "aqua" });
//             drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);

//             // Pega altura do quadril e do joelho (lado direito)
//             const hipY = lm[24].y;
//             const kneeY = lm[26].y;

//             // Lógica simples: se o quadril estiver quase na altura do joelho → agachado
//             if (hipY > kneeY - 0.05) {
//               setStatus("🟢 Agachado!");
//             } else {
//               setStatus("🔵 Em pé");
//             }
//           }
//         });

//         animationFrameId = requestAnimationFrame(loop);
//       };
//       loop();
//     };

//     loadPose();

//     return () => cancelAnimationFrame(animationFrameId);
//   }, []);

//   return (
//     <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
//       <h1 className="text-2xl font-bold mb-4">Detector de Agachamento</h1>
//       <p className="mb-2">{status}</p>
//       <video ref={videoRef} autoPlay playsInline muted className="hidden" />
//       <canvas ref={canvasRef} width={640} height={480} className="rounded-xl border" />
//     </div>
//   );
// }


"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

export default function PoseSquatPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Carregando modelo...");
  const [useImage, setUseImage] = useState(true); // alterna entre imagem e câmera

  useEffect(() => {
    let poseLandmarker: PoseLandmarker;
    let animationFrameId: number;

    const initPose = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        },
        runningMode: useImage ? "IMAGE" : "VIDEO",
        numPoses: 1,
      });

      if (useImage) {
        loadImage(poseLandmarker);
      } else {
        startCamera(poseLandmarker);
      }
    };

    const loadImage = async (poseLandmarker: PoseLandmarker) => {
      setStatus("Carregando imagem...");
      const img = new Image();
      img.src = "/teste2.jpg"; // imagem dentro de /public/teste.jpg
      img.onload = async () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const drawingUtils = new DrawingUtils(ctx);

        const result = await poseLandmarker.detect(img);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (result.landmarks && result.landmarks.length > 0) {
          const lm = result.landmarks[0];
          drawingUtils.drawLandmarks(lm, { radius: 3, color: "aqua" });
          drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
          setStatus("✅ Pose detectada na imagem!");
        } else {
          setStatus("❌ Nenhuma pessoa detectada.");
        }
      };
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

    const detectVideo = async (poseLandmarker: PoseLandmarker) => {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const drawingUtils = new DrawingUtils(ctx);

      const loop = async () => {
        poseLandmarker.detectForVideo(video, performance.now(), (result) => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (result.landmarks && result.landmarks.length > 0) {
            const lm = result.landmarks[0];
            drawingUtils.drawLandmarks(lm, { radius: 3, color: "aqua" });
            drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);

            // Exemplo simples de detecção de agachamento
            const hipY = lm[24].y;
            const kneeY = lm[26].y;
            if (hipY > kneeY - 0.05) setStatus("🟢 Agachado!");
            else setStatus("🔵 Em pé");
          }
        });
        animationFrameId = requestAnimationFrame(loop);
      };
      loop();
    };

    initPose();
    return () => cancelAnimationFrame(animationFrameId);
  }, [useImage]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <h1 className="text-2xl font-bold mb-2">Detector de Agachamento</h1>
      <p className="mb-4">{status}</p>

      <div className="mb-4">
        <button
          onClick={() => setUseImage(!useImage)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
        >
          {useImage ? "Usar câmera" : "Usar imagem"}
        </button>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={useImage ? "hidden" : ""}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="rounded-xl border border-gray-600"
      />
    </div>
  );
}
