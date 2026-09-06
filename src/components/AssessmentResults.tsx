import { useState } from "react";
import type { RecordSnapshot } from "../assessment/types";
import type {
  EvaluationItemScore,
  EvaluationResult,
  PassArtifact,
} from "../assessment/pocTypes";
import { RUBRIC } from "../assessment/domain";
import { BehaviorTimeline } from "./BehaviorTimeline";
import { buttonClass, Dialog, Panel, secondaryClass } from "./AssessmentLayout";

export function RubricTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left mb-3">
          각 문항 100점 · 3개 문항을 동일 비율로 최종 점수에 반영
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
  const evaluation = record.evaluation;
  const [certificateOpen, setCertificateOpen] = useState(false);
  const responded = record.session.items.filter(
    (i) => i.answerStatus === "ANSWERED",
  ).length;
  return (
    <>
      {evaluation ? (
        <>
          <EvaluationSummary
            evaluation={evaluation}
            endedAt={record.session.endedAt}
            onOpenCertificate={
              evaluation.passed &&
              evaluation.verdict === "PASS" &&
              evaluation.passArtifact
                ? () => setCertificateOpen(true)
                : undefined
            }
          />
          <EvaluationTabs record={record} evaluation={evaluation} />
          {certificateOpen && evaluation.passArtifact && (
            <CertificateDialog
              artifact={evaluation.passArtifact}
              endedAt={record.session.endedAt}
              onClose={() => setCertificateOpen(false)}
            />
          )}
        </>
      ) : (
        <>
          <Panel title="판단 기록">
            <h1 className="text-2xl font-black">판단 과정을 돌아보세요.</h1>
            <p className="mt-3 text-sm leading-7">
              3문항 중 {responded}문항에 판단을 남겼습니다. 판단·열람 기록을
              아래에서 확인할 수 있습니다.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {record.mode === "demo"
                ? "데모 기록에는 실제 평가 점수와 PASS가 제공되지 않습니다."
                : "이 기록에는 평가 결과가 없습니다. 점수와 PASS 여부를 확인할 수 없습니다."}
            </p>
          </Panel>
          <Panel title="판단·뉴스 열람 기록">
            <BehaviorTimeline events={record.events} session={record.session} />
          </Panel>
        </>
      )}
    </>
  );
}

const formatScore = (score: number) =>
  score.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

function EvaluationSummary({
  evaluation,
  endedAt,
  onOpenCertificate,
}: {
  evaluation: EvaluationResult;
  endedAt: string | null;
  onOpenCertificate?: () => void;
}) {
  return (
    <>
      <p className="px-1 text-xs text-gray-600">
        평가 형식 3×3분
        {endedAt && <> · 종료 {new Date(endedAt).toLocaleString("ko-KR")}</>}
      </p>
      <Panel title="과정 평가 결과">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <p>
              <strong className="text-5xl font-black tabular-nums text-blue-900">
                {formatScore(evaluation.totalScore)}
              </strong>
              <span className="ml-2 text-sm">/ 100점</span>
            </p>
            <p
              className={`border px-3 py-1 text-sm font-black ${
                evaluation.verdict === "PASS"
                  ? "border-green-700 bg-green-100 text-green-800"
                  : "border-red-700 bg-red-100 text-red-800"
              }`}
            >
              {evaluation.verdict === "PASS"
                ? "PASS · 통과"
                : "FAIL · 학습 보완"}
            </p>
          </div>
          <RubricHelp passThreshold={evaluation.passThreshold} />
        </div>
        <p className="mt-4 text-sm leading-7">
          3문항 중 {evaluation.answeredItemCount}문항 응답
        </p>
        <p className="mt-2 text-xs leading-6 text-gray-600">
          점수는 소수점 둘째 자리까지 반올림해 표시합니다.
        </p>
        {onOpenCertificate && (
          <button
            type="button"
            className={`${buttonClass} mt-4`}
            onClick={onOpenCertificate}
          >
            인증서 발급하기
          </button>
        )}
      </Panel>
    </>
  );
}

export function RubricHelp({ passThreshold }: { passThreshold: number }) {
  return (
    <details className="group relative shrink-0">
      <summary
        aria-label="과정 평가 기준 보기"
        className="flex h-7 w-7 cursor-pointer list-none items-center justify-center border border-gray-500 bg-white text-sm font-black text-gray-700 hover:border-black [&::-webkit-details-marker]:hidden"
      >
        ?
      </summary>
      <div className="absolute right-0 top-9 z-20 w-[min(82vw,340px)] border border-black bg-white p-3 text-xs">
        <h3 className="mb-2 font-black">과정 평가 기준</h3>
        <p className="mb-3 leading-5 text-gray-700">
          통과 기준 {passThreshold}점 · 3개 문항의 반올림 전 평균으로 PASS를
          결정합니다.
        </p>
        <RubricTable />
        <p className="mt-3 leading-5 text-gray-600">
          방향 적중률이나 수익률이 아닌, 설문과 실제 판단 과정의 연결을
          평가합니다.
        </p>
        <p className="mt-2 leading-5 text-gray-600">
          근거 태그와 확신도는 필수이고 직접 설명은 선택이며, 문항 하나라도
          미응답이면 통과할 수 없습니다.
        </p>
      </div>
    </details>
  );
}

function EvaluationTabs({
  record,
  evaluation,
}: {
  record: RecordSnapshot;
  evaluation: EvaluationResult;
}) {
  const [selectedOrdinal, setSelectedOrdinal] = useState(1);
  const item = evaluation.itemScores.find(
    (candidate) => candidate.ordinal === selectedOrdinal,
  )!;
  const sessionItem = record.session.items.find(
    (candidate) => candidate.ordinal === selectedOrdinal,
  )!;
  const itemEvents = record.events.filter(
    (entry) => entry.event.assessmentItemId === sessionItem.assessmentItemId,
  );
  return (
    <Panel title="평가와 피드백">
      <div
        role="tablist"
        aria-label="문항별 평가 결과"
        className="grid grid-cols-3 gap-2"
      >
        {evaluation.itemScores.map((candidate) => {
          const summary = record.session.items.find(
            (value) => value.ordinal === candidate.ordinal,
          )!;
          const code = record.itemInfo[summary.assessmentItemId]?.asset.alias;
          const selected = candidate.ordinal === selectedOrdinal;
          return (
            <button
              key={candidate.ordinal}
              id={`evaluation-tab-${candidate.ordinal}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="evaluation-tabpanel"
              onClick={() => setSelectedOrdinal(candidate.ordinal)}
              className={`min-w-0 border px-2 py-3 text-center transition-colors ${
                selected
                  ? "border-2 border-blue-900 bg-blue-50 text-blue-950"
                  : "border-gray-400 bg-white text-gray-700 hover:border-gray-700"
              }`}
            >
              <span className="flex flex-col items-center gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="block max-w-full truncate font-black">
                  문항 {candidate.ordinal}
                  {code && (
                    <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                      {code}
                    </span>
                  )}
                </span>
                <span className="flex items-baseline justify-center gap-1 whitespace-nowrap">
                  <strong className="text-2xl font-black leading-none tabular-nums text-blue-900 sm:text-3xl">
                    {formatScore(candidate.itemScore)}
                  </strong>
                  <span className="text-[10px] font-normal text-gray-500 sm:text-xs">
                    /100
                  </span>
                </span>
              </span>
              {candidate.answerStatus === "UNANSWERED" && (
                <span className="mt-1 block text-[10px] font-bold text-red-700">
                  미응답
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section
        id="evaluation-tabpanel"
        role="tabpanel"
        aria-labelledby={`evaluation-tab-${item.ordinal}`}
        className="mt-5 border-t border-gray-300 pt-5"
      >
        {item.answerStatus === "UNANSWERED" ? (
          <section className="border border-red-700 bg-red-50 p-3 text-red-900">
            <h3 className="text-sm font-black">미응답 문항</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
              {item.summaryKo ||
                "판단 기록이 없어 이 문항의 과정 평가가 제공되지 않았습니다."}
            </p>
          </section>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {item.summaryKo}
          </p>
        )}
        {item.criterionScores.length > 0 && <CriterionResults item={item} />}
        {item.improvementsKo.length > 0 && (
          <section className="mt-4 border-l-2 border-blue-900 bg-blue-50 p-3">
            <h3 className="font-bold text-sm">다음에 연습할 점</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
              {item.improvementsKo.map((improvement, index) => (
                <li key={index}>{improvement}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="mt-6 border-t border-gray-300 pt-4">
          <h3 className="mb-2 text-sm font-black">판단·뉴스 열람</h3>
          <BehaviorTimeline
            events={itemEvents}
            session={record.session}
            showItem={false}
          />
        </section>
      </section>
    </Panel>
  );
}

function CriterionResults({ item }: { item: EvaluationItemScore }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-sm sm:table-auto">
        <caption className="mb-2 text-left font-bold">
          7개 평가 항목 · 점수와 판단 근거
        </caption>
        <colgroup>
          <col className="w-[28%] sm:w-auto" />
          <col className="w-[4.5rem] sm:w-auto" />
          <col className="sm:w-auto" />
        </colgroup>
        <thead>
          <tr className="bg-gray-100">
            <th scope="col" className="border p-2 text-left">
              평가 항목
            </th>
            <th
              scope="col"
              className="border px-1 py-2 whitespace-nowrap sm:p-2"
            >
              <span className="sm:hidden">
                점수
                <br />/ 배점
              </span>
              <span className="hidden sm:inline">점수 / 배점</span>
            </th>
            <th scope="col" className="border p-2 text-left">
              평가 근거
            </th>
          </tr>
        </thead>
        <tbody>
          {item.criterionScores.map((criterion) => (
            <tr key={criterion.criterionId}>
              <th
                scope="row"
                className="border p-2 text-left align-top font-normal"
              >
                {criterion.labelKo}
              </th>
              <td className="border px-1 py-2 text-center align-top whitespace-nowrap tabular-nums sm:p-2">
                <span className="block sm:inline">
                  {formatScore(criterion.score)}
                </span>
                <span className="block sm:inline">
                  {" "}
                  / {formatScore(criterion.maxScore)}
                </span>
              </td>
              <td className="border p-2 align-top whitespace-pre-wrap break-words leading-6">
                {criterion.rationaleKo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function certificateDocument(
  artifact: PassArtifact,
  endedAt: string | null,
) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character]!,
    );
  const ended = endedAt
    ? new Date(endedAt).toLocaleString("ko-KR")
    : "평가 완료";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>청노 ${escape(artifact.title)}</title><style>body{margin:0;padding:48px;background:#fff;color:#111;font-family:"Malgun Gothic",sans-serif}.certificate{max-width:760px;margin:auto;border:3px solid #004080;padding:64px 48px;text-align:center}.brand{color:#004080;font-weight:800}.title{font-size:42px;color:#004080;margin:32px 0 12px}.score{font-size:22px;font-weight:700}.meta,.disclaimer{margin-top:24px;font-size:13px;line-height:1.8;color:#555}@media print{body{padding:0}.certificate{max-width:none;min-height:85vh}}</style></head><body><main class="certificate"><p class="brand">청노 과정 평가 인증서</p><h1 class="title">${escape(artifact.title)}</h1><p class="score">${formatScore(artifact.score)} / 100 · 과정 평가 통과</p><p class="meta">평가 종료 ${escape(ended)}</p><p class="disclaimer">${escape(artifact.disclaimerKo)}<br>이 평가에 대한 교육용 결과이며, 공개 검증 코드가 발급된 인증서는 아닙니다.</p></main></body></html>`;
}

function saveCertificate(artifact: PassArtifact, endedAt: string | null) {
  const blob = new Blob([certificateDocument(artifact, endedAt)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cheongno-pass.html";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function CertificateCard({
  artifact,
  endedAt,
}: {
  artifact: PassArtifact;
  endedAt: string | null;
}) {
  return (
    <div className="certificate-print-root border-2 border-blue-900 p-5 text-center sm:p-8">
      <p className="text-xs font-black text-blue-900">청노 과정 평가 인증서</p>
      <h2 className="mt-5 text-3xl font-black text-blue-900">
        {artifact.title}
      </h2>
      <p className="mt-3 font-bold">
        {formatScore(artifact.score)} / 100 · 과정 평가 통과
      </p>
      {endedAt && (
        <p className="mt-3 text-xs text-gray-600">
          평가 종료 {new Date(endedAt).toLocaleString("ko-KR")}
        </p>
      )}
      <p className="mt-5 text-sm leading-7">{artifact.disclaimerKo}</p>
      <p className="mt-2 text-xs leading-6 text-gray-600">
        이 평가에 대한 교육용 결과이며, 공개 검증 코드가 발급된 인증서는
        아닙니다.
      </p>
    </div>
  );
}

function CertificateDialog({
  artifact,
  endedAt,
  onClose,
}: {
  artifact: PassArtifact;
  endedAt: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog title="INVEST PASS 인증서" onClose={onClose} panelHeader>
      <CertificateCard artifact={artifact} endedAt={endedAt} />
      <div className="certificate-actions mt-4 flex justify-end gap-2">
        <button
          type="button"
          className={secondaryClass}
          onClick={() => window.print()}
        >
          프린트하기
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => saveCertificate(artifact, endedAt)}
        >
          저장하기
        </button>
      </div>
    </Dialog>
  );
}
