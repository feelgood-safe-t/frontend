import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../data/onboardingQuestions";
import { ApiError } from "./api";
import { validateJudgment, visibleMarket } from "./domain";
import type { CurrentItem, Gateway, Scenario, Session } from "./types";

export const DEMO_STORAGE_KEY = "safe-t:demo-engine:v2";
const copy = <T>(value: T): T => structuredClone(value);
export function demoScenario(ordinal: number): Scenario {
  const names = ["누리테크", "한결소재", "온빛인프라"];
  const titles = [
    "예상 밖의 비용 상승",
    "새로운 수요와 엇갈린 신호",
    "공급 차질 이후의 회복",
  ];
  const summaries = [
    "원재료 비용이 상승하는 가운데 수요는 유지되고 있습니다. 가격·거래량과 새로 공개되는 설명을 비교하며 판단을 기록해 주세요.",
    "새로운 수요에 대한 기대가 커졌지만 구체적인 규모는 아직 확인되지 않았습니다. 정보의 불확실성을 판단 근거와 확신도에 반영해 주세요.",
    "공급 차질이 완화되고 있다는 소식과 수요 둔화 우려가 함께 나타납니다. 새로운 정보를 확인하면서 판단을 이어가 주세요.",
  ];
  const valueAt = (i: number) =>
    100 +
    Math.sin(i / (8 + ordinal)) * (0.8 + ordinal * 0.2) +
    Math.cos(i / 17) * 0.6 +
    (i > 100 ? Math.sin((i - 100) / 35) * (ordinal === 1 ? -4 : 3) : 0);
  const candles = Array.from({ length: 240 }, (_, i) => {
    const open = Number(valueAt(i).toFixed(3));
    const close = Number(valueAt(i + 1).toFixed(3));
    return {
      barId: `demo-${ordinal}-${i}`,
      time: 946684800 + i * 60,
      open,
      close,
      high: Number((Math.max(open, close) + 0.2 + (i % 4) * 0.02).toFixed(3)),
      low: Number((Math.min(open, close) - 0.2 - (i % 3) * 0.02).toFixed(3)),
      volume:
        400 + ((i * 79 + ordinal * 117) % 800) + (i > 100 && i < 130 ? 500 : 0),
      marketOffsetMs: (i - 60) * 60000,
      availableAtOffsetMs: i < 60 ? 0 : (i - 59) * 60000,
      phase: i < 60 ? ("PRE_ROLL" as const) : ("ASSESSMENT" as const),
    };
  });
  return {
    scenarioType: ["COST_PRESSURE", "DEMAND_UNCERTAINTY", "SUPPLY_RECOVERY"][
      ordinal - 1
    ],
    timeLimitSeconds: 180,
    replaySpeed: 60,
    asset: {
      assetId: `demo-asset-${ordinal}`,
      alias: `ST0${ordinal}`,
      displayName: names[ordinal - 1],
      priceScale: "NORMALIZED",
    },
    brief: { title: titles[ordinal - 1], summary: summaries[ordinal - 1] },
    candles,
    news: [
      {
        contentId: `demo-news-${ordinal}-1`,
        title: "주요 사업 현황 안내",
        body:
          summaries[ordinal - 1] +
          " 이번 발표에는 향후 실적에 대한 확정 수치가 포함되어 있지 않습니다.",
        sourceLabel: "기업 안내 · 가명 공시",
        marketOffsetMs: 0,
        availableAtOffsetMs: 0,
      },
      {
        contentId: `demo-news-${ordinal}-2`,
        title: "시장 참여자들의 전망 엇갈려",
        body: "최근 거래량 변화에 대한 해석이 엇갈립니다. 일부는 수요 회복의 신호로 보지만, 다른 참여자는 단기 변동일 수 있다고 설명했습니다. 두 의견 모두 확인된 미래 결과는 아닙니다.",
        sourceLabel: "새봄 경제 · 가명 뉴스",
        marketOffsetMs: 1800000,
        availableAtOffsetMs: 1800000,
      },
      {
        contentId: `demo-news-${ordinal}-3`,
        title: "추가 공급 일정에 대한 논의",
        body: "공급 일정 조정을 검토 중이라는 설명이 공개됐습니다. 구체적인 시행 시점과 규모는 아직 결정되지 않았습니다. 기존 판단에 영향을 주는 정보인지 확인해 주세요.",
        sourceLabel: "기업 안내 · 가명 공시",
        marketOffsetMs: 5400000,
        availableAtOffsetMs: 5400000,
      },
    ],
    sourceState: {
      mockRawSource: false,
      normalized: true,
      anonymized: true,
      participantSafe: true,
    },
  };
}
export interface DemoState {
  session: Session;
  nextSequence: number;
  receipts: Record<string, { body: string; value: unknown }>;
}
export function newDemoState(id: string, now: number): DemoState {
  return {
    nextSequence: 1,
    receipts: {},
    session: {
      assessmentSessionId: id,
      status: "CREATED",
      questionCount: 3,
      answeredQuestionCount: 0,
      startedAt: null,
      endedAt: null,
      endReason: null,
      serverNow: new Date(now).toISOString(),
      currentItem: null,
      items: [1, 2, 3].map((ordinal) => ({
        assessmentItemId: `${id}-item-${ordinal}`,
        ordinal,
        status: "LOCKED",
        answerStatus: null,
        responseCount: 0,
        scoreEligible: false,
        closeReason: null,
      })),
    },
  };
}
function activate(state: DemoState, ordinal: number, now: number) {
  const summary = state.session.items[ordinal - 1];
  summary.status = "ACTIVE";
  state.session.currentItem = {
    assessmentItemId: summary.assessmentItemId,
    ordinal,
    status: "ACTIVE",
    startedAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + 180000).toISOString(),
    remainingMs: 180000,
    currentMarketOffsetMs: 0,
    responseCount: 0,
    scoreEligible: false,
    latestDirection: null,
    scenario: demoScenario(ordinal),
  };
}
function closeItem(state: DemoState, reason: string, now: number) {
  const item = state.session.currentItem!;
  const summary = state.session.items[item.ordinal - 1];
  summary.status = "CLOSED";
  summary.answerStatus = summary.responseCount ? "ANSWERED" : "UNANSWERED";
  summary.closeReason = reason;
  state.session.answeredQuestionCount = state.session.items.filter(
    (i) => i.answerStatus === "ANSWERED",
  ).length;
  if (item.ordinal < 3) activate(state, item.ordinal + 1, now);
  else {
    state.session.currentItem = null;
    state.session.status = "ENDED";
    state.session.endedAt = new Date(now).toISOString();
    state.session.endReason = reason;
  }
}
export function advanceDemo(state: DemoState, now: number) {
  while (
    state.session.currentItem &&
    now >= Date.parse(state.session.currentItem.deadlineAt)
  )
    closeItem(
      state,
      "TIMEOUT",
      Date.parse(state.session.currentItem.deadlineAt),
    );
  const item = state.session.currentItem;
  if (item) {
    item.remainingMs = Math.max(0, Date.parse(item.deadlineAt) - now);
    item.currentMarketOffsetMs = Math.min(
      10800000,
      Math.max(0, now - Date.parse(item.startedAt)) * 60,
    );
  }
  state.session.serverNow = new Date(now).toISOString();
  return state.session;
}
export function createDemoGateway(storage: Storage, clock = Date.now): Gateway {
  type Database = {
    sessions: Record<string, DemoState>;
    creations: Record<string, string>;
  };
  const read = (): Database => {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return { sessions: {}, creations: {} };
    try {
      const db = JSON.parse(raw);
      if (!db.sessions || !db.creations) throw new Error();
      return db;
    } catch {
      throw new Error(
        "체험 기록을 읽을 수 없습니다. 리셋 후 다시 시작해 주세요.",
      );
    }
  };
  const save = (db: Database) =>
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  function operate<T>(id: string, run: (state: DemoState) => T): T {
    const db = read(),
      state = db.sessions[id];
    if (!state) throw new ApiError(404, "NOT_FOUND");
    advanceDemo(state, clock());
    try {
      return copy(run(state));
    } finally {
      save(db);
    }
  }
  const active = (state: DemoState, itemId: string): CurrentItem => {
    if (state.session.currentItem?.assessmentItemId !== itemId)
      throw new ApiError(409, "CURRENT_ITEM_CHANGED");
    return state.session.currentItem;
  };
  function once<T>(
    state: DemoState,
    key: string,
    body: unknown,
    fn: () => T,
  ): T {
    const json = JSON.stringify(body),
      existing = state.receipts[key];
    if (existing) {
      if (existing.body !== json)
        throw new ApiError(409, "IDEMPOTENCY_CONFLICT");
      return existing.value as T;
    }
    const value = copy(fn());
    state.receipts[key] = { body: json, value };
    return value;
  }
  return {
    async guest() {
      return {
        participantId: `demo-${crypto.randomUUID()}`,
        accessToken: "demo",
      };
    },
    async questionnaire() {
      return copy({
        questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
        questions: ONBOARDING_QUESTIONS,
      });
    },
    async survey(_result, _questions, key) {
      return `demo-survey-${key}`;
    },
    async create(surveyId, key) {
      const db = read();
      if (db.creations[key]) return db.creations[key];
      const id = `demo-${crypto.randomUUID()}`;
      db.creations[key] = id;
      db.sessions[id] = newDemoState(id, clock());
      save(db);
      return id;
    },
    async get(id) {
      return operate(id, (s) => s.session);
    },
    async start(id) {
      return operate(id, (s) => {
        if (s.session.status === "CREATED") {
          s.session.status = "ACTIVE";
          s.session.startedAt = new Date(clock()).toISOString();
          activate(s, 1, clock());
        }
        return s.session;
      });
    },
    async respond(id, itemId, input) {
      return operate(id, (s) =>
        once(s, input.clientEventId, input, () => {
          const item = active(s, itemId),
            body = validateJudgment(input);
          const candle = visibleMarket(
            item.scenario,
            item.currentMarketOffsetMs,
          ).candles.at(-1)!;
          item.responseCount++;
          item.scoreEligible = true;
          item.latestDirection = body.direction;
          Object.assign(s.session.items[item.ordinal - 1], {
            responseCount: item.responseCount,
            scoreEligible: true,
          });
          return {
            ...body,
            eventId: `event-${crypto.randomUUID()}`,
            sequence: s.nextSequence++,
            assessmentItemId: itemId,
            recordedAt: s.session.serverNow,
            marketOffsetMs: item.currentMarketOffsetMs,
            assetId: item.scenario.asset.assetId,
            priceAtResponse: candle.close,
          };
        }),
      );
    },
    async view(id, itemId, body) {
      return operate(id, (s) =>
        once(s, body.clientEventId, body, () => {
          const item = active(s, itemId);
          const content = visibleMarket(
            item.scenario,
            item.currentMarketOffsetMs,
          ).news.find((n) => n.contentId === body.contentId);
          if (!content) throw new ApiError(409, "CONTENT_NOT_AVAILABLE");
          return {
            content,
            event: {
              ...body,
              eventId: `event-${crypto.randomUUID()}`,
              sequence: s.nextSequence++,
              assessmentItemId: itemId,
              recordedAt: s.session.serverNow,
              marketOffsetMs: item.currentMarketOffsetMs,
              contentType: "NEWS" as const,
            },
          };
        }),
      );
    },
    async complete(id, itemId, key) {
      return operate(id, (s) =>
        once(s, key, itemId, () => {
          const item = active(s, itemId);
          if (!item.responseCount) throw new ApiError(409, "RESPONSE_REQUIRED");
          closeItem(s, "USER_COMPLETED", clock());
          return s.session;
        }),
      );
    },
    async finish(id, itemId, key) {
      return operate(id, (s) =>
        once(s, key, itemId, () => {
          active(s, itemId);
          for (const item of s.session.items)
            if (item.status !== "CLOSED") {
              item.status = "CLOSED";
              item.answerStatus = item.responseCount
                ? "ANSWERED"
                : "UNANSWERED";
              item.closeReason = "USER_FINISHED";
            }
          s.session.currentItem = null;
          s.session.status = "ENDED";
          s.session.endReason = "USER_FINISHED";
          s.session.endedAt = new Date(clock()).toISOString();
          s.session.answeredQuestionCount = s.session.items.filter(
            (i) => i.answerStatus === "ANSWERED",
          ).length;
          return s.session;
        }),
      );
    },
  };
}
