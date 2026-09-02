export type ScenarioDifficulty = '기초' | '균형' | '도전';

export interface ScenarioAsset {
  name: string;
  type: string;
  reason: string;
}

export interface ScenarioMatchResult {
  id: string;
  name: string;
  difficulty: ScenarioDifficulty;
  summary: string;
  matchReasons: string[];
  focusAreas: string[];
  assets: ScenarioAsset[];
}
