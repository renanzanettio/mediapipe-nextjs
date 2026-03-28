import { IExerciseEvaluator } from "./IExerciseEvaluator";
import { ExerciseResult } from "./ExerciseResult";
import { AngleCalculator } from "../math/AngleCalculator";

export type SquatPhase = "standing" | "squatting" | "too_deep" | "detecting";

// How many consecutive frames a phase must hold before it's confirmed.
// At ~30fps, 6 frames ≈ 200ms — enough to ignore flicker / lost landmarks.
const DEBOUNCE_FRAMES = 6;

export class SquatEvaluator implements IExerciseEvaluator {
  name = "Agachamento";

  // Confirmed (debounced) phase — what the session logic reads
  private _phase: SquatPhase = "detecting";

  // Candidate phase accumulator
  private _pendingPhase: SquatPhase = "detecting";
  private _pendingCount = 0;

  get phase(): SquatPhase {
    return this._phase;
  }

  /** True if the phase changed THIS frame (after debounce). */
  get phaseChanged(): boolean {
    return this._phaseChanged;
  }
  private _phaseChanged = false;

  evaluate(lm: any[]): ExerciseResult {
    this._phaseChanged = false;

    // ── Landmarks required ────────────────────────────────────────────────────
    // 11/12 shoulders, 23/24 hips, 25/26 knees, 27/28 ankles
    const REQUIRED = [11, 12, 23, 24, 25, 26, 27, 28];
    if (REQUIRED.some((i) => !lm[i])) {
      // Don't confirm "detecting" immediately — keep the last stable phase
      // so a momentary occlusion doesn't trigger a phantom rep.
      this.accumulate("detecting");
      return { label: "Detectando...", ok: true, messages: [] };
    }

    // ── Angles ────────────────────────────────────────────────────────────────
    // Knee angle: hip(24) – knee(26) – ankle(28)  [right side]
    const kneeAngle = AngleCalculator.angleBetween(lm[24], lm[26], lm[28]);

    // Trunk angle: shoulder(12) – hip(24) – knee(26)
    // A good squat keeps this > ~45°; if the torso collapses it drops lower.
    const trunkAngle = AngleCalculator.angleBetween(lm[12], lm[24], lm[26]);

    // Knee-over-toe check (2-D, normalised coords):
    // lm[26] = right knee, lm[28] = right ankle, lm[32] = right foot index
    const kneeX = lm[26].x;
    const ankleX = lm[28].x;
    // If the knee is more than ~12% of frame width ahead of the ankle → flag
    const kneeOverToe = Math.abs(kneeX - ankleX) > 0.12;

    // ── Classify raw phase ────────────────────────────────────────────────────
    const rawErrors: string[] = [];

    if (kneeAngle >= 120) {
      // Standing — no posture checks needed
      this.accumulate("standing");
      return { label: "Em pé", ok: true, messages: [] };
    }

    // Below standing threshold → user is in some squat position
    if (kneeAngle < 60) {
      rawErrors.push("Muito profundo — suba um pouco");
    }

    if (trunkAngle < 45) {
      rawErrors.push("Tronco muito inclinado — mantenha o peito erguido");
    }

    if (kneeOverToe) {
      rawErrors.push("Joelho passando do pé — recue o peso para o calcanhar");
    }

    const rawPhase: SquatPhase = kneeAngle < 60 ? "too_deep" : "squatting";
    this.accumulate(rawPhase);

    const label =
      rawErrors.length > 0
        ? `⚠ ${rawErrors[0]}`
        : `Agachado (${kneeAngle.toFixed(0)}°)`;

    return {
      label,
      ok: rawErrors.length === 0,
      messages: rawErrors,
    };
  }

  // ── Internal debounce ───────────────────────────────────────────────────────
  private accumulate(candidate: SquatPhase) {
    if (candidate === this._pendingPhase) {
      this._pendingCount++;
    } else {
      this._pendingPhase = candidate;
      this._pendingCount = 1;
    }

    if (this._pendingCount >= DEBOUNCE_FRAMES && candidate !== this._phase) {
      this._phase = candidate;
      this._phaseChanged = true;
    }
  }
}