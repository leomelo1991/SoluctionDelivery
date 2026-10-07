export const activeStatuses = ['assigned', 'accepted', 'arrived', 'collected'] as const;
export type Stage = 'waiting' | 'assigned' | 'accepted' | 'arrived' | 'collected' | 'delivered';
export const nextStage: Partial<Record<Stage, Stage>> = {
  accepted: 'arrived',
  arrived: 'collected',
  collected: 'delivered',
};
export function canTransition(from: Stage, to: Stage): boolean {
  return nextStage[from] === to;
}
