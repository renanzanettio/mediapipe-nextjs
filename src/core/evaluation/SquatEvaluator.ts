import { IExerciseEvaluator } from "./IExerciseEvaluator";
import { ExerciseResult } from "./ExerciseResult";
import { AngleCalculator } from "../math/AngleCalculator";

export class SquatEvaluator implements IExerciseEvaluator {
  name = "Agachamento";

  evaluate(lm: any[]): ExerciseResult {
    if (!lm[24] || !lm[26] || !lm[28]) {
      return { label: "Detectando...", ok: true, messages: [] };
    }

    const angle = AngleCalculator.angleBetween(
      lm[24],
      lm[26],
      lm[28]
    );

    if (angle >= 120) {
      return { label: "Em pé", ok: true, messages: [] };
    }

    if (angle < 60) {
      return {
        label: "Muito profundo",
        ok: false,
        messages: ["Evite descer demais"],
      };
    }

    return {
      label: `Agachado (${angle.toFixed(0)}°)`,
      ok: true,
      messages: [],
    };
  }
}