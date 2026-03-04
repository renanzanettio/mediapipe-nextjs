import { ExerciseResult } from "./ExerciseResult";

export interface IExerciseEvaluator {
  name: string;
  evaluate(landmarks: any[]): ExerciseResult;
}