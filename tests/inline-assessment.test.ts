import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";
import { JudgmentPanel } from "../src/components/JudgmentPanel";
import { Rules } from "../src/components/AssessmentLayout";
import { demoScenario } from "../src/assessment/demo";
import type { AssessmentController } from "../src/assessment/controller";
import type {
  CurrentItem,
  Session,
  TimelineEvent,
} from "../src/assessment/types";

const item: CurrentItem = {
  assessmentItemId: "inline-item",
  ordinal: 1,
  status: "ACTIVE",
  startedAt: new Date().toISOString(),
  deadlineAt: new Date(Date.now() + 180000).toISOString(),
  remainingMs: 180000,
  currentMarketOffsetMs: 0,
  responseCount: 0,
  scoreEligible: false,
  latestDirection: null,
  scenario: demoScenario(1),
};
const controller = { mode: "api" } as AssessmentController;
const props = {
  item,
  controller,
  busy: false,
  pending: false,
  error: "",
  expired: false,
};

test("rules emphasize repeatable judgments and the risk-asset scope", () => {
  const html = renderToStaticMarkup(createElement(Rules));
  assert.match(
    html,
    /<strong>[\s\S]*상승·하락 판단은 각 문항의 3분 동안 횟수 제한 없이 반복해 기록할[\s\S]*<\/strong>/,
  );
  assert.match(
    html,
    /<strong>[\s\S]*자산명은 실제 자산을 식별할 수 없도록 가명화했습니다[\s\S]*모두 위험자산이며 안전자산은 포함되지[\s\S]*<\/strong>/,
  );
});

test("inline judgment has medium/price defaults and two direct actions without a dialog", () => {
  const html = renderToStaticMarkup(createElement(JudgmentPanel, props));
  assert.doesNotMatch(html, /<dialog|<form/);
  const inputs: string[] = html.match(/<input\b[^>]*>/g) ?? [];
  const checked = inputs.filter((input) => input.includes('checked=""'));
  assert.equal(checked.length, 2);
  assert.ok(checked.some((input) => input.includes('value="MEDIUM"')));
  assert.ok(checked.some((input) => input.includes('value="PRICE"')));
  assert.match(html, /▲ 상승 판단/);
  assert.match(html, /▼ 하락 판단/);
  assert.match(html, /▲ 상승 판단[\s\S]*▼ 하락 판단[\s\S]*현재까지 판단/);
});

test("busy, pending, and expired states each disable direct judgments and editing", () => {
  for (const flag of ["busy", "pending", "expired"] as const) {
    const html = renderToStaticMarkup(
      createElement(JudgmentPanel, { ...props, [flag]: true }),
    );
    assert.match(html, /<fieldset disabled=""/);
    assert.match(html, /<textarea disabled=""/);
    const actions = (
      html.match(/<button\b[^>]*>[^<]*<\/button>/g) ?? []
    ).filter((button) => /[▲▼]/.test(button));
    assert.equal(actions.length, 2);
    assert.ok(actions.every((button) => button.includes('disabled=""')));
  }
});

test("only the last recorded direction is filled; no separate success message is rendered", () => {
  for (const direction of [null, "UP", "DOWN"] as const) {
    const html = renderToStaticMarkup(
      createElement(JudgmentPanel, {
        ...props,
        item: { ...item, latestDirection: direction },
      }),
    );
    const buttons: string[] =
      html.match(/<button\b[^>]*>[^<]*<\/button>/g) ?? [];
    const up = buttons.find((button) => button.includes("▲ 상승 판단"))!;
    const down = buttons.find((button) => button.includes("▼ 하락 판단"))!;
    assert.ok(up.includes(`aria-pressed="${direction === "UP"}"`));
    assert.ok(down.includes(`aria-pressed="${direction === "DOWN"}"`));
    assert.equal(up.includes("!bg-red-700 !text-white"), direction === "UP");
    assert.equal(
      down.includes("!bg-blue-800 !text-white"),
      direction === "DOWN",
    );
    assert.equal(up.includes("!bg-white"), direction !== "UP");
    assert.equal(down.includes("!bg-white"), direction !== "DOWN");
    // Pressed buttons remain actionable: repeated judgments are separate records.
    assert.ok(!up.includes('disabled=""') && !down.includes('disabled=""'));
    assert.doesNotMatch(html, /판단을 기록했습니다/);
  }
});

test("available news bodies render immediately but future news stays hidden", () => {
  const session: Session = {
    assessmentSessionId: "inline-session",
    status: "ACTIVE",
    questionCount: 3,
    answeredQuestionCount: 0,
    startedAt: item.startedAt,
    endedAt: null,
    endReason: null,
    serverNow: item.startedAt,
    currentItem: item,
    items: [1, 2, 3].map((ordinal) => ({
      assessmentItemId:
        ordinal === 1 ? item.assessmentItemId : `item-${ordinal}`,
      ordinal,
      status: ordinal === 1 ? "ACTIVE" : "LOCKED",
      answerStatus: null,
      responseCount: 0,
      scoreEligible: false,
      closeReason: null,
    })),
  };
  const html = renderToStaticMarkup(
    createElement(App, {
      controller,
      session,
      events: [],
      receivedAt: Date.now(),
      busy: false,
      pending: false,
      error: "",
      onHome: () => {},
    }),
  );
  assert.ok(html.includes(item.scenario.news[0].body));
  assert.ok(!html.includes(item.scenario.news[1].body));
  assert.match(html, /읽음 표시/);
  assert.match(html, /가명 위험자산/);
  assert.doesNotMatch(
    html,
    /판단을 한 번 이상 기록하면 문항을 완료할 수 있습니다/,
  );
  assert.match(html, /문항 완료[\s\S]*시험 종료/);
  assert.equal((html.match(/문항 완료/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<dialog/);

  const content = item.scenario.news[0];
  const viewedEvents: TimelineEvent[] = [
    {
      kind: "view",
      content,
      event: {
        eventId: "view-event",
        clientEventId: "view-client-event",
        sequence: 1,
        assessmentItemId: item.assessmentItemId,
        recordedAt: item.startedAt,
        marketOffsetMs: content.marketOffsetMs,
        contentId: content.contentId,
        contentType: "NEWS",
      },
    },
  ];
  const viewed = renderToStaticMarkup(
    createElement(App, {
      controller,
      session,
      events: viewedEvents,
      receivedAt: Date.now(),
      busy: false,
      pending: false,
      error: "",
      onHome: () => {},
    }),
  );
  const readButton = (viewed.match(
    /<button\b(?=[^>]*aria-label="[^"]*다시 읽음 표시")[^>]*>[\s\S]*?읽음 기록됨 · 다시 읽음 표시[\s\S]*?<\/button>/,
  ) ?? [])[0];
  assert.ok(readButton);
  assert.doesNotMatch(readButton, /disabled=""/);
  assert.match(readButton, /다시 읽음 표시/);
});

test("available news renders newest first", () => {
  const currentItem = {
    ...item,
    currentMarketOffsetMs: 5_400_000,
  };
  const session: Session = {
    assessmentSessionId: "news-order-session",
    status: "ACTIVE",
    questionCount: 3,
    answeredQuestionCount: 0,
    startedAt: item.startedAt,
    endedAt: null,
    endReason: null,
    serverNow: item.startedAt,
    currentItem,
    items: [
      {
        assessmentItemId: item.assessmentItemId,
        ordinal: 1,
        status: "ACTIVE",
        answerStatus: null,
        responseCount: 0,
        scoreEligible: false,
        closeReason: null,
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(App, {
      controller,
      session,
      events: [],
      receivedAt: Date.now(),
      busy: false,
      pending: false,
      error: "",
      onHome: () => {},
    }),
  );
  const newest = html.indexOf("추가 공급 일정에 대한 논의");
  const middle = html.indexOf("시장 참여자들의 전망 엇갈려");
  const oldest = html.indexOf("주요 사업 현황 안내");
  assert.ok(newest > -1 && newest < middle && middle < oldest);
});
