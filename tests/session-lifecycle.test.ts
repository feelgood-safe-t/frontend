import assert from "node:assert/strict";
import { test } from "node:test";
import { HISTORY_KEY, readHistory } from "../src/assessment/storage";
import type { EvaluationInput } from "../src/assessment/pocTypes";
import {
  deferred,
  fixtureEvaluation,
  harness,
  input,
  startedAt,
  survey,
} from "./poc-fixtures";

async function active() {
  const h = harness(),
    controller = h.controller();
  assert.equal(await controller.begin(), true);
  assert.equal(await controller.submit(survey), true);
  assert.equal(await controller.start(), true);
  const itemId = () =>
    controller.getSnapshot().runtime.session!.currentItem!.assessmentItemId;
  return { ...h, controller, itemId };
}
function submissions(h: Pick<ReturnType<typeof harness>, "requests">) {
  return h.requests
    .filter((request) => request.path === "/v1/poc/evaluation")
    .map((request) => request.body as EvaluationInput);
}

test("failed final-result storage retains the in-memory score and retries storage without another model call", async () => {
  const h = await active(),
    c = h.controller;
  const originalSet = h.persistent.setItem.bind(h.persistent);
  let blocked = true;
  h.persistent.setItem = (key, value) => {
    if (blocked && key === HISTORY_KEY && JSON.parse(value)[0]?.evaluation)
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    originalSet(key, value);
  };
  await c.respond(h.itemId(), input("UP", "storage-judgment"));
  assert.equal(await c.finish(h.itemId()), true);
  const evaluation = c.getSnapshot().runtime.evaluation;
  assert.ok(evaluation);
  assert.match(c.getSnapshot().storageError, /평가 기록을 저장하지/);
  assert.equal(readHistory(h.persistent)[0].evaluation, undefined);
  assert.equal(c.newAssessment(), false);
  assert.equal(h.temporary.length, 0);
  blocked = false;
  assert.equal(await c.retry(), true);
  assert.equal(c.getSnapshot().storageError, "");
  assert.deepEqual(readHistory(h.persistent)[0].evaluation, evaluation);
  assert.equal(submissions(h).length, 1);
  assert.equal(c.newAssessment(), true);
});

test("three items retain repeated judgments and news in one global sequence and submit evidence once", async () => {
  const h = await active(),
    c = h.controller;
  assert.equal(await c.respond(h.itemId(), input("UP", "up-1")), true);
  h.advance(1000);
  assert.equal(await c.respond(h.itemId(), input("UP", "up-2")), true);
  h.advance(1000);
  const news = c.getSnapshot().runtime.session!.currentItem!.scenario.news[0];
  assert.equal(
    await c.view(
      h.itemId(),
      news.contentId,
      "00000000-0000-0000-0000-000000000003",
    ),
    true,
  );
  h.advance(1000);
  assert.equal(await c.respond(h.itemId(), input("DOWN", "down-1")), true);
  assert.equal(await c.complete(h.itemId()), true);
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.ordinal, 2);
  assert.equal(await c.respond(h.itemId(), input("UP", "up-item-2")), true);
  assert.equal(await c.complete(h.itemId()), true);
  assert.equal(await c.respond(h.itemId(), input("DOWN", "down-item-3")), true);
  assert.equal(await c.complete(h.itemId()), true);
  const state = c.getSnapshot();
  assert.equal(state.runtime.session!.status, "ENDED");
  assert.deepEqual(
    state.runtime.events.map((entry) => entry.event.sequence),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(state.runtime.evaluation!.totalScore, 76);
  assert.equal(state.runtime.evaluation!.passed, true);
  const [bundle] = submissions(h);
  assert.equal(submissions(h).length, 1);
  assert.deepEqual(
    bundle.items.flatMap((item) => item.events.map((event) => event.sequence)),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    bundle.items[0].events.map((event) => event.elapsedMs),
    [0, 1000, 2000, 3000],
  );
  assert.deepEqual(
    bundle.items[0].events.map((event) => event.type),
    ["JUDGMENT", "JUDGMENT", "CONTENT_VIEW", "JUDGMENT"],
  );
  assert.deepEqual(
    bundle.items.map((item) => item.completionReason),
    ["USER_COMPLETED", "USER_COMPLETED", "USER_COMPLETED"],
  );
  assert.equal(readHistory(h.persistent)[0].evaluation!.totalScore, 76);
  await c.sync();
  assert.equal(await c.retry(), true);
  assert.equal(submissions(h).length, 1);
});

test("same client event retry deduplicates locally while a new repeated judgment remains separate", async () => {
  const h = await active(),
    c = h.controller;
  const judgment = input("UP", "same-id");
  assert.equal(await c.respond(h.itemId(), judgment), true);
  assert.equal(await c.respond(h.itemId(), judgment), true);
  assert.equal(c.getSnapshot().runtime.events.length, 1);
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.responseCount, 1);
  assert.equal(await c.respond(h.itemId(), input("UP", "new-id")), true);
  assert.equal(c.getSnapshot().runtime.events.length, 2);
  assert.equal(await c.finish(h.itemId()), true);
  assert.equal(submissions(h)[0].items[0].events.length, 2);
});

test("future news cannot be marked viewed before its reveal time and becomes available at the boundary", async () => {
  const h = await active(),
    c = h.controller;
  const news = c.getSnapshot().runtime.session!.currentItem!.scenario.news[1];
  assert.equal(await c.view(h.itemId(), news.contentId), false);
  assert.equal(c.getSnapshot().runtime.events.length, 0);
  assert.equal(c.getSnapshot().runtime.pending, undefined);
  h.advance(news.availableAtOffsetMs / 60);
  assert.equal(await c.view(h.itemId(), news.contentId), true);
  assert.equal(c.getSnapshot().runtime.events[0].event.sequence, 1);
});

test("manual completion requires a judgment and does not advance an unanswered item", async () => {
  const h = await active(),
    c = h.controller;
  assert.equal(await c.complete(h.itemId()), false);
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.ordinal, 1);
  assert.equal(c.getSnapshot().runtime.pending, undefined);
  assert.equal(submissions(h).length, 0);
});

for (const operation of ["respond", "complete", "finish"] as const) {
  test(`${operation} at deadline cannot mutate the expired item or accidentally complete the next item`, async () => {
    const h = await active(),
      c = h.controller;
    const first = h.itemId();
    assert.equal(await c.respond(first, input()), true);
    h.advance(180000);
    const success =
      operation === "respond"
        ? await c.respond(first, input())
        : await c[operation](first);
    assert.equal(success, false);
    const state = c.getSnapshot();
    assert.equal(state.runtime.session!.currentItem!.ordinal, 2);
    assert.equal(state.runtime.session!.currentItem!.responseCount, 0);
    assert.equal(state.runtime.session!.items[0].closeReason, "TIMEOUT");
    assert.equal(state.runtime.events.length, 1);
    assert.equal(state.runtime.pending, undefined);
    assert.equal(submissions(h).length, 0);
  });
}

for (const boundary of ["final-item", "all-background-deadlines"] as const) {
  for (const operation of ["respond", "complete", "finish", "view"] as const) {
    test(`${operation} after ${boundary} is rejected but automatically evaluates the completed bundle once`, async () => {
      const h = await active(),
        c = h.controller;
      if (boundary === "final-item") {
        for (let ordinal = 1; ordinal <= 2; ordinal++) {
          assert.equal(await c.respond(h.itemId(), input()), true);
          assert.equal(await c.complete(h.itemId()), true);
        }
      }
      const expiredId = h.itemId();
      const newsId =
        c.getSnapshot().runtime.session!.currentItem!.scenario.news[0]
          .contentId;
      const beforeEvents = structuredClone(c.getSnapshot().runtime.events);
      h.advance(boundary === "final-item" ? 180000 : 540000);
      const success =
        operation === "respond"
          ? await c.respond(expiredId, input())
          : operation === "view"
            ? await c.view(expiredId, newsId)
            : await c[operation](expiredId);
      assert.equal(success, false);
      const state = c.getSnapshot();
      assert.equal(state.runtime.session!.status, "ENDED");
      assert.equal(state.runtime.session!.currentItem, null);
      assert.equal(state.runtime.session!.items[2].closeReason, "TIMEOUT");
      assert.equal(state.runtime.pending, undefined);
      assert.deepEqual(state.runtime.events, beforeEvents);
      assert.equal(state.busy, false);
      assert.equal(state.evaluating, false);
      assert.ok(state.runtime.evaluation);
      assert.equal(submissions(h).length, 1);
      const bundle = submissions(h)[0];
      assert.equal(bundle.items[2].finalElapsedMs, 180000);
      assert.equal(bundle.items[2].events.length, 0);
      assert.equal(
        bundle.items.flatMap((item) => item.events).length,
        beforeEvents.length,
      );
      await c.sync();
      assert.equal(await c.retry(), true);
      assert.equal(submissions(h).length, 1);
    });
  }
}

test("background suspension crossing all deadlines closes each item at its own 180-second boundary", async () => {
  const h = await active(),
    c = h.controller;
  h.advance(600000);
  await c.sync();
  const state = c.getSnapshot();
  assert.equal(state.runtime.session!.status, "ENDED");
  assert.equal(
    state.runtime.session!.endedAt,
    new Date(startedAt + 540000).toISOString(),
  );
  assert.equal(state.runtime.evaluation!.totalScore, 0);
  const [bundle] = submissions(h);
  assert.equal(submissions(h).length, 1);
  assert.deepEqual(
    bundle.items.map((item) => [
      item.completionReason,
      item.finalElapsedMs,
      item.events.length,
    ]),
    [
      ["TIMEOUT", 180000, 0],
      ["TIMEOUT", 180000, 0],
      ["TIMEOUT", 180000, 0],
    ],
  );
});

test("early finish includes zero-elapsed unopened items without inventing decisions", async () => {
  const h = await active(),
    c = h.controller;
  h.advance(1234);
  assert.equal(await c.respond(h.itemId(), input()), true);
  assert.equal(await c.finish(h.itemId()), true);
  const [bundle] = submissions(h);
  assert.deepEqual(
    bundle.items.map((item) => [
      item.completionReason,
      item.finalElapsedMs,
      item.events.length,
    ]),
    [
      ["ASSESSMENT_FINISHED", 1234, 1],
      ["ASSESSMENT_FINISHED", 0, 0],
      ["ASSESSMENT_FINISHED", 0, 0],
    ],
  );
  assert.equal(c.getSnapshot().runtime.evaluation!.answeredItemCount, 1);
  assert.equal(c.getSnapshot().runtime.evaluation!.totalScore, 25.33);
});

test("502 evaluation retry resends frozen evidence and preserves the timeline and saved record", async () => {
  const h = await active(),
    c = h.controller;
  let attempts = 0;
  h.handlers.set("POST /v1/poc/evaluation", (request) => {
    attempts++;
    return attempts === 1
      ? new Response(JSON.stringify({ error: { code: "EVALUATION_FAILED" } }), {
          status: 502,
        })
      : fixtureEvaluation(request.body as EvaluationInput);
  });
  assert.equal(await c.respond(h.itemId(), input()), true);
  const events = structuredClone(c.getSnapshot().runtime.events);
  assert.equal(await c.finish(h.itemId()), false);
  assert.equal(c.getSnapshot().runtime.session!.status, "ENDED");
  assert.equal(c.getSnapshot().runtime.evaluation, undefined);
  assert.equal(c.getSnapshot().evaluating, false);
  assert.match(c.getSnapshot().error, /평가 분석에 실패/);
  assert.deepEqual(c.getSnapshot().runtime.events, events);
  assert.deepEqual(readHistory(h.persistent)[0].events, events);
  assert.equal(c.newAssessment(), false);
  h.advance(600000);
  assert.equal(await c.retry(), true);
  assert.deepEqual(submissions(h)[0], submissions(h)[1]);
  assert.deepEqual(c.getSnapshot().runtime.events, events);
  assert.equal(c.getSnapshot().runtime.evaluation!.answeredItemCount, 1);
  assert.equal(readHistory(h.persistent).length, 1);
  assert.ok(readHistory(h.persistent)[0].evaluation);
});

test("double finish and competing clicks while evaluation is pending send only one evaluation", async () => {
  const h = await active(),
    c = h.controller;
  const response = deferred<unknown>(),
    entered = deferred<void>();
  h.handlers.set("POST /v1/poc/evaluation", () => {
    entered.resolve();
    return response.promise;
  });
  const firstId = h.itemId();
  assert.equal(await c.respond(firstId, input()), true);
  const finishing = c.finish(firstId);
  await entered.promise;
  assert.equal(c.getSnapshot().busy, true);
  assert.equal(c.getSnapshot().evaluating, true);
  assert.equal(await c.finish(firstId), false);
  assert.equal(await c.retry(), false);
  assert.equal(await c.respond(firstId, input()), false);
  assert.equal(c.newAssessment(), false);
  assert.equal(submissions(h).length, 1);
  response.resolve(fixtureEvaluation(submissions(h)[0]));
  assert.equal(await finishing, true);
  assert.equal(c.getSnapshot().busy, false);
  assert.equal(c.getSnapshot().evaluating, false);
  assert.equal(submissions(h).length, 1);
});

test("clock rollback never reverses event elapsed time or global sequence", async () => {
  const h = await active(),
    c = h.controller;
  h.advance(10000);
  assert.equal(await c.respond(h.itemId(), input()), true);
  h.setTime(startedAt + 2000);
  assert.equal(await c.respond(h.itemId(), input()), true);
  assert.equal(await c.finish(h.itemId()), true);
  const events = submissions(h)[0].items[0].events;
  assert.deepEqual(
    events.map((event) => [event.sequence, event.elapsedMs]),
    [
      [1, 10000],
      [2, 10000],
    ],
  );
});
