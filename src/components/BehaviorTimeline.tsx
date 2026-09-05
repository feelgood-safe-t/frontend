import type { Session, TimelineEvent } from "../assessment/types";
import {
  CONFIDENCE_LABELS,
  marketLabel,
  REASON_LABELS,
} from "../assessment/domain";

export function BehaviorTimeline({
  events,
  session,
}: {
  events: TimelineEvent[];
  session: Session;
}) {
  if (!events.length)
    return (
      <p className="text-sm text-gray-600">
        아직 기록한 판단이나 뉴스 열람이 없습니다.
      </p>
    );
  return (
    <ol className="divide-y divide-gray-300">
      {events.map((entry) => (
        <li key={entry.event.eventId} className="py-3 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-mono text-gray-500">
              #{entry.event.sequence}
            </span>
            <span className="text-xs">
              문항{" "}
              {
                session.items.find(
                  (i) => i.assessmentItemId === entry.event.assessmentItemId,
                )?.ordinal
              }{" "}
              · {marketLabel(entry.event.marketOffsetMs)}
            </span>
            {entry.kind === "judgment" ? (
              <strong
                className={
                  entry.event.direction === "UP"
                    ? "text-red-700"
                    : "text-blue-800"
                }
              >
                {entry.event.direction === "UP" ? "▲ 상승" : "▼ 하락"} · 확신도{" "}
                {CONFIDENCE_LABELS[entry.event.confidence]}
              </strong>
            ) : (
              <strong>뉴스 상세 열람</strong>
            )}
          </div>
          {entry.kind === "judgment" ? (
            <div className="mt-2 space-y-1">
              <p>
                {entry.event.reasonTags
                  .map((r) => REASON_LABELS[r])
                  .join(" · ")}
              </p>
              {entry.event.reasonText && (
                <p className="whitespace-pre-wrap break-words text-gray-700">
                  {entry.event.reasonText}
                </p>
              )}
              <p className="text-xs text-gray-500">
                판단 시점 가격{" "}
                {entry.event.priceAtResponse.toLocaleString(undefined, {
                  maximumFractionDigits: 3,
                })}
              </p>
            </div>
          ) : (
            <details className="mt-2">
              <summary className="cursor-pointer">
                {entry.content.title} · {entry.content.sourceLabel}
              </summary>
              <p className="mt-2 whitespace-pre-wrap">{entry.content.body}</p>
              <p className="mt-2 text-xs text-gray-600">
                {entry.content.isMockRawSource
                  ? "개발 검증용 콘텐츠"
                  : "AI 가명화·재작성 시뮬레이션 콘텐츠"}
              </p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
