import { ApiError } from "./api";
import { createPocGateway } from "./pocGateway";
import {
  appendEvent,
  assertParticipantSafe,
  isSessionEnded,
  validateJudgment,
} from "./domain";
import { createDemoGateway, DEMO_STORAGE_KEY } from "./demo";
import {
  emptyRuntime,
  HISTORY_KEY,
  LEGACY_KEYS,
  readRuntime,
  saveRecord,
  type Command,
  type Runtime,
} from "./storage";
import type { Gateway, JudgmentInput, RecordSnapshot, Session } from "./types";
import type { OnboardingSurveyResult } from "../onboardingTypes";
import { createUuid } from "./uuid";

interface State {
  runtime: Runtime;
  busy: boolean;
  error: string;
  storageError: string;
  receivedAt: number;
  restored: boolean;
  evaluating: boolean;
}

function errorDetails(error: unknown) {
  const details: {
    name: string;
    message: string;
    status?: number;
    code?: string;
  } = {
    name: error instanceof Error ? error.name : typeof error,
    message:
      error instanceof Error
        ? error.message
        : "알 수 없는 값이 예외로 전달됐습니다.",
  };
  if (error && typeof error === "object") {
    if ("status" in error && typeof error.status === "number")
      details.status = error.status;
    if ("code" in error && typeof error.code === "string")
      details.code = error.code;
  }
  return details;
}

export class AssessmentController {
  private listeners = new Set<() => void>();
  private gateway: Gateway;
  private state: State;
  private syncing: Promise<void> | null = null;
  private revision = 0;
  private runtimeStorageError = "";
  private historyStorageError = "";
  private evaluationAttempted = false;
  readonly runtimeKey: string;
  readonly mode: "api" | "demo";
  constructor(
    private base: string,
    private temporary: Storage,
    private persistent: Storage,
    private allowRaw = false,
    fetcher?: typeof fetch,
    private clock: () => number = Date.now,
  ) {
    this.mode = base ? "api" : "demo";
    this.runtimeKey = base
      ? `safe-t:runtime:v3:${base}`
      : "safe-t:runtime:v2:demo";
    let runtime = emptyRuntime(),
      error = "";
    try {
      // API 0.7 has no server session to restore. Never replay legacy persisted commands.
      if (!base) runtime = readRuntime(temporary, this.runtimeKey);
    } catch (e) {
      error = e instanceof Error ? e.message : "진행 정보를 읽을 수 없습니다.";
    }
    this.state = {
      runtime,
      busy: false,
      error,
      storageError: "",
      receivedAt: this.clock(),
      restored: !runtime.sessionId,
      evaluating: false,
    };
    this.gateway = base
      ? createPocGateway(base, fetcher, allowRaw, this.clock)
      : createDemoGateway(persistent, this.clock);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private patch(update: Partial<State>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((fn) => fn());
  }
  private persist(update: Partial<Runtime>) {
    const runtime = { ...this.state.runtime, ...update };
    try {
      if (this.mode === "demo")
        this.temporary.setItem(this.runtimeKey, JSON.stringify(runtime));
      this.runtimeStorageError = "";
    } catch {
      this.runtimeStorageError =
        "진행 정보를 저장하지 못했습니다. 저장 권한을 확인해 주세요.";
    }
    this.patch({ runtime, storageError: this.storageError() });
  }
  private storageError() {
    return [this.runtimeStorageError, this.historyStorageError]
      .filter(Boolean)
      .join(" ");
  }
  private accept(session: Session) {
    if (
      !session ||
      !["CREATED", "ACTIVE", "ENDED", "SNAPSHOT_READY"].includes(
        session.status,
      ) ||
      session.assessmentSessionId !== this.state.runtime.sessionId ||
      !Array.isArray(session.items) ||
      session.items.length !== 3 ||
      (session.status === "ACTIVE" &&
        (!session.currentItem ||
          !Number.isFinite(Date.parse(session.currentItem.deadlineAt))))
    )
      throw new Error("평가 진행 정보를 확인할 수 없습니다.");
    const previous = this.state.runtime.session;
    if (previous?.assessmentSessionId === session.assessmentSessionId) {
      const rank = { CREATED: 0, ACTIVE: 1, ENDED: 2, SNAPSHOT_READY: 3 };
      // An idempotent retry can return the original, older acknowledgment.
      // Keep the latest known progress even if the subsequent refresh fails.
      if (
        rank[session.status] < rank[previous.status] ||
        Date.parse(session.serverNow) < Date.parse(previous.serverNow) ||
        (previous.currentItem &&
          session.currentItem &&
          (session.currentItem.ordinal < previous.currentItem.ordinal ||
            (session.currentItem.ordinal === previous.currentItem.ordinal &&
              session.currentItem.responseCount <
                previous.currentItem.responseCount)))
      ) {
        assertParticipantSafe(previous, this.allowRaw);
        this.patch({ restored: true });
        this.archive();
        return;
      }
    }
    assertParticipantSafe(session, this.allowRaw);
    const itemInfo = { ...this.state.runtime.itemInfo };
    if (session.currentItem) {
      const { asset, brief } = session.currentItem.scenario;
      itemInfo[session.currentItem.assessmentItemId] = { asset, brief };
    }
    this.persist({ session, itemInfo });
    this.patch({ receivedAt: this.clock(), restored: true });
    this.archive();
  }
  private archive(): boolean {
    const r = this.state.runtime;
    if (!r.session || !isSessionEnded(r.session.status)) return true;
    const record: RecordSnapshot = {
      id: r.session.assessmentSessionId,
      mode: this.mode,
      session: r.session,
      survey: r.survey ?? null,
      events: r.events,
      itemInfo: r.itemInfo,
      ...(r.evaluation ? { evaluation: r.evaluation } : {}),
      ...(r.profileAnalysis ? { profileAnalysis: r.profileAnalysis } : {}),
    };
    try {
      const merged = saveRecord(this.persistent, record);
      this.historyStorageError = "";
      if (merged !== record) {
        this.persist({
          session: merged.session,
          survey: merged.survey ?? undefined,
          events: merged.events,
          itemInfo: merged.itemInfo,
          evaluation: merged.evaluation,
          profileAnalysis: merged.profileAnalysis,
        });
      } else {
        this.patch({ storageError: this.storageError() });
      }
      return true;
    } catch {
      this.historyStorageError =
        "평가 기록을 저장하지 못했습니다. 현재 화면을 유지하고 다시 시도해 주세요.";
      this.patch({ storageError: this.storageError() });
      return false;
    }
  }
  private async run(action: string, fn: () => Promise<void>) {
    if (this.state.busy) return false;
    this.revision++;
    this.patch({ busy: true, error: "" });
    try {
      await fn();
      await this.evaluateCompleted();
      return true;
    } catch (e) {
      console.error(
        `[청노][${action}] 처리 실패`,
        {
          ...errorDetails(e),
          mode: this.mode,
          hasQuestionnaire: Boolean(this.state.runtime.questionnaire),
          hasSurveyId: Boolean(this.state.runtime.surveyId),
          hasSessionId: Boolean(this.state.runtime.sessionId),
          sessionStatus: this.state.runtime.session?.status ?? null,
          pendingKind: this.state.runtime.pending?.kind ?? null,
        },
        e,
      );
      this.patch({
        error:
          e instanceof Error
            ? e.message
            : "처리하지 못했습니다. 다시 시도해 주세요.",
      });
      return false;
    } finally {
      this.patch({ busy: false });
    }
  }
  private async evaluateCompleted() {
    const r = this.state.runtime;
    if (
      !this.gateway.evaluate ||
      !r.session ||
      !isSessionEnded(r.session.status) ||
      r.evaluation ||
      this.evaluationAttempted
    )
      return;
    this.evaluationAttempted = true;
    this.patch({ evaluating: true });
    try {
      const evaluation = await this.gateway.evaluate(r.sessionId!);
      this.persist({ evaluation });
      this.archive();
    } finally {
      this.patch({ evaluating: false });
    }
  }
  begin = () =>
    this.run("QUESTIONNAIRE_LOAD", async () => {
      this.persist({ questionnaire: await this.gateway.questionnaire() });
    });
  saveDraft = (draft: Record<string, string[]>) => this.persist({ draft });
  submit = (survey: OnboardingSurveyResult) =>
    this.run("SURVEY_SUBMIT", async () => {
      const old = this.state.runtime;
      if (!old.questionnaire) throw new Error("먼저 설문을 시작해 주세요.");
      if (
        !old.survey ||
        JSON.stringify(old.survey.answers) !== JSON.stringify(survey.answers)
      ) {
        this.evaluationAttempted = false;
        this.persist({
          survey,
          surveyId: undefined,
          sessionId: undefined,
          session: undefined,
          surveyKey: createUuid(),
          createKey: createUuid(),
          events: [],
          itemInfo: {},
          evaluation: undefined,
          profileAnalysis: undefined,
        });
      }
      let r = this.state.runtime;
      if (!r.surveyId)
        this.persist({
          surveyId: await this.gateway.survey(
            r.survey!,
            r.questionnaire!.questions,
            r.surveyKey!,
          ),
        });
      r = this.state.runtime;
      if (!r.sessionId)
        this.persist({
          sessionId: await this.gateway.create(r.surveyId!, r.createKey!),
        });
      const onboarding = this.gateway.onboarding?.();
      if (onboarding) {
        const id = this.state.runtime.sessionId!;
        this.persist({
          profileAnalysis: onboarding.profileAnalysis,
          itemInfo: Object.fromEntries(
            onboarding.assessment.items.map((item) => [
              `${id}-item-${item.ordinal}`,
              { asset: item.scenario.asset, brief: item.scenario.brief },
            ]),
          ),
        });
      }
      this.accept(await this.gateway.get(this.state.runtime.sessionId!));
    });
  start = () =>
    this.run("ASSESSMENT_START", async () => {
      const id = this.state.runtime.sessionId;
      if (!id) throw new Error("설문을 먼저 완료해 주세요.");
      this.accept(await this.gateway.start(id));
    });
  sync = (): Promise<void> => {
    if (this.syncing) return this.syncing;
    const id = this.state.runtime.sessionId;
    if (!id || this.state.busy) return Promise.resolve();
    const revision = this.revision;
    this.syncing = (async () => {
      try {
        const session = await this.gateway.get(id);
        if (revision === this.revision) {
          this.accept(session);
          if (!isSessionEnded(session.status) || !this.evaluationAttempted)
            this.patch({ error: "" });
          if (
            isSessionEnded(session.status) &&
            this.gateway.evaluate &&
            !this.state.runtime.evaluation &&
            !this.evaluationAttempted
          )
            await this.run("EVALUATION_REQUEST", async () => {});
        }
      } catch (e) {
        console.error("[청노][SESSION_SYNC] 처리 실패", errorDetails(e), e);
        if (revision === this.revision)
          this.patch({
            error: e instanceof Error ? e.message : "연결을 확인해 주세요.",
          });
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  };
  private send = async (command: Command) => {
    const id = this.state.runtime.sessionId!;
    try {
      if (command.kind === "respond") {
        const event = await this.gateway.respond(
          id,
          command.itemId,
          command.body,
        );
        this.persist({
          events: appendEvent(this.state.runtime.events, {
            kind: "judgment",
            event,
          }),
          pending: undefined,
        });
      } else if (command.kind === "view") {
        const { event, content } = await this.gateway.view(
          id,
          command.itemId,
          command.body,
        );
        this.persist({
          events: appendEvent(this.state.runtime.events, {
            kind: "view",
            event,
            content,
          }),
          pending: undefined,
        });
      } else {
        const session =
          command.kind === "complete"
            ? await this.gateway.complete(id, command.itemId, command.key)
            : await this.gateway.finish(id, command.itemId, command.key);
        this.persist({ pending: undefined });
        this.accept(session);
      }
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 429
      ) {
        this.persist({ pending: undefined });
        if (e.status === 409) {
          this.accept(await this.gateway.get(id));
          // A click racing the final deadline can end the whole test. There is
          // no active screen left to tick, so seal/evaluate without waiting for another sync.
          await this.evaluateCompleted();
          throw new Error(
            "문항이 종료되었거나 상태가 변경됐습니다. 현재 문항을 확인해 주세요.",
          );
        }
      }
      throw e;
    }
    // Mutations are acknowledged before refreshing. A failed refresh cannot duplicate an accepted event.
    this.archive();
    this.accept(await this.gateway.get(id));
  };
  command = (command: Command) =>
    this.run(`ASSESSMENT_${command.kind.toUpperCase()}`, async () => {
      if (this.state.runtime.pending)
        throw new Error("이전 요청의 처리 결과를 먼저 확인해 주세요.");
      this.persist({ pending: command });
      await this.send(command);
    });
  respond = (itemId: string, body: JudgmentInput) =>
    this.command({ kind: "respond", itemId, body: validateJudgment(body) });
  view = (itemId: string, contentId: string, clientEventId = createUuid()) =>
    this.command({
      kind: "view",
      itemId,
      body: { contentId, clientEventId },
    });
  complete = (itemId: string) =>
    this.command({ kind: "complete", itemId, key: createUuid() });
  finish = (itemId: string) =>
    this.command({ kind: "finish", itemId, key: createUuid() });
  retry = () =>
    this.run("ASSESSMENT_RETRY", async () => {
      this.evaluationAttempted = false;
      const p = this.state.runtime.pending;
      if (p) await this.send(p);
      else if (this.state.runtime.sessionId)
        this.accept(await this.gateway.get(this.state.runtime.sessionId));
    });
  newAssessment = () => {
    if (this.state.busy) return false;
    if (
      this.mode === "api" &&
      isSessionEnded(this.state.runtime.session?.status) &&
      !this.state.runtime.evaluation
    ) {
      this.patch({
        error:
          "판단 기록이 남아 있습니다. 평가 결과를 먼저 다시 요청해 주세요.",
      });
      return false;
    }
    if (this.state.runtime.pending) {
      this.patch({ error: "이전 요청의 처리 결과를 먼저 확인해 주세요." });
      return false;
    }
    // Keep the last recoverable copy until the completed record is durable.
    if (!this.archive()) return false;
    this.revision++;
    this.evaluationAttempted = false;
    this.patch({
      runtime: emptyRuntime(),
      error: "",
      restored: true,
    });
    this.persist({});
    return true;
  };
  reset = () => {
    if (this.state.busy) return;
    this.revision++;
    this.evaluationAttempted = false;
    try {
      this.temporary.removeItem(this.runtimeKey);
      if (this.base)
        this.temporary.removeItem(`safe-t:runtime:v2:${this.base}`);
      for (const key of [HISTORY_KEY, ...LEGACY_KEYS, DEMO_STORAGE_KEY])
        this.persistent.removeItem(key);
      this.runtimeStorageError = "";
      this.historyStorageError = "";
      this.patch({
        runtime: emptyRuntime(),
        busy: false,
        error: "",
        storageError: "",
        restored: true,
        receivedAt: this.clock(),
      });
    } catch {
      this.patch({
        error: "기록을 지우지 못했습니다. 저장 권한을 확인해 주세요.",
      });
    }
  };
}
