export type SkillType = 'WHITE_GOODS' | 'HVAC' | 'ELECTRIC' | 'ELECTRONICS_MOTHERBOARD' | 'PLUMBING' | 'BOILER_HEATING';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: 'Başlangıç',
  INTERMEDIATE: 'Orta',
  EXPERT: 'Uzman'
};

// Scoring kullanır: yetkinlik seviyesine göre 0-1 arası ağırlık.
export const SKILL_LEVEL_WEIGHTS: Record<SkillLevel, number> = {
  BEGINNER: 0.5,
  INTERMEDIATE: 0.75,
  EXPERT: 1.0
};
