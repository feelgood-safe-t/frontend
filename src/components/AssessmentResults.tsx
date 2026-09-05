import type { RecordSnapshot } from "../assessment/types";
import {
  CLOSE_LABELS,
  RUBRIC,
  summarizeEvaluation,
  type EvaluationReport,
} from "../assessment/domain";
import { BehaviorTimeline } from "./BehaviorTimeline";
import { Panel } from "./AssessmentLayout";

export function RubricTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left mb-3">
          각 문항 100점 · 세 문항의 평균으로 최종 점수 산정
        </caption>
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">평가 항목</th>
            <th className="border p-2">배점</th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC.map((rule) => (
            <tr key={rule.id}>
              <th className="border p-2 text-left font-normal">{rule.label}</th>
              <td className="border p-2 text-center font-mono">{rule.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssessmentResults({ record }: { record: RecordSnapshot }) {
  const responded = record.session.items.filter(
    (i) => i.answerStatus === "ANSWERED",
  ).length;
  return (
    <>
      <Panel title="평가 제출 완료">
        <h1 className="text-2xl font-black">판단 기록을 제출했습니다.</h1>
        <p className="mt-3 text-sm leading-7">
          3문항 중 {responded}문항에 판단을 남겼습니다.{" "}
          {responded < 3 ? "미응답 문항은 0점으로 처리됩니다. " : ""}판단·열람
          기록을 아래에서 확인할 수 있습니다. 분석 결과는 아직 제공되지
          않습니다.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          평가 형식 3×3분 ·{" "}
          {record.session.endedAt &&
            new Date(record.session.endedAt).toLocaleString("ko-KR")}
        </p>
      </Panel>
      <div className="grid sm:grid-cols-3 gap-3">
        {record.session.items.map((i) => (
          <Panel key={i.assessmentItemId} title={`문항 ${i.ordinal}`}>
            <p className="font-bold">
              {record.itemInfo[i.assessmentItemId]?.asset.displayName ??
                `문항 ${i.ordinal}`}
            </p>
            <p className="text-sm mt-2">
              {i.answerStatus === "ANSWERED"
                ? "응답 완료 · 평가 대상"
                : "미응답 · 0점"}
            </p>
            <p className="text-xs mt-2 text-gray-600">
              판단 {i.responseCount}회 ·{" "}
              {CLOSE_LABELS[i.closeReason ?? ""] ?? "종료"}
            </p>
          </Panel>
        ))}
      </div>
      <Panel title="전체 판단·뉴스 열람 타임라인">
        <BehaviorTimeline events={record.events} session={record.session} />
      </Panel>
      <Panel title="과정 평가 기준">
        <RubricTable />
        <p className="mt-3 text-xs leading-6">
          방향 적중률이나 가상 수익률은 평가하지 않습니다. 설문 선택지 자체에
          점수를 주지 않고, 처음 밝힌 성향과 실제 판단 과정이 어떻게
          이어졌는지를 함께 살펴봅니다.
        </p>
      </Panel>
    </>
  );
}

// Standalone demonstration, never used to grade a participant or saved as their result.
const SAMPLE_REPORT: EvaluationReport = {
  rubricVersion: "sample-process-rubric-v1",
  snapshotHash: "sample",
  promptVersion: "sample",
  modelVersion: "sample",
  outputHash: "sample",
  items: [1, 2, 3].map((ordinal, index) => ({
    ordinal,
    answerStatus: "ANSWERED" as const,
    criteria: RUBRIC.map((rule, i) => ({
      id: rule.id,
      score: [
        [16, 12, 12, 12, 12, 8, 8],
        [15, 11, 11, 11, 11, 7, 8],
        [17, 13, 13, 12, 12, 9, 8],
      ][index][i],
      evidence: [
        "거래량 증가와 가격 변동을 함께 근거로 남겼습니다.",
        "확정되지 않은 전망을 접한 뒤 확신도를 낮췄습니다.",
        "판단 전에 관련 뉴스 상세 내용을 열어 확인했습니다.",
        "캔들과 거래량의 변화를 방향 판단과 연결했습니다.",
        "정보를 교차 확인한다는 설문 응답이 실제 열람과 연결됐습니다.",
        "새로운 정보가 나타난 뒤 근거와 확신도를 함께 갱신했습니다.",
        "선택한 근거가 당시 공개된 시장 상황과 연결됐습니다.",
      ][i],
    })),
  })),
  strengths: [
    "뉴스를 확인한 뒤 판단을 기록하고, 불확실성이 커지면 확신도를 조절했습니다.",
  ],
  improvements: [
    "첫 판단에서는 거래량 변화에 대한 근거가 부족했습니다. 가격과 거래량을 함께 비교해 보세요.",
  ],
  nextLearning: [
    "출처가 다른 정보를 비교하는 연습",
    "급변 구간에서 근거와 확신도를 함께 기록하는 연습",
  ],
};
export function SampleReport() {
  const score = summarizeEvaluation(SAMPLE_REPORT);
  return (
    <>
      <Panel title="샘플 보고서">
        <h1 className="text-2xl font-black">과정 평가 결과 예시</h1>
        <p className="mt-3 text-sm">
          화면 확인을 위한 예시입니다. 실제 평가 결과나 발급된 인증이 아닙니다.
        </p>
        <div className="my-5 flex items-baseline gap-3">
          <strong className="font-mono text-4xl text-blue-900">
            {score.finalScore.toFixed(1)}
          </strong>
          <span>/ 100 · {score.isPassed ? "통과 예시" : "학습 보완 예시"}</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left">평가 항목</th>
                {[1, 2, 3].map((n) => (
                  <th className="border p-2" key={n}>
                    문항 {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RUBRIC.map((rule) => (
                <tr key={rule.id}>
                  <th className="border p-2 text-left font-normal">
                    {rule.label} / {rule.max}
                  </th>
                  {SAMPLE_REPORT.items.map((item) => (
                    <td key={item.ordinal} className="border p-2 text-center">
                      {item.criteria.find((c) => c.id === rule.id)?.score}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-bold">
                <th className="border p-2 text-left">문항 점수</th>
                {score.itemScores.map((n, i) => (
                  <td className="border p-2 text-center" key={i}>
                    {n}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="판단 과정 피드백">
        <div className="space-y-4 text-sm">
          {[
            ["잘한 판단", SAMPLE_REPORT.strengths],
            ["개선할 판단 습관", SAMPLE_REPORT.improvements],
            ["추천 후속 학습", SAMPLE_REPORT.nextLearning],
          ].map(([title, values]) => (
            <section key={title as string}>
              <h3 className="font-bold mb-2">{title}</h3>
              <ul className="list-disc pl-5 space-y-2">
                {(values as string[]).map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </section>
          ))}
          {SAMPLE_REPORT.items.map((item) => (
            <details key={item.ordinal}>
              <summary className="cursor-pointer font-bold">
                문항 {item.ordinal} · 응답 완료 · 문항 완료 · 항목별 근거 예시
              </summary>
              <ul className="mt-3 space-y-2">
                {item.criteria.map((c) => (
                  <li key={c.id}>
                    <strong>{RUBRIC.find((r) => r.id === c.id)?.label}</strong>
                    <p className="mt-1">{c.evidence}</p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Panel>
      <Panel title="INVEST PASS L1 · 인증서 예시">
        <div className="border-2 border-blue-900 p-5 text-center">
          <p className="text-xs font-bold text-red-700 mb-3">
            SAMPLE · 실제 발급 인증 아님
          </p>
          <h2 className="text-2xl font-black text-blue-900">INVEST PASS L1</h2>
          <p className="mt-2 text-sm">
            9-Minute / 3-Question Market Judgment Assessment
          </p>
          <p className="mt-4 text-sm">
            평가 형식 3×3분 · 시장 판단 과정 평가 ·{" "}
            {score.finalScore.toFixed(1)}점
          </p>
          <p className="mt-2 text-xs">
            시나리오 유형: 비용 상승 · 수요 불확실성 · 공급 회복
          </p>
          <p className="mt-2 text-xs">
            인증 코드 SAMPLE-L1 · 발급일 및 검증 주소는 실제 발급 시 제공됩니다.
          </p>
          <p className="mt-5 text-xs leading-6">
            본 인증은 Safe-T가 발급하는 자체 교육 인증이며, 공인 금융 자격 또는
            실제 투자 적격성을 의미하지 않습니다.
          </p>
        </div>
      </Panel>
    </>
  );
}
