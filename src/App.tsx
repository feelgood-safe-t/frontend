import { useEffect, useState } from "react";
import type { AssessmentController } from "./assessment/controller";
import type {
  Direction,
  News,
  Session,
  TimelineEvent,
} from "./assessment/types";
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
import { JudgmentDialog } from "./components/JudgmentDialog";

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
    [direction, setDirection] = useState<Direction | null>(null),
    [openedNews, setOpenedNews] = useState<{
      content: News;
      clientEventId: string;
    } | null>(null),
    [showHistory, setShowHistory] = useState(false),
    [showRules, setShowRules] = useState(false),
    [finish, setFinish] = useState(false);
  const news = openedNews?.content;
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
  return (
    <AssessmentLayout
      onHome={onHome}
      mode={controller.mode}
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
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs">문항 남은 시간</p>
            <strong
              className={`font-mono text-2xl ${remainingMs <= 30000 ? "text-red-700" : "text-blue-900"}`}
              role="timer"
            >
              {formatRemaining(remainingMs)}
            </strong>
          </div>
          <button
            className={secondaryClass}
            disabled={busy || pending}
            onClick={() => setFinish(true)}
          >
            시험 종료
          </button>
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
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(230px,1fr)] gap-4">
        <Panel title={`가격 흐름 · ${marketLabel(marketOffsetMs)} · 60배속`}>
          <MarketChart candles={market.candles} />
        </Panel>
        <Panel title="공개 구간 요약">
          <dl className="divide-y divide-gray-200 text-sm">
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
              <div key={label} className="py-3 flex justify-between gap-2">
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
      </div>
      <Panel title="공시·뉴스">
        <p className="text-xs text-gray-600 mb-3">
          목록을 보는 것과 상세 내용을 여는 것은 구분하여 기록합니다.
        </p>
        {market.news.length ? (
          <ul className="space-y-2">
            {market.news.map((content) => (
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
                <button
                  disabled={disabled}
                  className="text-left mt-2 font-bold text-sm underline underline-offset-4 min-h-11 disabled:opacity-40"
                  onClick={() => {
                    const clientEventId = crypto.randomUUID();
                    setOpenedNews({ content, clientEventId });
                    void controller.view(
                      item.assessmentItemId,
                      content.contentId,
                      clientEventId,
                    );
                  }}
                >
                  {content.title} →
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">아직 공개된 뉴스가 없습니다.</p>
        )}
      </Panel>
      <section className="sticky bottom-0 border-2 border-black bg-white p-3 sm:p-4 z-20">
        <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
          <p>
            현재까지 판단{" "}
            <strong>{Math.max(item.responseCount, judgments.length)}회</strong>
            {item.latestDirection &&
              ` · 최근 ${item.latestDirection === "UP" ? "▲ 상승" : "▼ 하락"}`}
          </p>
          <span className="text-gray-600">
            새 정보를 확인하고 판단을 추가할 수 있습니다.
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <button
            disabled={disabled}
            onClick={() => setDirection("UP")}
            className={secondaryClass + " !bg-red-50 !text-red-800"}
          >
            ▲ 상승 판단
          </button>
          <button
            disabled={disabled}
            onClick={() => setDirection("DOWN")}
            className={secondaryClass + " !bg-blue-50 !text-blue-900"}
          >
            ▼ 하락 판단
          </button>
          <button
            disabled={disabled || !item.scoreEligible}
            onClick={() => void controller.complete(item.assessmentItemId)}
            className={buttonClass + " col-span-2 sm:col-span-1"}
          >
            {item.ordinal === 3 ? "문항 완료·평가 제출" : "문항 완료 / 다음 →"}
          </button>
        </div>
        {!item.scoreEligible && (
          <p className="text-xs text-gray-600 mt-2">
            판단을 한 번 이상 기록하면 문항을 완료할 수 있습니다.
          </p>
        )}
        {expired && (
          <p role="status" className="text-sm mt-2">
            시간이 만료되어 다음 진행 상태를 확인하고 있습니다.
          </p>
        )}
      </section>
      {direction && (
        <JudgmentDialog
          direction={direction}
          item={item}
          controller={controller}
          busy={busy}
          pending={pending}
          error={error}
          onClose={() => setDirection(null)}
        />
      )}
      {news && (
        <Dialog title="뉴스 상세" onClose={() => setOpenedNews(null)}>
          <p className="text-xs mb-3">
            {news.sourceLabel} · {marketLabel(news.marketOffsetMs)}
          </p>
          <h3 className="font-bold text-lg mb-3">{news.title}</h3>
          <p className="text-sm leading-7 whitespace-pre-wrap">{news.body}</p>
          <div className="mt-4 border bg-gray-50 p-3 text-sm" role="status">
            {pending ? (
              <>
                <p>
                  {busy
                    ? "열람 기록을 저장하고 있습니다."
                    : "열람 기록의 저장 결과를 확인해 주세요."}
                </p>
                {!busy && (
                  <button
                    className={secondaryClass + " mt-2"}
                    onClick={() => void controller.retry()}
                  >
                    저장 결과 확인
                  </button>
                )}
              </>
            ) : events.some(
                (entry) =>
                  entry.kind === "view" &&
                  entry.event.clientEventId === openedNews?.clientEventId,
              ) ? (
              "열람 기록이 저장되었습니다."
            ) : (
              "열람 기록이 저장되지 않았습니다. 닫은 뒤 다시 열어 주세요."
            )}
          </div>
          <p className="border-t mt-4 pt-3 text-xs">
            {item.scenario.sourceState.mockRawSource
              ? "개발 검증용 콘텐츠"
              : "AI 가명화·재작성 시뮬레이션 콘텐츠"}
          </p>
        </Dialog>
      )}
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
