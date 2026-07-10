export class CostCapExceededError extends Error {
  readonly name = 'CostCapExceededError';

  constructor(
    public readonly currentCost: number,
    public readonly cap: number,
  ) {
    super(`Cost cap reached ($${currentCost.toFixed(2)} of $${cap.toFixed(2)})`);
  }
}
