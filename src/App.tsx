import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AssetCategory,
  AssetData,
  ConfidenceLevel,
  DecisionRecord,
  DirectionType,
  ReasonCategory,
} from './types';
import { INITIAL_ASSETS } from './data/mockAssets';
import { Header } from './components/Header';
import { AssetTabs } from './components/AssetTabs';
import { CandleChart } from './components/CandleChart';
import { DataBoard } from './components/DataBoard';
import { InfoFeedBBS } from './components/InfoFeedBBS';
import { QuestionCard } from './components/QuestionCard';
import { DecisionModal } from './components/DecisionModal';
import { OmrSheetModal } from './components/OmrSheetModal';
import { ExamNoticeModal } from './components/ExamNoticeModal';
import { ResultReportModal } from './components/ResultReportModal';
import { FinishExamModal } from './components/FinishExamModal';
import { OnboardingSurveyResult } from './onboardingTypes';
import { ScenarioMatchResult } from './scenarioTypes';
import {
  AssessmentResultSnapshot,
  createAssessmentResult,
  ExamFinishReason,
  saveAssessmentResult,
} from './assessmentResult';

const EXAM_DURATION_SECONDS = 6 * 60;

const SCENARIO_SIMULATION_SETTINGS = {
  기초: { volatilityScale: 0.7, tickIntervalMs: 1000 },
  균형: { volatilityScale: 1, tickIntervalMs: 800 },
  도전: { volatilityScale: 1.35, tickIntervalMs: 650 },
} as const;

const EXAM_QUESTIONS: {
  id: AssetCategory;
  questionNumber: number;
  assetName: string;
}[] = [
  { id: 'normal', questionNumber: 1, assetName: INITIAL_ASSETS.normal.name },
  { id: 'leverage', questionNumber: 2, assetName: INITIAL_ASSETS.leverage.name },
  { id: 'stable', questionNumber: 3, assetName: INITIAL_ASSETS.stable.name },
];

interface AppProps {
  onboardingResult: OnboardingSurveyResult;
  scenarioMatch: ScenarioMatchResult;
  onResultSaved: (result: AssessmentResultSnapshot, isPersisted: boolean) => void;
  onOpenVerification: (result: AssessmentResultSnapshot) => void;
  onOpenHistory: () => void;
  onStartNewAssessment: () => void;
}

export default function App({
  onboardingResult,
  scenarioMatch,
  onResultSaved,
  onOpenVerification,
  onOpenHistory,
  onStartNewAssessment,
}: AppProps) {
  // Candidate & Exam Info
  const [candidateNumber] = useState<string>('KR-2026-8849-ANON');
  const [terminalNumber] = useState<string>('04-B');
  const [roomName] = useState<string>('제2CBT실기평가장');

  // Exam Progress State
  const [timeRemaining, setTimeRemaining] = useState<number>(EXAM_DURATION_SECONDS);
  const [timerDeadline, setTimerDeadline] = useState<number>(
    () => Date.now() + EXAM_DURATION_SECONDS * 1000,
  );
  const [currentTab, setCurrentTab] = useState<AssetCategory>('normal');
  const [assets, setAssets] = useState<Record<AssetCategory, AssetData>>(INITIAL_ASSETS);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [tickCount, setTickCount] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  // Modals
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState<boolean>(false);
  const [pendingDirection, setPendingDirection] = useState<DirectionType>('UP');
  const [isOmrOpen, setIsOmrOpen] = useState<boolean>(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState<boolean>(false);
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false);
  const [resultSnapshot, setResultSnapshot] = useState<AssessmentResultSnapshot | null>(null);
  const [isResultPersisted, setIsResultPersisted] = useState<boolean>(false);
  const hasFinalizedRef = useRef(false);
  const examStartedAtRef = useRef(Date.now());
  const simulationSettings = SCENARIO_SIMULATION_SETTINGS[scenarioMatch.difficulty];

  const finalizeExam = useCallback(
    (finishReason: ExamFinishReason) => {
      if (hasFinalizedRef.current) return;
      hasFinalizedRef.current = true;

      const snapshot = createAssessmentResult({
        candidate: {
          number: candidateNumber,
          roomName,
          terminalNumber,
        },
        decisions,
        elapsedSeconds: Math.min(
          EXAM_DURATION_SECONDS,
          Math.max(0, Math.floor((Date.now() - examStartedAtRef.current) / 1000)),
        ),
        durationSeconds: EXAM_DURATION_SECONDS,
        finishReason,
        onboarding: onboardingResult,
        scenario: scenarioMatch,
      });

      const isPersisted = saveAssessmentResult(snapshot);
      setResultSnapshot(snapshot);
      setIsResultPersisted(isPersisted);
      onResultSaved(snapshot, isPersisted);
      setIsSimulating(false);
      setIsDecisionModalOpen(false);
      setIsOmrOpen(false);
      setIsNoticeOpen(false);
      setIsFinishConfirmOpen(false);
      setIsResultOpen(true);
    }, [
      candidateNumber,
      decisions,
      onboardingResult,
      onResultSaved,
      roomName,
      scenarioMatch,
      terminalNumber,
    ],
  );

  // One deadline-based six-minute countdown for all three asset questions.
  // Deriving the display from a deadline keeps the timer accurate after a
  // background tab has throttled the interval.
  useEffect(() => {
    if (isResultOpen) return;

    const updateTimer = () => {
      const nextRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      setTimeRemaining(nextRemaining);

      if (nextRemaining === 0) finalizeExam('TIMEOUT');
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 250);
    return () => clearInterval(timer);
  }, [timerDeadline, isResultOpen, finalizeExam]);

  // 60x Market Simulation Ticker (Ticks every 800ms)
  const advanceMarketTick = useCallback(() => {
    setTickCount((prevTick) => {
      const nextTick = prevTick + 1;

      setAssets((prev) => {
        const updated: Record<AssetCategory, AssetData> = { ...prev };

        (Object.keys(updated) as AssetCategory[]).forEach((cat) => {
          const asset = updated[cat];
          const candles = [...asset.candles];
          const lastIndex = candles.length - 1;
          const currentCandle = { ...candles[lastIndex] };

          // Volatility multiplier by asset type
          const baseVolatility =
            cat === 'leverage' ? 0.004 : cat === 'stable' ? 0.0001 : 0.0012;
          const volMultiplier = baseVolatility * simulationSettings.volatilityScale;
          const delta = (Math.random() - 0.49) * volMultiplier * asset.basePrice;
          const newClose = Math.round(currentCandle.close + delta);
          const newHigh = Math.max(currentCandle.high, newClose);
          const newLow = Math.min(currentCandle.low, newClose);
          const addVolume = Math.floor(Math.random() * (cat === 'leverage' ? 8000 : 2000)) + 500;

          currentCandle.close = newClose;
          currentCandle.high = newHigh;
          currentCandle.low = newLow;
          currentCandle.volume += addVolume;

          // If candle accumulated 6 ticks, push a new candle bar
          if (nextTick % 6 === 0) {
            const now = new Date();
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');

            candles[lastIndex] = currentCandle;
            candles.push({
              timestamp: now.toISOString(),
              timeLabel: `${hour}:${minute}:${second}`,
              open: newClose,
              high: newClose,
              low: newClose,
              close: newClose,
              volume: Math.floor(Math.random() * 1500) + 300,
            });
            if (candles.length > 40) {
              candles.shift();
            }
          } else {
            candles[lastIndex] = currentCandle;
          }

          // Update metrics
          const priceDiff = newClose - asset.metrics.prevClose;
          const changeRate = (priceDiff / asset.metrics.prevClose) * 100;
          const newVol = asset.metrics.tradingVolume + addVolume;

          updated[cat] = {
            ...asset,
            candles,
            metrics: {
              ...asset.metrics,
              currentPrice: newClose,
              change: priceDiff,
              changeRate,
              highPrice: Math.max(asset.metrics.highPrice, newHigh),
              lowPrice: Math.min(asset.metrics.lowPrice, newLow),
              tradingVolume: newVol,
              foreignNet: asset.metrics.foreignNet + (cat === 'leverage' ? (Math.random() > 0.6 ? -120 : 60) : (Math.random() > 0.4 ? 80 : -40)),
              rsi14: Math.min(85, Math.max(15, asset.metrics.rsi14 + (delta > 0 ? 0.3 : -0.3))),
            },
          };
        });

        return updated;
      });

      return nextTick;
    });
  }, [simulationSettings.volatilityScale]);

  useEffect(() => {
    if (!isSimulating || isResultOpen) return;
    const interval = setInterval(advanceMarketTick, simulationSettings.tickIntervalMs);
    return () => clearInterval(interval);
  }, [isSimulating, isResultOpen, advanceMarketTick, simulationSettings.tickIntervalMs]);

  // Open Decision Modal
  const handleSelectDirection = (direction: DirectionType) => {
    setPendingDirection(direction);
    setIsDecisionModalOpen(true);
  };

  // Submit Answer to Decisions List
  const handleDecisionSubmit = (data: {
    direction: DirectionType;
    confidence: ConfidenceLevel;
    reasons: ReasonCategory[];
    memo: string;
  }) => {
    const currentAsset = assets[currentTab];
    const qNum = currentTab === 'normal' ? 1 : currentTab === 'leverage' ? 2 : 3;

    const newRecord: DecisionRecord = {
      id: `${currentTab}-${Date.now()}`,
      questionNumber: qNum,
      assetId: currentTab,
      assetName: currentAsset.name,
      decisionTime: new Date().toLocaleTimeString('ko-KR'),
      direction: data.direction,
      confidence: data.confidence,
      reasons: data.reasons,
      memo: data.memo,
      priceAtDecision: currentAsset.metrics.currentPrice,
      submittedAt: new Date().toISOString(),
    };

    setDecisions((prev) => {
      const filtered = prev.filter((d) => d.assetId !== currentTab);
      return [...filtered, newRecord];
    });

    // Auto navigate to next unanswered tab if available
    const order: AssetCategory[] = ['normal', 'leverage', 'stable'];
    const nextUnanswered = order.find((c) => c !== currentTab && !decisions.some((d) => d.assetId === c));
    if (nextUnanswered) {
      setTimeout(() => {
        setCurrentTab(nextUnanswered);
      }, 300);
    }
  };

  const handleRequestFinish = () => {
    if (isResultOpen || hasFinalizedRef.current) return;
    setIsFinishConfirmOpen(true);
  };

  const handleConfirmFinish = () => {
    finalizeExam('EARLY');
  };

  const handleRetakeSameAssessment = () => {
    hasFinalizedRef.current = false;
    examStartedAtRef.current = Date.now();
    setDecisions([]);
    setTimeRemaining(EXAM_DURATION_SECONDS);
    setTimerDeadline(Date.now() + EXAM_DURATION_SECONDS * 1000);
    setTickCount(1);
    setIsSimulating(true);
    setIsDecisionModalOpen(false);
    setIsOmrOpen(false);
    setIsNoticeOpen(false);
    setIsFinishConfirmOpen(false);
    setIsResultOpen(false);
    setResultSnapshot(null);
    setIsResultPersisted(false);
    setCurrentTab('normal');
    setAssets(INITIAL_ASSETS);
  };

  // Global Key Handler for standard modal escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'Escape') {
        setIsDecisionModalOpen(false);
        setIsOmrOpen(false);
        setIsNoticeOpen(false);
        setIsFinishConfirmOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentAsset = assets[currentTab];
  const currentDecision = decisions.find((d) => d.assetId === currentTab);
  const qNum = currentTab === 'normal' ? 1 : currentTab === 'leverage' ? 2 : 3;
  const answeredAssetIds = new Set(decisions.map((decision) => decision.assetId));
  const answeredCount = EXAM_QUESTIONS.filter((question) => answeredAssetIds.has(question.id)).length;
  const unansweredQuestions = EXAM_QUESTIONS.filter(
    (question) => !answeredAssetIds.has(question.id),
  );

  return (
    <div
      className={`h-screen max-h-screen overflow-hidden bg-[#F0F0F0] text-black flex flex-col font-gulim ${
        isLargeFont ? 'text-[13px]' : 'text-xs'
      }`}
    >
      {/* 1. Official CBT Header (Fixed) */}
      <Header
        timeRemaining={timeRemaining}
        candidateNumber={candidateNumber}
        terminalNumber={terminalNumber}
        roomName={roomName}
        scenarioName={scenarioMatch.name}
        answeredCount={answeredCount}
        totalQuestions={EXAM_QUESTIONS.length}
        onOpenNotice={() => setIsNoticeOpen(true)}
        onOpenOmr={() => setIsOmrOpen(true)}
        onFinishExam={handleRequestFinish}
        isLargeFont={isLargeFont}
        onToggleFontSize={() => setIsLargeFont(!isLargeFont)}
      />

      {/* 2. Windows Folder-Type Asset Navigation Tabs (Fixed) */}
      <AssetTabs
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        decisions={decisions}
      />

      <div className="shrink-0 border-b border-black bg-[#FFFBE6] px-3 py-1 text-[11px] flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          <strong>{scenarioMatch.difficulty} 과정</strong> · {scenarioMatch.focusAreas.join(' · ')}
        </span>
        <span className="font-mono text-gray-600">
          MOCK SIMULATION · {simulationSettings.volatilityScale.toFixed(2)}x 변동 강도
        </span>
      </div>

      {/* 3. Main Examination Workspace: Internal Vertical Scroll Area (No horizontal scroll) */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden p-2.5 max-w-[1680px] mx-auto flex flex-col gap-2.5">
        {/* Top Split Area: Candle Chart (Left) + Market Data Board (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch w-full">
          {/* Left: Candlestick Chart */}
          <div className="lg:col-span-7 flex flex-col w-full min-w-0">
            <CandleChart
              asset={currentAsset}
              candles={currentAsset.candles}
              tickCount={tickCount}
              isSimulating={isSimulating}
              onToggleSimulation={() => setIsSimulating(!isSimulating)}
              onManualTick={advanceMarketTick}
            />
          </div>

          {/* Right: Dense Market Data Board */}
          <div className="lg:col-span-5 flex flex-col w-full min-w-0">
            <DataBoard metrics={currentAsset.metrics} assetName={currentAsset.name} />
          </div>
        </div>

        {/* Middle Area: Official Information Feed (BBS) */}
        <div className="w-full min-w-0">
          <InfoFeedBBS bbsList={currentAsset.bbsList} assetName={currentAsset.name} />
        </div>
      </main>

      {/* 4. Fixed Bottom CBT Question Console (Unified full-width standalone bar) */}
      <footer className="w-full shrink-0 z-20">
        <QuestionCard
          asset={currentAsset}
          questionNumber={qNum}
          currentDecision={currentDecision}
          onSelectDirection={handleSelectDirection}
        />
      </footer>

      {/* 3. Decision Recording Modal */}
      <DecisionModal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        direction={pendingDirection}
        asset={currentAsset}
        onSubmit={handleDecisionSubmit}
      />

      {/* 4. OMR Answer Sheet Modal */}
      <OmrSheetModal
        isOpen={isOmrOpen}
        onClose={() => setIsOmrOpen(false)}
        decisions={decisions}
        onSelectQuestion={(cat) => setCurrentTab(cat)}
        onFinishExam={handleRequestFinish}
      />

      {/* 5. Exam Notice Modal */}
      <ExamNoticeModal
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
        scenario={scenarioMatch}
      />

      {/* 6. Manual Finish Confirmation (timer expiry bypasses this dialog) */}
      <FinishExamModal
        isOpen={isFinishConfirmOpen}
        answeredCount={answeredCount}
        totalQuestions={EXAM_QUESTIONS.length}
        unansweredQuestions={unansweredQuestions}
        onCancel={() => setIsFinishConfirmOpen(false)}
        onConfirm={handleConfirmFinish}
      />

      {/* 7. Final CBT Scorecard & Pass Certificate Modal */}
      <ResultReportModal
        isOpen={isResultOpen}
        result={resultSnapshot}
        isPersisted={isResultPersisted}
        onOpenVerification={() => {
          if (resultSnapshot && isResultPersisted) onOpenVerification(resultSnapshot);
        }}
        onOpenHistory={onOpenHistory}
        onRetakeSame={handleRetakeSameAssessment}
        onStartNew={onStartNewAssessment}
      />
    </div>
  );
}
