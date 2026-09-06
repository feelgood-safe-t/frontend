import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AssessmentResults,
  certificateDocument,
} from "../src/components/AssessmentResults";
import { ProfileAnalysis } from "../src/components/ProfileAnalysis";
import { Dialog, RadialLoader } from "../src/components/AssessmentLayout";
import { RUBRIC } from "../src/assessment/domain";
import type { EvaluationResult } from "../src/assessment/pocTypes";
import type { RecordSnapshot } from "../src/assessment/types";

function evaluation(): EvaluationResult {
  return {
    schemaVersion: "safe-t-evaluation-result/1.0",
    snapshotHash: "a".repeat(64),
    rubricVersion: "process-rubric/1.0",
    promptVersion: "evaluation/1.0",
    modelVersion: "test-model",
    reasoningEffort: "medium",
    resultRuleVersion: "result-rule/1.0",
    itemScores: [1, 2, 3].map((ordinal) => ({
      ordinal,
      scenarioId: `scenario-${ordinal}`,
      scenarioVersionId: `scenario-version-${ordinal}`,
      answerStatus: "ANSWERED",
      scoredBy: "LLM",
      criterionScores: RUBRIC.map((rule, index) => ({
        criterionId: rule.id,
        labelKo: rule.label,
        maxScore: rule.max,
        score: [16, 11, 11, 11, 11, 8, 8][index],
        rationaleKo: `문항 ${ordinal}의 ${rule.label} 평가 근거입니다.`,
      })),
      consistencyScore: 8,
      itemScore: 76,
      summaryKo: `문항 ${ordinal}의 판단 요약입니다.`,
      improvementsKo: [`문항 ${ordinal}에서 근거를 더 구체화해 보세요.`],
    })),
    answeredItemCount: 3,
    allItemsAnswered: true,
    totalScore: 76,
    passThreshold: 70,
    passed: true,
    verdict: "PASS",
    passArtifact: {
      schemaVersion: "safe-t-pass-artifact/1.0",
      artifactType: "INVEST_PASS",
      title: "INVEST PASS",
      snapshotHash: "a".repeat(64),
      score: 76,
      passThreshold: 70,
      rubricVersion: "process-rubric/1.0",
      promptVersion: "evaluation/1.0",
      modelVersion: "test-model",
      resultRuleVersion: "result-rule/1.0",
      disclaimerKo: "교육용 평가 결과이며 공인 금융 자격이 아닙니다.",
    },
  };
}

function record(result?: EvaluationResult): RecordSnapshot {
  return {
    id: "result-ui-record",
    mode: "api",
    session: {
      assessmentSessionId: "result-ui-session",
      status: "ENDED",
      questionCount: 3,
      answeredQuestionCount: 3,
      startedAt: "2026-09-06T00:00:00Z",
      endedAt: "2026-09-06T00:09:00Z",
      endReason: "ALL_ITEMS_CLOSED",
      serverNow: "2026-09-06T00:09:00Z",
      currentItem: null,
      items: [1, 2, 3].map((ordinal) => ({
        assessmentItemId: `item-${ordinal}`,
        ordinal,
        status: "CLOSED",
        answerStatus: "ANSWERED",
        responseCount: 1,
        scoreEligible: true,
        closeReason: "COMPLETED",
      })),
    },
    survey: null,
    events: [],
    itemInfo: Object.fromEntries(
      [1, 2, 3].map((ordinal) => [
        `item-${ordinal}`,
        {
          asset: {
            assetId: `asset-${ordinal}`,
            alias: `CODE${ordinal}`,
            displayName: `CODE${ordinal}`,
            priceScale: "NORMALIZED",
          },
          brief: { title: `문항 ${ordinal}`, summary: "테스트 문항" },
        },
      ]),
    ),
    ...(result ? { evaluation: result } : {}),
  };
}

test("actual evaluation renders compact item tabs and only the selected item's feedback", () => {
  const result = evaluation();
  const html = renderToStaticMarkup(
    createElement(AssessmentResults, { record: record(result) }),
  );
  assert.match(html, /76/);
  assert.match(html, /PASS · 통과/);
  assert.match(html, /border-green-700 bg-green-100 text-green-800/);
  assert.match(html, /통과 기준 70점/);
  assert.match(html, /점수는 소수점 둘째 자리까지 반올림해 표시합니다/);
  assert.match(html, /text-2xl font-black leading-none tabular-nums/);
  assert.ok(html.indexOf("평가 형식 3×3분") < html.indexOf("과정 평가 결과"));
  assert.doesNotMatch(html, /세 문항 평균 · 통과 기준/);
  assert.match(html, /CODE1/);
  assert.match(html, /text-\[10px\] font-normal text-gray-500/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.ok(html.includes(result.itemScores[0].summaryKo));
  assert.ok(html.includes(result.itemScores[0].improvementsKo[0]));
  for (const criterion of result.itemScores[0].criterionScores) {
    assert.ok(html.includes(criterion.labelKo));
    assert.ok(html.includes(criterion.rationaleKo));
  }
  assert.ok(!html.includes(result.itemScores[1].summaryKo));
  assert.ok(!html.includes(result.itemScores[2].summaryKo));
  assert.match(html, /인증서 발급하기/);
  assert.match(html, /class="grid grid-cols-3 gap-2"/);
  assert.match(html, />76<\/strong><span[^>]*>\/100<\/span>/);
  assert.match(html, /flex flex-col items-center gap-2 sm:flex-row/);
  assert.match(html, /block sm:inline/);
  assert.match(html, /w-\[4\.5rem\] sm:w-auto/);
  assert.match(html, /border px-1 py-2[^\"]*sm:p-2/);
  assert.match(html, /판단·뉴스 열람/);
  assert.match(html, /과정 평가 기준 보기/);
  assert.doesNotMatch(html, /평가 버전 정보/);
  assert.doesNotMatch(
    html,
    /전체 판단·뉴스 열람 타임라인|판단 과정 분석이 완료됐습니다|분석 결과는 아직 제공되지|인증 코드 SAMPLE/,
  );
});

test("rounded displayed score never overrides the server FAIL verdict or creates a PASS artifact", () => {
  const result = evaluation();
  result.totalScore = 70;
  result.passed = false;
  result.verdict = "FAIL";
  result.passArtifact = null;
  const html = renderToStaticMarkup(
    createElement(AssessmentResults, { record: record(result) }),
  );
  assert.match(html, /FAIL · 학습 보완/);
  assert.match(html, /border-red-700 bg-red-100 text-red-800/);
  assert.doesNotMatch(html, /PASS · 통과|인증서 발급하기/);
});

test("unanswered items restore their red explanation without invented criterion scores", () => {
  const result = evaluation();
  result.itemScores[0] = {
    ...result.itemScores[0],
    answerStatus: "UNANSWERED",
    scoredBy: "UNANSWERED_ZERO_RULE",
    criterionScores: [],
    consistencyScore: null,
    itemScore: 0,
    summaryKo: "판단 기록이 없는 문항입니다.",
    improvementsKo: [],
  };
  result.answeredItemCount = 2;
  result.allItemsAnswered = false;
  result.totalScore = 50.67;
  result.passed = false;
  result.verdict = "FAIL";
  result.passArtifact = null;
  const html = renderToStaticMarkup(
    createElement(AssessmentResults, { record: record(result) }),
  );
  assert.match(html, /50.67/);
  assert.match(html, /3문항 중 2문항 응답/);
  assert.match(html, />0<\/strong><span[^>]*>\/100<\/span>/);
  assert.match(html, /미응답/);
  assert.match(html, /border border-red-700 bg-red-50 p-3 text-red-900/);
  assert.match(html, /판단 기록이 없는 문항입니다/);
  assert.doesNotMatch(
    html,
    /항목별 AI 평가 없이 0점으로 처리됐습니다|문항 1의 위험 신호 인식과 대응 평가 근거/,
  );
});

test("certificate dialog uses panel chrome and a square close button", () => {
  const html = renderToStaticMarkup(
    createElement(Dialog, {
      title: "INVEST PASS 인증서",
      onClose: () => {},
      panelHeader: true,
      children: "인증서 내용",
    }),
  );
  assert.match(html, /border-b border-black bg-\[#E0E0E0\] px-4 py-1/);
  assert.match(html, /size-7 border border-black bg-white/);
});

test("radial loader renders twelve clockwise spinner rays", () => {
  const html = renderToStaticMarkup(
    createElement(RadialLoader, { label: "분석 중" }),
  );
  assert.match(html, /role="status" aria-label="분석 중"/);
  assert.match(html, /size-12 animate-spin/);
  assert.equal((html.match(/translateY\(-18px\)/g) ?? []).length, 12);
});

test("legacy and demo records do not claim successful submission or fabricated grading", () => {
  for (const mode of ["api", "demo"] as const) {
    const stored = { ...record(), mode };
    const html = renderToStaticMarkup(
      createElement(AssessmentResults, { record: stored }),
    );
    assert.match(html, /판단 기록/);
    assert.match(
      html,
      mode === "demo"
        ? /데모 기록에는 실제 평가 점수/
        : /이 기록에는 평가 결과가 없습니다/,
    );
    assert.doesNotMatch(
      html,
      /판단 기록을 제출했습니다|평가 제출 완료|PASS · 통과|FAIL · 학습 보완/,
    );
  }
});

test("a missing artifact stays absent even when the returned result passes", () => {
  const result = evaluation();
  result.passArtifact = null;
  const html = renderToStaticMarkup(
    createElement(AssessmentResults, { record: record(result) }),
  );
  assert.match(html, /PASS · 통과/);
  assert.doesNotMatch(html, /인증서 발급하기/);
});

test("onboarding profile displays the supplied analysis without an invented suitability rating", () => {
  const profile = {
    summary: "여러 정보를 비교하고 결정한다고 응답했습니다.",
    strengths: ["출처를 확인하는 습관"],
    weaknesses: ["불확실성을 기록하는 연습"],
    learningPriorities: ["뉴스와 가격 흐름 함께 비교하기"],
  };
  const html = renderToStaticMarkup(
    createElement(ProfileAnalysis, { profile }),
  );
  for (const text of [
    profile.summary,
    ...profile.strengths,
    ...profile.weaknesses,
    ...profile.learningPriorities,
  ]) {
    assert.ok(html.includes(text));
  }
  assert.match(html, /투자 적합성 진단이나 투자 추천이 아닙니다/);
});

test("downloadable certificate document keeps the score and disclaimer", () => {
  const result = evaluation();
  const html = certificateDocument(result.passArtifact!, null);
  assert.doesNotMatch(html, /SAMPLE|샘플/);
  assert.match(html, /76 \/ 100 · 과정 평가 통과/);
  assert.ok(html.includes(result.passArtifact!.disclaimerKo));
});
