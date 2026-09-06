import type { OnboardingSurveyResult } from "../onboardingTypes";
import type { EvaluationResult, ProfileAnalysis } from "./pocTypes";
import { isSessionEnded } from "./domain";
import type {
  ItemInfo,
  JudgmentInput,
  Participant,
  Questionnaire,
  RecordSnapshot,
  Session,
  TimelineEvent,
} from "./types";
export const HISTORY_KEY = "safe-t:assessments:v2";
export const LEGACY_KEYS = [
  "safe-t:result-history:v1",
  "safe-t:last-result:v1",
];
export function getStorage(kind: "localStorage" | "sessionStorage"): Storage {
  try {
    return window[kind];
  } catch {
    const unavailable = () => {
      throw new Error(
        "저장 공간에 접근할 수 없습니다. 저장 권한을 확인해 주세요.",
      );
    };
    return {
      length: 0,
      clear: unavailable,
      getItem: unavailable,
      key: unavailable,
      removeItem: unavailable,
      setItem: unavailable,
    };
  }
}
export type Command =
  | { kind: "respond"; itemId: string; body: JudgmentInput }
  | {
      kind: "view";
      itemId: string;
      body: { clientEventId: string; contentId: string };
    }
  | { kind: "complete" | "finish"; itemId: string; key: string };
export interface Runtime {
  version: 2;
  participant?: Participant;
  questionnaire?: Questionnaire;
  draft?: Record<string, string[]>;
  survey?: OnboardingSurveyResult;
  surveyId?: string;
  surveyKey?: string;
  createKey?: string;
  sessionId?: string;
  session?: Session;
  events: TimelineEvent[];
  itemInfo: Record<string, ItemInfo>;
  pending?: Command;
  evaluation?: EvaluationResult;
  profileAnalysis?: ProfileAnalysis;
}
export const emptyRuntime = (): Runtime => ({
  version: 2,
  events: [],
  itemInfo: {},
});
export function readRuntime(storage: Storage, key: string): Runtime {
  const raw = storage.getItem(key);
  if (!raw) return emptyRuntime();
  const value = JSON.parse(raw);
  if (value.version !== 2 || !Array.isArray(value.events) || !value.itemInfo)
    throw new Error(
      "진행 정보를 읽을 수 없습니다. 리셋 후 다시 시작해 주세요.",
    );
  return value;
}
export function readHistory(storage: Storage): RecordSnapshot[] {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    value.some(
      (r) =>
        !r.id ||
        !r.session ||
        !isSessionEnded(r.session.status) ||
        !Array.isArray(r.events),
    )
  )
    throw new Error("평가 기록을 읽을 수 없습니다.");
  return value;
}
export function saveRecord(storage: Storage, record: RecordSnapshot) {
  const previous = readHistory(storage);
  const existing = previous.find((r) => r.id === record.id);
  let merged = record;
  if (existing) {
    // Another tab may have acknowledged events that this tab never received.
    // A later save must add to the immutable timeline, never replace it.
    const eventIds = new Set<string>();
    const requestIds = new Set<string>();
    const events = [...existing.events, ...record.events].filter((entry) => {
      // The backend scopes client event IDs by session and event type.
      const requestId = `${entry.kind}:${entry.event.clientEventId}`;
      const duplicate =
        eventIds.has(entry.event.eventId) || requestIds.has(requestId);
      eventIds.add(entry.event.eventId);
      requestIds.add(requestId);
      return !duplicate;
    });
    events.sort((a, b) => a.event.sequence - b.event.sequence);
    const rank = { CREATED: 0, ACTIVE: 1, ENDED: 2, SNAPSHOT_READY: 3 };
    const incomingIsNewer =
      rank[record.session.status] > rank[existing.session.status] ||
      (rank[record.session.status] === rank[existing.session.status] &&
        Date.parse(record.session.serverNow) >
          Date.parse(existing.session.serverNow));
    const newer = incomingIsNewer ? record : existing;
    const older = incomingIsNewer ? existing : record;
    merged = {
      ...newer,
      survey: newer.survey ?? older.survey,
      events,
      itemInfo: { ...older.itemInfo, ...newer.itemInfo },
      ...(newer.evaluation || older.evaluation
        ? { evaluation: newer.evaluation ?? older.evaluation }
        : {}),
      ...(newer.profileAnalysis || older.profileAnalysis
        ? { profileAnalysis: newer.profileAnalysis ?? older.profileAnalysis }
        : {}),
    };
  }
  storage.setItem(
    HISTORY_KEY,
    JSON.stringify([merged, ...previous.filter((r) => r.id !== record.id)]),
  );
  return merged;
}
export interface LegacyRecord {
  id: string;
  completedAt: string;
  title: string;
  judgmentCount: number;
  decisions: {
    assetName: string;
    direction: string;
    confidence: string;
    memo: string;
    submittedAt: string;
    reasons: string[];
  }[];
}
export function readLegacyHistory(storage: Storage): LegacyRecord[] {
  const entries: LegacyRecord[] = [];
  for (const key of LEGACY_KEYS) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const value = JSON.parse(raw),
      records = Array.isArray(value.results) ? value.results : [value];
    for (const r of records)
      if (r.resultId && !entries.some((e) => e.id === r.resultId))
        entries.push({
          id: r.resultId,
          completedAt: r.completedAt,
          title: r.scenario?.name ?? "이전 평가",
          judgmentCount: Array.isArray(r.decisions) ? r.decisions.length : 0,
          decisions: Array.isArray(r.decisions)
            ? r.decisions.map((d) => ({
                assetName: String(d.assetName ?? "문항"),
                direction: String(d.direction ?? ""),
                confidence: String(d.confidence ?? ""),
                memo: String(d.memo ?? ""),
                submittedAt: String(d.submittedAt ?? r.completedAt),
                reasons: Array.isArray(d.reasons)
                  ? d.reasons.filter((v) => typeof v === "string")
                  : [],
              }))
            : [],
        });
  }
  return entries;
}
