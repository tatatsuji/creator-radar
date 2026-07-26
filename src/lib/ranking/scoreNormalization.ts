export interface WeightedComponent {
  value: number | null;
  weight: number;
}

export function normalizeLog(value: number, max: number): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }

  return Math.min(Math.log10(value + 1) / Math.log10(max + 1), 1) * 100;
}

export function normalizeRatio(value: number, max: number): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }

  return Math.min(value / max, 1) * 100;
}

export function weightedAverage(components: WeightedComponent[]): number | null {
  const available = components.filter(
    (component) => component.value !== null && Number.isFinite(component.value),
  );

  if (available.length === 0) {
    return null;
  }

  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const weightedSum = available.reduce(
    (sum, component) => sum + (component.value! * component.weight) / totalWeight,
    0,
  );

  return weightedSum;
}
