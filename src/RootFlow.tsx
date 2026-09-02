import React, { useEffect, useMemo, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
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

interface VerificationRouteProps {
  historyState: StoredResultHistoryRead;
  onOpenHistory: () => void;
  onRetakeSame: (result: AssessmentResultSnapshot) => void;
  onStartNew: () => void;
}

type HomeView = 'onboarding' | 'history';

interface HomeRouteState {
  homeView?: HomeView;
}

const VerificationRoute: React.FC<VerificationRouteProps> = ({
  historyState,
  onOpenHistory,
  onRetakeSame,
  onStartNew,
}) => {
  const { verificationCode } = useParams();
  const historyResults = historyState.status === 'found' ? historyState.results : [];
  const requestedCode = verificationCode ?? null;
  const verificationResult = requestedCode
    ? findAssessmentResultByVerificationCode(historyResults, requestedCode)
    : null;

  return (
    <ResultVerificationPage
      result={verificationResult}
      resultStatus={historyState.status}
      requestedCode={requestedCode}
      onOpenHistory={onOpenHistory}
      onRetakeSame={onRetakeSame}
      onStartNew={onStartNew}
    />
  );
};

export default function RootFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialHistory = useMemo(() => readAssessmentResultHistory(), []);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingSurveyResult | null>(null);
  const [scenarioMatch, setScenarioMatch] = useState<ScenarioMatchResult | null>(null);
  const [historyState, setHistoryState] = useState<StoredResultHistoryRead>(initialHistory);
  const [hasLiveExam, setHasLiveExam] = useState(false);
  const [examSessionKey, setExamSessionKey] = useState(0);
  const initialHomeView: HomeView =
    initialHistory.status === 'found' || initialHistory.status === 'invalid'
      ? 'history'
      : 'onboarding';

  useEffect(() => {
    setHistoryState(readAssessmentResultHistory());
  }, [location.pathname]);

  const handleStartNewAssessment = () => {
    if (historyState.status === 'invalid') {
      navigate('/', { state: { homeView: 'history' } satisfies HomeRouteState });
      window.alert('손상된 평가 이력을 먼저 삭제한 뒤 새 평가를 시작해 주세요.');
      return;
    }

    setOnboardingResult(null);
    setScenarioMatch(null);
    setHasLiveExam(false);
    navigate('/', {
      replace: true,
      state: { homeView: 'onboarding' } satisfies HomeRouteState,
    });
  };

  const handleRetakeStoredAssessment = (result: AssessmentResultSnapshot) => {
    setOnboardingResult(result.onboarding);
    setScenarioMatch(result.scenario);
    setHasLiveExam(true);
    setExamSessionKey((current) => current + 1);
    navigate('/exam', { replace: true });
  };

  const handleResultSaved = (_result: AssessmentResultSnapshot, _isPersisted: boolean) => {
    setHistoryState(readAssessmentResultHistory());
  };

  const handleOpenVerification = (result: AssessmentResultSnapshot) => {
    setHistoryState(readAssessmentResultHistory());
    navigate(`/verify/${encodeURIComponent(result.verificationCode)}`);
  };

  const handleOpenHistory = () => {
    const nextHistory = readAssessmentResultHistory();
    setHistoryState(nextHistory);
    navigate('/', {
      state: {
        homeView:
          nextHistory.status === 'found' || nextHistory.status === 'invalid'
            ? 'history'
            : 'onboarding',
      } satisfies HomeRouteState,
    });
  };

  const handleClearHistory = () => {
    if (!clearAssessmentResultHistory()) {
      window.alert(
        '브라우저 평가 기록을 삭제하지 못했습니다. 사이트 저장 권한을 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    setHistoryState({ status: 'empty', results: [], invalidCount: 0 });
    setOnboardingResult(null);
    setScenarioMatch(null);
    setHasLiveExam(false);
    navigate('/', {
      replace: true,
      state: { homeView: 'onboarding' } satisfies HomeRouteState,
    });
  };

  const historyResults = historyState.status === 'found' ? historyState.results : [];
  const hasActiveExam = Boolean(hasLiveExam && onboardingResult && scenarioMatch);
  const canShowHistory =
    historyState.status === 'found' || historyState.status === 'invalid';
  const homeRouteState = location.state as HomeRouteState | null;
  const homeView = homeRouteState?.homeView ?? initialHomeView;

  const onboardingPage = (
    <OnboardingSurvey
      historyCount={historyResults.length}
      onOpenHistory={handleOpenHistory}
      onComplete={(result) => {
        setOnboardingResult(result);
        navigate('/matching', { replace: true });
      }}
    />
  );

  const matchingPage = hasActiveExam ? (
    <Navigate to="/exam" replace />
  ) : onboardingResult ? (
    <ScenarioMatchScreen
      surveyResult={onboardingResult}
      onStart={(match) => {
        setScenarioMatch(match);
        setHasLiveExam(true);
        setExamSessionKey((current) => current + 1);
        navigate('/exam', { replace: true });
      }}
      onRestartSurvey={() => {
        setOnboardingResult(null);
        setScenarioMatch(null);
        navigate('/', {
          replace: true,
          state: { homeView: 'onboarding' } satisfies HomeRouteState,
        });
      }}
    />
  ) : (
    <Navigate to="/" replace />
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

  const homePage = homeView === 'history' && canShowHistory ? (
    historyPage
  ) : hasActiveExam ? (
    <Navigate to="/exam" replace />
  ) : (
    onboardingPage
  );

  return (
    <>
      {hasActiveExam && onboardingResult && scenarioMatch && (
        <div
          key={examSessionKey}
          className={location.pathname === '/exam' ? undefined : 'hidden'}
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
      )}

      <Routes>
        <Route path="/" element={homePage} />
        <Route path="/matching" element={matchingPage} />
        <Route
          path="/exam"
          element={hasActiveExam ? null : <Navigate to="/" replace />}
        />
        <Route
          path="/verify/:verificationCode"
          element={
            <VerificationRoute
              historyState={historyState}
              onOpenHistory={handleOpenHistory}
              onRetakeSame={handleRetakeStoredAssessment}
              onStartNew={handleStartNewAssessment}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
