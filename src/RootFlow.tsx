import React, { useEffect, useMemo, useState } from 'react';
import App from './App';
import { OnboardingSurvey } from './components/OnboardingSurvey';
import { ResultHistoryPage } from './components/ResultHistoryPage';
import { ResultVerificationPage } from './components/ResultVerificationPage';
import { ScenarioMatchScreen } from './components/ScenarioMatchScreen';
import { OnboardingSurveyResult } from './onboardingTypes';
import { ScenarioMatchResult } from './scenarioTypes';
import {
  AssessmentResultSnapshot,
  clearAssessmentResultHistory,
  findAssessmentResultByVerificationCode,
  readAssessmentResultHistory,
  StoredResultHistoryRead,
} from './assessmentResult';

type FlowPhase = 'onboarding' | 'matching' | 'exam' | 'verification' | 'history';

const getVerificationCodeFromHash = () => {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#verify\/(.+)$/i);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const isHistoryHash = () =>
  typeof window !== 'undefined' && /^#history$/i.test(window.location.hash);

const clearAppHash = () => {
  if (typeof window === 'undefined' || !window.location.hash) return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
};

export default function RootFlow() {
  const initialHistory = useMemo(() => readAssessmentResultHistory(), []);
  const initialRequestedCode = useMemo(() => getVerificationCodeFromHash(), []);
  const initialHistoryRequested = useMemo(() => isHistoryHash(), []);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingSurveyResult | null>(null);
  const [scenarioMatch, setScenarioMatch] = useState<ScenarioMatchResult | null>(null);
  const [historyState, setHistoryState] = useState<StoredResultHistoryRead>(initialHistory);
  const [requestedCode, setRequestedCode] = useState<string | null>(initialRequestedCode);
  const [hasLiveExam, setHasLiveExam] = useState(false);
  const [examSessionKey, setExamSessionKey] = useState(0);
  const [rootReturnPhase, setRootReturnPhase] = useState<'onboarding' | 'history'>(() =>
    !initialRequestedCode && !initialHistoryRequested && initialHistory.status === 'found'
      ? 'history'
      : 'onboarding',
  );
  const [phase, setPhase] = useState<FlowPhase>(() => {
    if (initialRequestedCode) return 'verification';
    if (initialHistoryRequested || initialHistory.status === 'found') return 'history';
    if (initialHistory.status === 'invalid') return 'verification';
    return 'onboarding';
  });

  useEffect(() => {
    const handleRouteChange = () => {
      const nextCode = getVerificationCodeFromHash();
      const nextHistory = readAssessmentResultHistory();
      setRequestedCode(nextCode);
      setHistoryState(nextHistory);

      if (nextCode) {
        setPhase('verification');
      } else if (isHistoryHash()) {
        setPhase('history');
      } else if (hasLiveExam) {
        setPhase('exam');
      } else if (rootReturnPhase === 'history' && nextHistory.status === 'found') {
        setPhase('history');
      } else if (nextHistory.status === 'invalid') {
        setPhase('verification');
      } else {
        setPhase('onboarding');
      }
    };

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [hasLiveExam, rootReturnPhase]);

  const handleStartNewAssessment = () => {
    if (historyState.status === 'invalid') {
      window.history.pushState(null, '', '#history');
      setPhase('history');
      window.alert('손상된 평가 이력을 먼저 삭제한 뒤 새 평가를 시작해 주세요.');
      return;
    }

    clearAppHash();
    setRequestedCode(null);
    setOnboardingResult(null);
    setScenarioMatch(null);
    setHasLiveExam(false);
    setRootReturnPhase('onboarding');
    setPhase('onboarding');
  };

  const handleRetakeStoredAssessment = (result: AssessmentResultSnapshot) => {
    clearAppHash();
    setRequestedCode(null);
    setOnboardingResult(result.onboarding);
    setScenarioMatch(result.scenario);
    setHasLiveExam(true);
    setExamSessionKey((current) => current + 1);
    setPhase('exam');
  };

  const handleResultSaved = (_result: AssessmentResultSnapshot, _isPersisted: boolean) => {
    setHistoryState(readAssessmentResultHistory());
  };

  const handleOpenVerification = (result: AssessmentResultSnapshot) => {
    const encodedCode = encodeURIComponent(result.verificationCode);
    window.history.pushState(null, '', `#verify/${encodedCode}`);
    setHistoryState(readAssessmentResultHistory());
    setRequestedCode(result.verificationCode);
    setPhase('verification');
  };

  const handleOpenHistory = () => {
    window.history.pushState(null, '', '#history');
    setHistoryState(readAssessmentResultHistory());
    setRequestedCode(null);
    setPhase('history');
  };

  const handleClearHistory = () => {
    if (!clearAssessmentResultHistory()) {
      window.alert(
        '브라우저 평가 기록을 삭제하지 못했습니다. 사이트 저장 권한을 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    window.history.replaceState(null, '', '#history');
    setHistoryState({ status: 'empty', results: [], invalidCount: 0 });
    setRequestedCode(null);
    setOnboardingResult(null);
    setScenarioMatch(null);
    setHasLiveExam(false);
    setRootReturnPhase('onboarding');
    setPhase('history');
  };

  const historyResults = historyState.status === 'found' ? historyState.results : [];
  const verificationResult = requestedCode
    ? findAssessmentResultByVerificationCode(historyResults, requestedCode)
    : historyResults[0] ?? null;

  const verificationPage = (
    <ResultVerificationPage
      result={verificationResult}
      resultStatus={historyState.status}
      requestedCode={requestedCode}
      onOpenHistory={handleOpenHistory}
      onRetakeSame={handleRetakeStoredAssessment}
      onStartNew={handleStartNewAssessment}
    />
  );

  const historyPage = (
    <ResultHistoryPage
      results={historyResults}
      storageStatus={historyState.status}
      invalidCount={historyState.invalidCount}
      onOpenResult={handleOpenVerification}
      onRetakeSame={handleRetakeStoredAssessment}
      onStartNew={handleStartNewAssessment}
      onClearHistory={handleClearHistory}
    />
  );

  if (
    hasLiveExam &&
    onboardingResult &&
    scenarioMatch &&
    (phase === 'exam' || phase === 'verification' || phase === 'history')
  ) {
    return (
      <>
        <div
          key={examSessionKey}
          className={phase === 'exam' ? undefined : 'hidden'}
        >
          <App
            onboardingResult={onboardingResult}
            scenarioMatch={scenarioMatch}
            onResultSaved={handleResultSaved}
            onOpenVerification={handleOpenVerification}
            onOpenHistory={handleOpenHistory}
            onStartNewAssessment={handleStartNewAssessment}
          />
        </div>
        {phase === 'verification' && verificationPage}
        {phase === 'history' && historyPage}
      </>
    );
  }

  if (phase === 'verification') return verificationPage;
  if (phase === 'history') return historyPage;

  if (phase === 'onboarding' || !onboardingResult) {
    return (
      <OnboardingSurvey
        historyCount={historyResults.length}
        onOpenHistory={handleOpenHistory}
        onComplete={(result) => {
          setOnboardingResult(result);
          setPhase('matching');
        }}
      />
    );
  }

  if (phase === 'matching' || !scenarioMatch) {
    return (
      <ScenarioMatchScreen
        surveyResult={onboardingResult}
        onStart={(match) => {
          setScenarioMatch(match);
          setHasLiveExam(true);
          setExamSessionKey((current) => current + 1);
          setPhase('exam');
        }}
        onRestartSurvey={() => {
          setOnboardingResult(null);
          setScenarioMatch(null);
          setPhase('onboarding');
        }}
      />
    );
  }

  return null;
}
