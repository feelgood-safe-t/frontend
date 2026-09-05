import { ApiError, createApiGateway } from "./api";
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

interface State {
  runtime: Runtime;
  busy: boolean;
  error: string;
  storageError: string;
  receivedAt: number;
  restored: boolean;
}
export class AssessmentController {
  private listeners = new Set<() => void>();
  private gateway: Gateway;
  private state: State;
  private syncing: Promise<void> | null = null;
  private revision = 0;
  readonly runtimeKey: string;
  readonly mode: "api" | "demo";
  constructor(
    private base: string,
    private temporary: Storage,
    private persistent: Storage,
    private allowRaw = false,
    fetcher?: typeof fetch,
  ) {
    this.mode = base ? "api" : "demo";
    this.runtimeKey = `safe-t:runtime:v2:${base || "demo"}`;
    let runtime = emptyRuntime(),
      error = "";
    try {
      runtime = readRuntime(temporary, this.runtimeKey);
    } catch (e) {
      error = e instanceof Error ? e.message : "진행 정보를 읽을 수 없습니다.";
    }
    this.state = {
      runtime,
      busy: false,
      error,
      storageError: "",
      receivedAt: Date.now(),
      restored: !runtime.sessionId,
    };
    this.gateway = base
      ? createApiGateway(base, () => this.state.runtime.participant, fetcher)
      : createDemoGateway(persistent);
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
    let storageError = this.state.storageError;
    try {
      this.temporary.setItem(this.runtimeKey, JSON.stringify(runtime));
      storageError = "";
    } catch {
      storageError =
        "진행 정보를 저장하지 못했습니다. 저장 권한을 확인해 주세요.";
    }
    this.patch({ runtime, storageError });
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
    this.patch({ receivedAt: Date.now(), restored: true });
    this.archive();
  }
  private archive() {
    const r = this.state.runtime;
    if (!r.session || !isSessionEnded(r.session.status)) return;
    const record: RecordSnapshot = {
      id: r.session.assessmentSessionId,
      mode: this.mode,
      session: r.session,
      survey: r.survey ?? null,
      events: r.events,
      itemInfo: r.itemInfo,
    };
    try {
      saveRecord(this.persistent, record);
    } catch {
      this.patch({
        storageError:
          "평가 기록을 저장하지 못했습니다. 현재 화면을 유지하고 다시 시도해 주세요.",
      });
    }
  }
  private async run(fn: () => Promise<void>) {
    if (this.state.busy) return false;
    this.revision++;
    this.patch({ busy: true, error: "" });
    try {
      await fn();
      return true;
    } catch (e) {
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
  begin = () =>
    this.run(async () => {
      if (!this.state.runtime.participant)
        this.persist({ participant: await this.gateway.guest() });
      this.persist({ questionnaire: await this.gateway.questionnaire() });
    });
  saveDraft = (draft: Record<string, string[]>) => this.persist({ draft });
  submit = (survey: OnboardingSurveyResult) =>
    this.run(async () => {
      const old = this.state.runtime;
      if (!old.questionnaire) throw new Error("먼저 설문을 시작해 주세요.");
      if (
        !old.survey ||
        JSON.stringify(old.survey.answers) !== JSON.stringify(survey.answers)
      ) {
        this.persist({
          survey,
          surveyId: undefined,
          sessionId: undefined,
          session: undefined,
          surveyKey: crypto.randomUUID(),
          createKey: crypto.randomUUID(),
          events: [],
          itemInfo: {},
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
      this.accept(await this.gateway.get(this.state.runtime.sessionId!));
    });
  start = () =>
    this.run(async () => {
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
          this.patch({ error: "" });
        }
      } catch (e) {
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
    this.run(async () => {
      if (this.state.runtime.pending)
        throw new Error("이전 요청의 처리 결과를 먼저 확인해 주세요.");
      this.persist({ pending: command });
      await this.send(command);
    });
  respond = (itemId: string, body: JudgmentInput) =>
    this.command({ kind: "respond", itemId, body: validateJudgment(body) });
  view = (
    itemId: string,
    contentId: string,
    clientEventId = crypto.randomUUID(),
  ) =>
    this.command({
      kind: "view",
      itemId,
      body: { contentId, clientEventId },
    });
  complete = (itemId: string) =>
    this.command({ kind: "complete", itemId, key: crypto.randomUUID() });
  finish = (itemId: string) =>
    this.command({ kind: "finish", itemId, key: crypto.randomUUID() });
  retry = () =>
    this.run(async () => {
      const p = this.state.runtime.pending;
      if (p) await this.send(p);
      else if (this.state.runtime.sessionId)
        this.accept(await this.gateway.get(this.state.runtime.sessionId));
    });
  newAssessment = () => {
    if (this.state.busy) return false;
    if (this.state.runtime.pending) {
      this.patch({ error: "이전 요청의 처리 결과를 먼저 확인해 주세요." });
      return false;
    }
    this.revision++;
    const participant = this.state.runtime.participant;
    this.patch({
      runtime: { ...emptyRuntime(), participant },
      error: "",
      restored: true,
    });
    this.persist({});
    return true;
  };
  reset = () => {
    if (this.state.busy) return;
    this.revision++;
    try {
      this.temporary.removeItem(this.runtimeKey);
      for (const key of [HISTORY_KEY, ...LEGACY_KEYS, DEMO_STORAGE_KEY])
        this.persistent.removeItem(key);
      this.patch({
        runtime: emptyRuntime(),
        busy: false,
        error: "",
        storageError: "",
        restored: true,
        receivedAt: Date.now(),
      });
    } catch {
      this.patch({
        error: "기록을 지우지 못했습니다. 저장 권한을 확인해 주세요.",
      });
    }
  };
}
