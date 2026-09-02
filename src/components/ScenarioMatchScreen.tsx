import React, { useEffect, useMemo, useRef, useState } from 'react';
import { matchScenario } from '../data/mockScenarioMatches';
import { OnboardingSurveyResult } from '../onboardingTypes';
import { ScenarioDifficulty, ScenarioMatchResult } from '../scenarioTypes';

interface ScenarioMatchScreenProps {
  surveyResult: OnboardingSurveyResult;
  onStart: (match: ScenarioMatchResult) => void;
  onRestartSurvey: () => void;
}

const DIFFICULTY_STYLES: Record<ScenarioDifficulty, string> = {
  기초: 'border-[#177245] bg-[#EDF8F0] text-[#145C38]',
  균형: 'border-[#004080] bg-[#EAF3FF] text-[#004080]',
  도전: 'border-[#B44A00] bg-[#FFF3E8] text-[#8A3600]',
};

export const ScenarioMatchScreen: React.FC<ScenarioMatchScreenProps> = ({
  surveyResult,
  onStart,
  onRestartSurvey,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const matchedScenario = useMemo(() => matchScenario(surveyResult), [surveyResult]);

  useEffect(() => {
    setIsAnalyzing(true);
    const analysisDelay = window.setTimeout(() => setIsAnalyzing(false), 1050);
    return () => window.clearTimeout(analysisDelay);
  }, [surveyResult]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [isAnalyzing]);

  if (isAnalyzing) {
    return (
      <div className="min-h-dvh bg-[#E7EBEF] text-black font-gulim flex flex-col">
        <header className="bg-[#004080] text-white border-b-2 border-black">
          <div className="w-full max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white text-[#004080] border border-white font-black flex items-center justify-center text-xs">
                S:T
              </div>
              <div>
                <div className="text-base font-black">설문 응답 분석</div>
                <div className="text-[11px] text-blue-100">교육 시나리오 자동 매칭</div>
              </div>
            </div>
            <span className="border border-blue-200 bg-[#002B57] px-3 py-1 text-xs font-bold">
              2단계 / 시나리오 설정
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-8 sm:pt-8 sm:pb-12">
          <section
            className="w-full bg-white border-2 border-black"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-labelledby="scenario-analysis-title"
          >
            <div className="bg-[#E0E0E0] border-b border-black px-4 py-2 text-xs font-bold flex justify-between gap-3">
              <span>응답 분석</span>
              <span className="font-mono">MATCHING</span>
            </div>

            <div className="p-4 sm:p-7 text-center">
              <div
                className="mx-auto h-10 w-10 sm:h-12 sm:w-12 border-4 border-[#B8C6D6] border-t-[#004080] animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <h1
                id="scenario-analysis-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-4 text-[20px] leading-tight sm:text-2xl font-black focus:outline-none"
              >
                설문 응답을 분석하고 있습니다
              </h1>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                선택한 판단 습관과 학습 목표를 바탕으로 교육용 시나리오를 구성합니다.
              </p>

              <div className="mt-4 sm:mt-5 grid grid-cols-3 border border-black text-xs">
                {[
                  { label: '판단 성향 확인', compactLabel: '성향 확인' },
                  { label: '학습 초점 구성', compactLabel: '초점 구성' },
                  { label: '연습 자산 배정', compactLabel: '자산 배정' },
                ].map((step, index) => (
                  <div
                    key={step.label}
                    className={`min-h-[68px] p-2 sm:min-h-0 sm:p-3 bg-[#F8F9FA] flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-center sm:text-left ${
                      index < 2 ? 'border-r border-black' : ''
                    }`}
                  >
                    <span className="w-5 h-5 shrink-0 bg-[#004080] text-white font-mono font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-bold sm:hidden">{step.compactLabel}</span>
                    <span className="hidden sm:inline font-bold">{step.label}</span>
                  </div>
                ))}
              </div>
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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-[#004080] border border-white font-black flex items-center justify-center text-xs">
              S:T
            </div>
            <div>
              <div className="text-base font-black">시나리오 매칭 결과</div>
              <div className="text-[11px] text-blue-100">위험 대응 시뮬레이션 준비</div>
            </div>
          </div>
          <span className="border border-blue-200 bg-[#002B57] px-3 py-1 text-xs font-bold">
            2단계 / 배정 완료
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <section className="bg-white border-2 border-black" aria-labelledby="scenario-result-title">
          <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-black">교육 시나리오 배정 결과</span>
            <span className="font-mono">MATCH COMPLETE</span>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b-2 border-black pb-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[11px] font-black">
                    추천 연습 과정
                  </span>
                  <span
                    className={`border px-2 py-0.5 text-[11px] font-black ${DIFFICULTY_STYLES[matchedScenario.difficulty]}`}
                  >
                    교육 난이도: {matchedScenario.difficulty}
                  </span>
                </div>
                <h1
                  id="scenario-result-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-2xl sm:text-3xl font-black leading-tight focus:outline-none"
                >
                  {matchedScenario.name}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-gray-700 leading-relaxed">
                  {matchedScenario.summary}
                </p>
              </div>

              <div className="shrink-0 border border-black bg-[#F8F9FA] px-4 py-3 text-xs lg:text-right">
                <div className="text-gray-500 font-bold">분석한 설문 응답</div>
                <div className="mt-1 text-lg font-black font-mono text-[#004080]">
                  {surveyResult.answers.length}문항
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
              <section className="border border-black" aria-labelledby="match-reasons-title">
                <h2
                  id="match-reasons-title"
                  className="bg-[#E0E0E0] border-b border-black px-3 py-2 text-sm font-black"
                >
                  이 시나리오가 선정된 이유
                </h2>
                <ul className="p-3 space-y-2 text-xs sm:text-sm">
                  {matchedScenario.matchReasons.map((reason, index) => (
                    <li key={reason} className="flex items-start gap-2 leading-relaxed">
                      <span className="mt-0.5 w-5 h-5 shrink-0 bg-[#004080] text-white font-mono font-black text-[11px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="border border-black" aria-labelledby="focus-areas-title">
                <h2
                  id="focus-areas-title"
                  className="bg-[#E0E0E0] border-b border-black px-3 py-2 text-sm font-black"
                >
                  이번 평가의 학습 초점
                </h2>
                <div className="p-3 flex flex-wrap gap-2">
                  {matchedScenario.focusAreas.map((area, index) => (
                    <span
                      key={area}
                      className="border border-[#004080] bg-[#EAF3FF] text-[#004080] px-3 py-2 text-xs font-black"
                    >
                      {String(index + 1).padStart(2, '0')} · {area}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-4 border border-black" aria-labelledby="matched-assets-title">
              <div className="bg-[#004080] text-white border-b border-black px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="matched-assets-title" className="text-sm font-black">
                  배정된 평가 자산 3종
                </h2>
                <span className="text-[11px] text-blue-100">평가 중 자유롭게 이동할 수 있습니다.</span>
              </div>
              <ol className="grid grid-cols-1 md:grid-cols-3">
                {matchedScenario.assets.map((asset, index) => (
                  <li
                    key={`${asset.name}-${asset.type}`}
                    className={`p-4 bg-white ${
                      index < matchedScenario.assets.length - 1
                        ? 'border-b md:border-b-0 md:border-r border-black'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-[#FFE600] border border-black px-1.5 py-0.5 text-[11px] font-black font-mono">
                        문항 {index + 1}
                      </span>
                      <span className="text-[11px] font-bold text-[#004080]">{asset.type}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-black leading-snug">{asset.name}</h3>
                    <p className="mt-2 text-xs text-gray-600 leading-relaxed">{asset.reason}</p>
                  </li>
                ))}
              </ol>
            </section>

            <aside className="mt-4 border border-black bg-[#FFFBE6] p-3 text-xs leading-relaxed text-gray-800">
              <div className="font-black mb-1">교육용 자동 매칭 안내</div>
              <p>
                이 결과는 응답에 맞춰 연습 난이도와 학습 포인트를 구성한 목업입니다. 투자 성향의
                총점, 금융상품 적합성 또는 투자 가능 여부를 판정하지 않으며 실제 투자 추천이 아닙니다.
              </p>
            </aside>
          </div>

          <div className="bg-[#E0E0E0] border-t border-black p-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRestartSurvey}
              className="min-h-11 bg-white hover:bg-gray-100 text-black border-2 border-black px-5 py-2 text-xs font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
            >
              ← 설문 다시하기
            </button>
            <button
              type="button"
              onClick={() => onStart(matchedScenario)}
              className="min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
            >
              6분 평가 시작 →
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-[#D4D0C8] border-t border-black px-4 py-1.5 text-[10px] text-gray-700">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap justify-between gap-2">
          <span>SAFE:T 교육용 위험 대응 시뮬레이션</span>
          <span>평가 시작 버튼을 누른 뒤 제한 시간이 시작됩니다.</span>
        </div>
      </footer>
    </div>
  );
};
