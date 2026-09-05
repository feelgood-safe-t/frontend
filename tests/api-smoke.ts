// Run only against a disposable local backend: SAFE_T_TEST_API_URL=http://127.0.0.1:8001 node --import tsx tests/api-smoke.ts
import assert from "node:assert/strict";
import { AssessmentController } from "../src/assessment/controller";
import { readHistory } from "../src/assessment/storage";
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
}
const base = process.env.SAFE_T_TEST_API_URL;
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("임시 로컬 API 주소를 지정하세요.");
const temporary = new MemoryStorage(),
  persistent = new MemoryStorage();
let c = new AssessmentController(base, temporary, persistent, true);
const checked = (ok: boolean) => assert.ok(ok, c.getSnapshot().error);
checked(await c.begin());
const q = c.getSnapshot().runtime.questionnaire!;
checked(
  await c.submit({
    questionnaireVersionId: q.questionnaireVersionId,
    completedAt: new Date().toISOString(),
    answers: q.questions.map((question) => ({
      questionId: question.id,
      optionIds: question.options
        .slice(0, question.minSelections)
        .map((o) => o.id),
    })),
  }),
);
checked(await c.start());
for (let ordinal = 1; ordinal <= 3; ordinal++) {
  const item = c.getSnapshot().runtime.session!.currentItem!;
  assert.equal(item.ordinal, ordinal);
  assert.equal(item.scenario.candles.length, 240);
  for (const direction of ["UP", "UP", "DOWN"] as const)
    checked(
      await c.respond(item.assessmentItemId, {
        clientEventId: crypto.randomUUID(),
        direction,
        confidence: "MEDIUM",
        reasonTags: ["PRICE"],
        reasonText: "가격 흐름과 불확실성을 함께 고려했습니다.",
      }),
    );
  const news = item.scenario.news.find(
    (n) => n.availableAtOffsetMs <= item.currentMarketOffsetMs,
  );
  if (news) checked(await c.view(item.assessmentItemId, news.contentId));
  c = new AssessmentController(base, temporary, persistent, true);
  await c.sync();
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.responseCount, 3);
  checked(await c.complete(item.assessmentItemId));
}
assert.equal(c.getSnapshot().runtime.session!.status, "ENDED");
const records = readHistory(persistent);
assert.equal(records.length, 1);
assert.equal(records[0].events.filter((e) => e.kind === "judgment").length, 9);
assert.equal(records[0].session.answeredQuestionCount, 3);
console.log(
  "실제 API 통합 성공: 설문 10문항, 순차 3문항, 판단 9건, 새로고침 복구, 종료 기록 저장",
);
