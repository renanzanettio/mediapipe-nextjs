export class AngleCalculator {
  static toDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  static angleBetween(a: any, b: any, c: any): number {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return this.toDeg(Math.acos(cos));
  }
}