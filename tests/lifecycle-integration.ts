// Uses an OS-assigned loopback port and injected model responses. Never calls
// the user's development server, OpenAI, old session APIs or a database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { readHistory } from "../src/assessment/storage";
import {
  MemoryStorage,
  PocHarness,
  runApiSmoke,
  verifyDisposableBackend,
} from "./api-smoke";

const backend = fileURLToPath(new URL("../../backend/", import.meta.url));
const entry = fileURLToPath(new URL("./poc_server.py", import.meta.url));
const runId = randomUUID();
const python = process.env.SAFE_T_TEST_PYTHON ?? `${backend}.venv/bin/python`;
const server = spawn(python, ["-B", entry], {
  cwd: backend,
  env: {
    ...process.env,
    PYTHONPATH: `${backend}src`,
    SAFE_T_TEST_RUN_ID: runId,
    PYTHONDONTWRITEBYTECODE: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let startupError = "";
server.stderr.setEncoding("utf8").on("data", (value: string) => {
  startupError = (startupError + value).slice(-4000);
});
server.on("error", (error) => {
  startupError = error.message;
});
const lines = createInterface({ input: server.stdout });
let announcedBase: string | undefined;
lines.on("line", (line) => {
  try {
    const data = JSON.parse(line);
    if (data.runId === runId && typeof data.base === "string")
      announcedBase = data.base;
  } catch {
    /* Uvicorn diagnostics are not server identity announcements. */
  }
});
const history = new MemoryStorage();

async function earlyFinish(base: string) {
  const h = new PocHarness(base, history);
  await h.onboard();
  await h.advance(1000);
  h.checked(await h.c.respond(h.item.assessmentItemId, h.judgment("DOWN")));
  h.checked(await h.c.finish(h.item.assessmentItemId));
  assert.equal(h.runtime.evaluation?.totalScore, 33.33);
  assert.equal(h.runtime.evaluation?.passed, false);
  assert.equal(h.runtime.evaluation?.passArtifact, null);
  assert.deepEqual(
    h.runtime.evaluation?.itemScores.map((i) => i.itemScore),
    [100, 0, 0],
  );
  assert.deepEqual(
    h.finalBundle.items.map((i) => [
      i.completionReason,
      i.finalElapsedMs,
      i.events.length,
    ]),
    [
      ["ASSESSMENT_FINISHED", 1000, 1],
      ["ASSESSMENT_FINISHED", 0, 0],
      ["ASSESSMENT_FINISHED", 0, 0],
    ],
  );
  h.assertArchived(1);
  console.log(
    "PASS 조기 종료: 판단 보존·미개봉 문항 빈 배열, 실제 미응답 0점/평균/FAIL 규칙",
  );
}

async function deadlines(base: string) {
  const h = new PocHarness(base, history);
  await h.onboard();
  const first = h.item.assessmentItemId;
  assert.equal(
    await h.c.complete(first),
    false,
    "A judgment is required to complete early",
  );
  assert.equal(h.runtime.pending, undefined);
  await h.advance(179999);
  assert.equal(h.item.ordinal, 1);
  assert.equal(h.item.remainingMs, 1);
  await h.advance(1);
  assert.equal(h.item.ordinal, 2);
  assert.equal(h.session.items[0].closeReason, "TIMEOUT");
  assert.equal(
    await h.c.finish(first),
    false,
    "Stale finish must not close the new item",
  );
  assert.equal(
    await h.c.respond(first, h.judgment()),
    false,
    "Expired judgment must be rejected",
  );
  h.checked(await h.c.respond(h.item.assessmentItemId, h.judgment()));
  await h.advance(180000);
  assert.equal(h.item.ordinal, 3);
  await h.advance(180000);
  assert.equal(h.session.status, "ENDED");
  assert.deepEqual(
    h.finalBundle.items.map((i) => [i.completionReason, i.finalElapsedMs]),
    [
      ["TIMEOUT", 180000],
      ["TIMEOUT", 180000],
      ["TIMEOUT", 180000],
    ],
  );
  assert.deepEqual(
    h.runtime.evaluation?.itemScores.map((i) => i.itemScore),
    [0, 100, 0],
  );
  h.assertArchived(1);

  const absent = new PocHarness(base, history);
  await absent.onboard();
  await absent.advance(540000);
  assert.equal(absent.session.status, "ENDED");
  assert.equal(absent.runtime.evaluation?.totalScore, 0);
  assert.ok(
    absent.finalBundle.items.every(
      (i) =>
        i.completionReason === "TIMEOUT" &&
        i.finalElapsedMs === 180000 &&
        i.events.length === 0,
    ),
  );
  absent.assertArchived(0);
  console.log(
    "PASS 시간 경계: 179.999초/180초, 응답·미응답 timeout, 9분 이탈 시 연속 종료와 실제 최종 bundle 검증",
  );
}

async function failedEvaluationRetry(base: string) {
  const h = new PocHarness(base, history);
  await h.onboard();
  h.checked(await h.c.respond(h.item.assessmentItemId, h.judgment()));
  h.loseNextEvaluation = true;
  assert.equal(await h.c.finish(h.item.assessmentItemId), false);
  assert.equal(h.session.status, "ENDED");
  assert.equal(h.runtime.evaluation, undefined);
  assert.equal(h.runtime.events.length, 1);
  const frozenBody = h.evaluationRequests[0].body;
  await h.c.sync();
  await h.c.sync();
  assert.equal(
    h.evaluationRequests.length,
    1,
    "Polling must not silently repeat paid model calls after failure",
  );
  assert.ok(h.c.getSnapshot().error);
  h.checked(await h.c.retry());
  assert.equal(h.evaluationRequests.length, 2);
  assert.equal(
    h.evaluationRequests[1].body,
    frozenBody,
    "Explicit retry must submit identical completed evidence",
  );
  assert.equal(h.runtime.evaluation?.totalScore, 33.33);
  h.assertArchived(1);
  console.log(
    "PASS 평가 응답 유실: 근거 유지·자동 재호출 차단·명시적 동일 bundle 재시도·기록 중복 없음",
  );
}

async function failedSelectionAndUnsafeData(base: string) {
  const h = new PocHarness(base);
  h.checked(await h.c.begin());
  const q = h.runtime.questionnaire!;
  const survey = {
    questionnaireVersionId: q.questionnaireVersionId,
    completedAt: new Date(h.nowMs).toISOString(),
    answers: q.questions.map((question) => ({
      questionId: question.id,
      optionIds: [question.options[0].id],
    })),
  };
  h.failNextSelection = true;
  assert.equal(await h.c.submit(survey), false);
  assert.equal(h.runtime.session, undefined);
  assert.equal(h.c.mode, "api");
  assert.ok(h.c.getSnapshot().error);
  h.checked(await h.c.submit(survey));
  assert.equal(h.session.status, "CREATED");
  assert.deepEqual(
    h.calls.map((c) => c.path),
    [
      "/v1/poc/questionnaire",
      "/v1/poc/onboarding-assessment",
      "/v1/poc/onboarding-assessment",
    ],
  );

  const publicMode = new PocHarness(base, new MemoryStorage(), false);
  publicMode.checked(await publicMode.c.begin());
  assert.equal(
    await publicMode.c.submit(survey),
    false,
    "Unreviewed source data must be rejected without development opt-in",
  );
  assert.equal(publicMode.runtime.session, undefined);
  assert.equal(publicMode.evaluationRequests.length, 0);
  console.log(
    "PASS 선택 실패·공개 방어: 데모/고정 시나리오 fallback 없음, 검수 전 자료 허용은 개발용 명시 설정만",
  );
}

try {
  let base: string | undefined;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (!server.pid || server.exitCode !== null || server.signalCode !== null)
      throw new Error(
        `격리 백엔드 실행 실패: ${startupError}\n최신 backend 의존성이 있는 Python을 SAFE_T_TEST_PYTHON으로 지정하세요.`,
      );
    if (announcedBase) {
      try {
        await verifyDisposableBackend(announcedBase, runId);
        base = announcedBase;
        break;
      } catch {
        /* Startup may announce before Uvicorn is ready. */
      }
    }
    await delay(100);
  }
  assert.ok(base, `격리 백엔드 준비 시간 초과: ${startupError}`);
  await runApiSmoke(base, runId, history);
  await earlyFinish(base);
  await deadlines(base);
  await failedEvaluationRetry(base);
  await failedSelectionAndUnsafeData(base);
  assert.equal(
    readHistory(history).length,
    5,
    "Completed assessments accumulate without replacement",
  );
  console.log(
    "PASS stateless 백엔드 통합 전체 완료: 5개 종료 기록, OpenAI 호출·DB·기존 서버 변경 없음",
  );
} finally {
  lines.close();
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, "close");
    server.kill("SIGTERM");
    const stopped = await Promise.race([
      closed.then(() => true),
      delay(5000).then(() => false),
    ]);
    if (!stopped) {
      server.kill("SIGKILL");
      await closed;
    }
  }
}
