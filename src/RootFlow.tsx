import React, { useState } from 'react';
import App from './App';
import { OnboardingSurvey } from './components/OnboardingSurvey';
import { OnboardingSurveyResult } from './onboardingTypes';

export default function RootFlow() {
  const [onboardingResult, setOnboardingResult] = useState<OnboardingSurveyResult | null>(null);

  if (!onboardingResult) {
    return <OnboardingSurvey onComplete={setOnboardingResult} />;
  }

  return <App />;
}
