import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export class PoseDetector {
  private landmarker!: PoseLandmarker;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );

    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  detect(video: HTMLVideoElement, timestamp: number, callback: any) {
    this.landmarker.detectForVideo(video, timestamp, callback);
  }
}