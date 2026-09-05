import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../data/onboardingQuestions";
import { OnboardingQuestion, OnboardingSurveyResult } from "../onboardingTypes";
import { HomeLogo } from "./HomeLogo";

interface OnboardingSurveyProps {
  onGoHome: () => void;
  onComplete: (result: OnboardingSurveyResult) => void;
  historyCount?: number;
  onOpenHistory?: () => void;
  questions?: OnboardingQuestion[];
  questionnaireVersionId?: string;
  initialAnswers?: Record<string, string[]>;
  onAnswersChange?: (answers: Record<string, string[]>) => void;
  startImmediately?: boolean;
  isSubmitting?: boolean;
  error?: string;
}

type AnswerMap = Record<string, string[]>;

const hasValidAnswer = (
  question: OnboardingQuestion,
  optionIds: string[] = [],
) =>
  optionIds.length >= question.minSelections &&
  optionIds.length <= question.maxSelections;

export const OnboardingSurvey: React.FC<OnboardingSurveyProps> = ({
  onGoHome,
  onComplete,
  historyCount = 0,
  onOpenHistory,
  questions = ONBOARDING_QUESTIONS,
  questionnaireVersionId = ONBOARDING_QUESTIONNAIRE_VERSION,
  initialAnswers = {},
  onAnswersChange,
  startImmediately = false,
  isSubmitting = false,
  error = "",
}) => {
  const [hasStarted, setHasStarted] = useState(startImmediately);
  const firstIncomplete = questions.findIndex(
    (q) => !hasValidAnswer(q, initialAnswers[q.id]),
  );
  const restoredIndex =
    firstIncomplete === -1 ? questions.length - 1 : firstIncomplete;
  const [currentIndex, setCurrentIndex] = useState(restoredIndex);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(restoredIndex);
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [validationError, setValidationError] = useState("");
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id] ?? [];
  const answeredCount = useMemo(
    () =>
      questions.filter((question) =>
        hasValidAnswer(question, answers[question.id]),
      ).length,
    [answers, questions],
  );
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  useEffect(() => {
    onAnswersChange?.(answers);
  }, [answers, onAnswersChange]);

  useEffect(() => {
    if (hasStarted) {
      questionHeadingRef.current?.focus();
    }
  }, [currentIndex, hasStarted]);

  const moveToQuestion = (index: number) => {
    if (index > maxVisitedIndex) return;
    setCurrentIndex(index);
    setValidationError("");
  };

  const selectOption = (optionId: string) => {
    if (currentQuestion.type === "SINGLE_CHOICE") {
      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: [optionId],
      }));
      setValidationError("");
      return;
    }

    const isSelected = currentAnswer.includes(optionId);
    if (!isSelected && currentAnswer.length >= currentQuestion.maxSelections) {
      setValidationError(
        `최대 ${currentQuestion.maxSelections}개까지 선택할 수 있습니다.`,
      );
      return;
    }

    const nextAnswer = isSelected
      ? currentAnswer.filter((id) => id !== optionId)
      : [...currentAnswer, optionId];

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: nextAnswer,
    }));
    setValidationError("");
  };

  const validateCurrentQuestion = () => {
    if (hasValidAnswer(currentQuestion, currentAnswer)) return true;

    setValidationError(
      currentQuestion.type === "MULTI_CHOICE"
        ? `선택지를 ${currentQuestion.minSelections}개 이상 선택해 주세요.`
        : "응답을 하나 선택해 주세요.",
    );
    return false;
  };

  const handleNext = () => {
    if (!validateCurrentQuestion()) return;

    const nextIndex = currentIndex + 1;
    setMaxVisitedIndex((previous) => Math.max(previous, nextIndex));
    setCurrentIndex(nextIndex);
    setValidationError("");
  };

  const handleComplete = () => {
    if (!validateCurrentQuestion()) return;

    if (isSubmitting) return;
    const firstIncompleteIndex = questions.findIndex(
      (question) => !hasValidAnswer(question, answers[question.id]),
    );

    if (firstIncompleteIndex >= 0) {
      setMaxVisitedIndex((previous) =>
        Math.max(previous, firstIncompleteIndex),
      );
      setCurrentIndex(firstIncompleteIndex);
      setValidationError("모든 필수 문항에 응답해 주세요.");
      return;
    }

    onComplete({
      questionnaireVersionId,
      completedAt: new Date().toISOString(),
      answers: questions.map((question) => ({
        questionId: question.id,
        optionIds: answers[question.id],
      })),
    });
  };

  const handleGoHome = () => {
    if (isSubmitting) return;
    onGoHome();
  };

  if (!hasStarted) {
    return (
      <div className="min-h-dvh bg-[#E7EBEF] text-black font-gulim flex flex-col">
        <header className="bg-[#004080] text-white border-b-2 border-black">
          <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <HomeLogo onGoHome={handleGoHome} />
            <span className="hidden sm:inline border border-blue-200 bg-[#002B57] px-3 py-1 text-xs font-bold">
              1단계 / 사전 설문
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-8 sm:pt-8 sm:pb-12">
          <section
            className="w-full bg-white border-2 border-black"
            aria-labelledby="onboarding-title"
          >
            <div className="bg-[#E0E0E0] border-b border-black px-4 py-2 text-xs font-bold flex justify-between">
              <span>평가 환경 설정</span>
              <span className="font-mono">FORM 01</span>
            </div>

            <div className="p-4 sm:p-6">
              <span className="inline-block bg-[#FFE600] border border-black px-2 py-1 text-[11px] font-black mb-2 sm:mb-3">
                시작 전 필수
              </span>
              <h1
                id="onboarding-title"
                className="text-[22px] leading-tight sm:text-3xl font-black tracking-tight"
              >
                나에게 맞는 위험 대응 연습 설정
              </h1>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-700 leading-relaxed">
                투자 경험과 판단 습관을 바탕으로 나에게 맞는 평가 시나리오를
                준비합니다.
              </p>

              <div className="grid grid-cols-3 border border-black mt-4 sm:mt-5 text-sm">
                <div className="p-2.5 sm:p-4 border-r border-black bg-[#F8F9FA] text-center sm:text-left">
                  <div className="font-black text-[#004080]">
                    {questions.length}문항
                  </div>
                  <div className="hidden sm:block text-xs text-gray-600 mt-1">
                    모든 문항 필수 응답
                  </div>
                </div>
                <div className="p-2.5 sm:p-4 border-r border-black bg-[#F8F9FA] text-center sm:text-left">
                  <div className="font-black text-[#004080]">약 80초</div>
                  <div className="hidden sm:block text-xs text-gray-600 mt-1">
                    설문 시간 제한 없음
                  </div>
                </div>
                <div className="p-2.5 sm:p-4 bg-[#F8F9FA] text-center sm:text-left">
                  <div className="font-black text-[#004080]">정답 없음</div>
                  <div className="hidden sm:block text-xs text-gray-600 mt-1">
                    실제 행동과 가깝게 응답
                  </div>
                </div>
              </div>

              <div className="mt-4 border border-black bg-[#FFFBE6] p-3 text-xs leading-relaxed text-gray-800">
                <div className="font-bold mb-1">입력 안내</div>
                <p>실제 자산·소득·부채 등 개인정보는 입력하지 마세요.</p>
              </div>
            </div>

            <div className="bg-[#E0E0E0] border-t border-black px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
              {historyCount > 0 && onOpenHistory ? (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="min-h-11 bg-white hover:bg-gray-100 text-black border-2 border-black px-3 sm:px-5 py-2 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <span className="sm:hidden">기록 {historyCount}건</span>
                  <span className="hidden sm:inline">
                    지난 평가 기록 {historyCount}건
                  </span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setHasStarted(true)}
                className="min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-4 sm:px-6 py-2 text-xs sm:text-sm font-black cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
              >
                <span className="sm:hidden">설문 시작 →</span>
                <span className="hidden sm:inline">설문 시작하기 →</span>
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#E7EBEF] text-black font-gulim flex flex-col">
      <header className="bg-[#004080] text-white border-b-2 border-black">
        <div className="w-full max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <HomeLogo onGoHome={handleGoHome} />
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-100">응답 현황</span>
            <strong className="bg-white text-[#004080] border border-black px-2 py-1 font-mono">
              {answeredCount}/{questions.length}
            </strong>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-black">
        <div className="w-full max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
          <div
            className="h-3 flex-1 border border-black bg-[#E0E0E0]"
            role="progressbar"
            aria-label="설문 응답 진행률"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
          >
            <div
              className="h-full bg-[#177245]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-black font-mono">
            {progressPercent}%
          </span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)] gap-4 items-start">
          <aside
            className="bg-white border-2 border-black md:sticky md:top-4"
            aria-label="설문 문항 목록"
          >
            <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 text-xs font-black">
              문항 이동
            </div>
            <div className="grid grid-cols-5 md:grid-cols-2 gap-1.5 p-2">
              {questions.map((question, index) => {
                const isCurrent = index === currentIndex;
                const isComplete = hasValidAnswer(
                  question,
                  answers[question.id],
                );
                const isLocked = index > maxVisitedIndex;

                return (
                  <button
                    type="button"
                    key={question.id}
                    disabled={isLocked || isSubmitting}
                    onClick={() => moveToQuestion(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${index + 1}번 문항${isComplete ? ", 응답 완료" : isLocked ? ", 잠김" : ", 미응답"}`}
                    className={`min-h-11 border px-2 py-1.5 text-xs font-bold flex items-center justify-center md:justify-start gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#004080] ${
                      isCurrent
                        ? "border-2 border-[#004080] bg-[#EAF3FF] text-[#004080]"
                        : isComplete
                          ? "border-[#177245] bg-[#EDF8F0] text-[#145C38] cursor-pointer hover:bg-[#DFF2E5]"
                          : isLocked
                            ? "border-gray-300 bg-[#F2F2F2] text-gray-400 cursor-not-allowed"
                            : "border-black bg-white text-black cursor-pointer hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-mono">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="hidden md:inline">
                      {isComplete ? "완료" : isLocked ? "잠김" : "작성 중"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-black bg-[#F8F9FA] p-3 text-[11px] leading-relaxed text-gray-600 hidden md:block">
              완료한 문항은 다시 열어 수정할 수 있습니다. 설문에는 별도 제한
              시간이 없습니다.
            </div>
          </aside>

          <section
            className="bg-white border-2 border-black"
            aria-labelledby="question-heading"
          >
            <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-black">
                문항 {currentIndex + 1} / {questions.length}
              </span>
              <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-black">
                필수 응답
              </span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="text-xs font-black text-[#004080] mb-2">
                {currentQuestion.category}
              </div>
              <h1
                id="question-heading"
                ref={questionHeadingRef}
                tabIndex={-1}
                className="text-xl sm:text-2xl font-black leading-snug focus:outline-none"
              >
                <span className="text-[#004080] font-mono mr-2">
                  Q{currentIndex + 1}.
                </span>
                {currentQuestion.prompt}
              </h1>
              <p className="mt-3 border-l-4 border-[#004080] bg-[#F4F7FA] px-3 py-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
                {currentQuestion.detail}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  {currentQuestion.type === "MULTI_CHOICE"
                    ? `복수 선택 · ${currentQuestion.minSelections}~${currentQuestion.maxSelections}개`
                    : "단일 선택 · 1개"}
                </span>
                <span className="text-gray-600">
                  현재 선택 {currentAnswer.length}개
                </span>
              </div>

              <fieldset
                disabled={isSubmitting}
                className="mt-2 grid grid-cols-1 gap-2 disabled:opacity-60"
              >
                <legend className="sr-only">{currentQuestion.prompt}</legend>
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = currentAnswer.includes(option.id);
                  const inputId = `${currentQuestion.id}-${option.id}`;

                  return (
                    <label
                      key={option.id}
                      htmlFor={inputId}
                      className={`min-h-[64px] border p-3 flex items-start gap-3 cursor-pointer focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#004080] ${
                        isSelected
                          ? "border-2 border-[#004080] bg-[#EAF3FF]"
                          : "border-black bg-white hover:bg-[#F7FAFC]"
                      }`}
                    >
                      <input
                        id={inputId}
                        type={
                          currentQuestion.type === "MULTI_CHOICE"
                            ? "checkbox"
                            : "radio"
                        }
                        name={currentQuestion.id}
                        checked={isSelected}
                        onChange={() => selectOption(option.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[#004080]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-black text-sm text-black">
                          <span className="font-mono text-[#004080]">
                            {optionIndex + 1}.
                          </span>
                          {option.label}
                          {isSelected && (
                            <span className="bg-[#004080] text-white px-1.5 py-0.5 text-[10px]">
                              선택됨
                            </span>
                          )}
                        </span>
                        <span className="block mt-1 text-xs text-gray-600 leading-relaxed">
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="min-h-8 mt-2">
                {validationError || error ? (
                  <div
                    role="alert"
                    className="border border-[#D90000] bg-[#FFEAEA] px-3 py-2 text-xs text-[#B00000] font-bold"
                  >
                    ※ {validationError || error}
                  </div>
                ) : (
                  <p className="px-1 py-2 text-[11px] text-gray-500">
                    선택한 응답은 이전 문항으로 돌아가 다시 수정할 수 있습니다.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[#E0E0E0] border-t border-black p-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                disabled={currentIndex === 0 || isSubmitting}
                onClick={() => moveToQuestion(currentIndex - 1)}
                className="min-h-11 bg-white hover:bg-gray-100 text-black border border-black px-5 py-2 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
              >
                ← 이전 문항
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
                >
                  다음 문항 →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="min-h-11 bg-[#177245] hover:bg-[#10552F] text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#177245]"
                >
                  {isSubmitting ? "평가 준비 중…" : "설문 완료 →"}
                </button>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-[#D4D0C8] border-t border-black px-4 py-1.5 text-[10px] text-gray-700">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap justify-between gap-2">
          <span>청노 교육용 위험 대응 시뮬레이션</span>
          <span>설문을 마치면 평가 시나리오를 확인할 수 있습니다.</span>
        </div>
      </footer>
    </div>
  );
};
