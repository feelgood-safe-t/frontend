export type OnboardingQuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE';

export interface OnboardingOption {
  id: string;
  label: string;
  detail: string;
}

export interface OnboardingQuestion {
  id: string;
  displayOrder: number;
  category: string;
  prompt: string;
  detail: string;
  type: OnboardingQuestionType;
  required: true;
  minSelections: number;
  maxSelections: number;
  options: OnboardingOption[];
}

export interface OnboardingAnswer {
  questionId: string;
  optionIds: string[];
}

export interface OnboardingSurveyResult {
  questionnaireVersionId: string;
  completedAt: string;
  answers: OnboardingAnswer[];
}
