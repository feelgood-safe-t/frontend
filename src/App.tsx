import { useEffect, useState } from "react";
import type { AssessmentController } from "./assessment/controller";
import type { Session, TimelineEvent } from "./assessment/types";
import {
  formatRemaining,
  marketLabel,
  timing,
  visibleMarket,
} from "./assessment/domain";
import {
  AssessmentLayout,
  buttonClass,
  secondaryClass,
  Dialog,
  Panel,
  Rules,
} from "./components/AssessmentLayout";
import { BehaviorTimeline } from "./components/BehaviorTimeline";
import { MarketChart } from "./components/MarketChart";
import { JudgmentPanel } from "./components/JudgmentPanel";

interface Props {
  controller: AssessmentController;
  session: Session;
  events: TimelineEvent[];
  receivedAt: number;
  busy: boolean;
  pending: boolean;
  error: string;
  onHome: () => void;
}
export default function App({
  controller,
  session,
  events,
  receivedAt,
  busy,
  pending,
  error,
  onHome,
}: Props) {
  const item = session.currentItem!;
  const [now, setNow] = useState(Date.now()),
    [showHistory, setShowHistory] = useState(false),
    [showRules, setShowRules] = useState(false),
    [finish, setFinish] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const { remainingMs, marketOffsetMs } = timing(item, now - receivedAt),
    expired = remainingMs === 0;
  useEffect(() => {
    if (expired) void controller.sync();
  }, [expired, controller]);
  const market = visibleMarket(item.scenario, marketOffsetMs),
    last = market.candles.at(-1),
    base =
      item.scenario.candles.filter((c) => c.phase === "PRE_ROLL").at(-1)
        ?.close ??
      last?.open ??
      1;
  const change = last ? ((last.close - base) / base) * 100 : 0,
    disabled = busy || pending || expired;
  const judgments = events.filter(
    (e) =>
      e.kind === "judgment" &&
      e.event.assessmentItemId === item.assessmentItemId,
  );
  const newestNews = [...market.news].sort(
    (a, b) =>
      b.marketOffsetMs - a.marketOffsetMs ||
      b.availableAtOffsetMs - a.availableAtOffsetMs ||
      b.contentId.localeCompare(a.contentId),
  );
  return (
    <AssessmentLayout
      onHome={onHome}
      mode={controller.mode}
      fixedHeader={false}
      actions={
        <>
          <button
            className="border border-white px-3 py-2 text-sm"
            onClick={() => setShowRules(true)}
          >
            평가 안내
          </button>
          <button
            className="border border-white px-3 py-2 text-sm"
            onClick={() => setShowHistory(true)}
          >
            판단 기록
          </button>
        </>
      }
    >
      <section className="sticky top-0 z-20 border-2 border-black bg-white px-3 py-3 flex flex-wrap justify-between gap-3 items-center">
        <div>
          <p className="text-xs text-gray-600">현재 문항 {item.ordinal} / 3</p>
          <h1 className="font-black text-xl">
            {item.scenario.asset.displayName}
          </h1>
          <p className="mt-0.5 text-xs font-bold text-gray-700">
            가명 위험자산
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-xs">문항 남은 시간</p>
            <strong
              className={`font-mono text-2xl ${remainingMs <= 30000 ? "text-red-700" : "text-blue-900"}`}
              role="timer"
            >
              {formatRemaining(remainingMs)}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`${buttonClass} whitespace-nowrap`}
              disabled={disabled || !item.scoreEligible}
              onClick={() => void controller.complete(item.assessmentItemId)}
            >
              문항 완료
            </button>
            <button
              className={`${secondaryClass} whitespace-nowrap`}
              disabled={busy || pending}
              onClick={() => setFinish(true)}
            >
              시험 종료
            </button>
          </div>
        </div>
      </section>
      <ol aria-label="문항 진행 상태" className="grid grid-cols-3 gap-2">
        {session.items.map((i) => (
          <li
            key={i.assessmentItemId}
            aria-current={i.status === "ACTIVE" ? "step" : undefined}
            className={`border p-3 text-sm ${i.status === "ACTIVE" ? "border-blue-800 bg-blue-50 font-bold" : "border-gray-400 bg-white text-gray-600"}`}
          >
            문항 {i.ordinal}
            <span className="block text-xs mt-1">
              {i.status === "LOCKED"
                ? "🔒 시작 전"
                : i.status === "ACTIVE"
                  ? `진행 중 · 판단 ${i.responseCount}회`
                  : i.answerStatus === "ANSWERED"
                    ? "완료"
                    : "미응답 종료"}
            </span>
          </li>
        ))}
      </ol>
      {item.scenario.sourceState.mockRawSource && (
        <p className="text-xs border bg-yellow-50 p-3">
          개발 검증용 원천 데이터 · 공개 배포 시에는 표시되지 않습니다.
        </p>
      )}
      <Panel title={item.scenario.brief.title}>
        <p className="text-sm leading-relaxed">{item.scenario.brief.summary}</p>
      </Panel>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="min-w-0 space-y-4">
          <Panel title={`가격 흐름 · ${marketLabel(marketOffsetMs)} · 60배속`}>
            <MarketChart candles={market.candles} />
          </Panel>
          <Panel title="공개 구간 요약">
            <dl className="grid sm:grid-cols-2 gap-x-5 text-sm">
              {[
                ["현재가", last?.close.toFixed(3) ?? "—"],
                ["시작 기준가", base.toFixed(3)],
                ["시작 대비", `${change > 0 ? "+" : ""}${change.toFixed(2)}%`],
                [
                  "공개 구간 고가",
                  market.candles.length
                    ? Math.max(...market.candles.map((c) => c.high)).toFixed(3)
                    : "—",
                ],
                [
                  "공개 구간 저가",
                  market.candles.length
                    ? Math.min(...market.candles.map((c) => c.low)).toFixed(3)
                    : "—",
                ],
                [
                  "공개 구간 거래량",
                  market.candles
                    .reduce((sum, c) => sum + c.volume, 0)
                    .toLocaleString(undefined, { maximumFractionDigits: 2 }),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-gray-200 py-2 flex justify-between gap-2"
                >
                  <dt>{label}</dt>
                  <dd className="font-mono font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-gray-600 mt-3">
              {item.scenario.asset.priceScale === "RAW_MOCK"
                ? "개발용 가격"
                : "정규화 가격"}{" "}
              · 미래 구간은 표시되지 않습니다.
            </p>
          </Panel>
          <Panel title="공시·뉴스">
            <p className="text-xs text-gray-600 mb-3">
              공개된 뉴스 본문을 바로 확인할 수 있습니다. 읽음 표시를 누르면
              해당 뉴스의 열람 기록이 저장됩니다.
            </p>
            {newestNews.length ? (
              <ul className="space-y-2">
                {newestNews.map((content) => {
                  const viewed = events.some(
                    (entry) =>
                      entry.kind === "view" &&
                      entry.event.assessmentItemId === item.assessmentItemId &&
                      entry.event.contentId === content.contentId,
                  );
                  return (
                    <li
                      key={content.contentId}
                      className="border border-gray-400 p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600">
                        <span>
                          {content.sourceLabel} ·{" "}
                          {marketLabel(content.marketOffsetMs)}
                        </span>
                        <span className="border border-blue-300 bg-blue-50 text-blue-900 px-2 py-1">
                          {item.scenario.sourceState.mockRawSource
                            ? "개발 검증용 콘텐츠"
                            : "AI 가명화·재작성 시뮬레이션 콘텐츠"}
                        </span>
                      </div>
                      <h3 className="mt-3 font-bold text-sm leading-6 break-words">
                        {content.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 whitespace-pre-wrap break-words">
                        {content.body}
                      </p>
                      <button
                        disabled={disabled}
                        className={secondaryClass + " mt-3"}
                        aria-label={`${content.title} ${viewed ? "다시 읽음 표시" : "읽음 표시"}`}
                        onClick={() =>
                          void controller.view(
                            item.assessmentItemId,
                            content.contentId,
                          )
                        }
                      >
                        {viewed
                          ? "✓ 읽음 기록됨 · 다시 읽음 표시"
                          : "읽음 표시"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm">아직 공개된 뉴스가 없습니다.</p>
            )}
          </Panel>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <Panel title="판단 입력">
            <JudgmentPanel
              item={item}
              controller={controller}
              judgmentCount={Math.max(item.responseCount, judgments.length)}
              busy={busy}
              pending={pending}
              error={error}
              expired={expired}
            />
            {expired && (
              <p role="status" className="text-sm mt-2">
                시간이 만료되어 다음 진행 상태를 확인하고 있습니다.
              </p>
            )}
          </Panel>
        </aside>
      </div>
      {showHistory && (
        <Dialog
          title="전체 판단·열람 기록"
          onClose={() => setShowHistory(false)}
        >
          <BehaviorTimeline events={events} session={session} />
        </Dialog>
      )}
      {showRules && (
        <Dialog title="평가 안내" onClose={() => setShowRules(false)}>
          <Rules />
        </Dialog>
      )}
      {finish && (
        <Dialog
          title="시험 종료"
          onClose={() => setFinish(false)}
          locked={busy}
        >
          <p className="text-sm leading-7">
            지금 종료하면 응답한 문항은 평가 대상으로 남고, 미응답 문항은 0점
            처리됩니다. 종료 자체에 별도 감점은 없습니다. 종료 후에는 판단을
            추가할 수 없습니다.
          </p>
          <ul className="my-4 text-sm space-y-2">
            {session.items.map((i) => (
              <li key={i.assessmentItemId}>
                문항 {i.ordinal} ·{" "}
                {i.responseCount ? `판단 ${i.responseCount}회` : "미응답"}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button
              disabled={busy}
              className={secondaryClass}
              onClick={() => setFinish(false)}
            >
              계속 응시
            </button>
            <button
              disabled={busy || pending}
              className={buttonClass}
              onClick={() => void controller.finish(item.assessmentItemId)}
            >
              제출 및 종료
            </button>
          </div>
        </Dialog>
      )}
    </AssessmentLayout>
  );
}
