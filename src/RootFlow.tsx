import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import App from "./App";
import { AssessmentController } from "./assessment/controller";
import {
  getStorage,
  readHistory,
  readLegacyHistory,
  type LegacyRecord,
} from "./assessment/storage";
import type { RecordSnapshot } from "./assessment/types";
import {
  CONFIDENCE_LABELS,
  isSessionEnded,
  REASON_LABELS,
} from "./assessment/domain";
import {
  AssessmentLayout,
  buttonClass,
  secondaryClass,
  Panel,
  RadialLoader,
  Rules,
} from "./components/AssessmentLayout";
import { AssessmentResults, RubricHelp } from "./components/AssessmentResults";
import { OnboardingSurvey } from "./components/OnboardingSurvey";
import { ProfileAnalysis } from "./components/ProfileAnalysis";

function StoredRecord({
  records,
  mode,
  onHome,
}: {
  records: RecordSnapshot[];
  mode: "api" | "demo";
  onHome: () => void;
}) {
  const { recordId } = useParams();
  const record = records.find((r) => r.id === recordId);
  return (
    <AssessmentLayout onHome={onHome} mode={mode}>
      {record ? (
        <AssessmentResults record={record} />
      ) : (
        <Panel title="평가 기록">
          <p className="text-sm mb-4">해당 평가 기록을 찾을 수 없습니다.</p>
          <button className={buttonClass} onClick={onHome}>
            홈으로 이동
          </button>
        </Panel>
      )}
    </AssessmentLayout>
  );
}
export default function RootFlow() {
  const navigate = useNavigate(),
    location = useLocation();
  const [controller] = useState(
    () =>
      new AssessmentController(
        import.meta.env.VITE_SAFE_T_API_BASE_URL?.trim() ?? "",
        getStorage("sessionStorage"),
        getStorage("localStorage"),
        import.meta.env.DEV,
      ),
  );
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    ),
    { runtime, busy, error, storageError } = state;
  const [records, setRecords] = useState<RecordSnapshot[]>([]),
    [legacy, setLegacy] = useState<LegacyRecord[]>([]),
    [historyError, setHistoryError] = useState("");
  const session = runtime.session;
  const examScreen =
    location.pathname !== "/exam"
      ? ""
      : !state.restored
        ? "restoring"
        : session?.status === "ACTIVE"
          ? session.currentItem?.assessmentItemId
          : isSessionEnded(session?.status)
            ? "submitted"
            : session?.status;
  useEffect(() => {
    // Items and submission share /exam, so a route change alone is not enough.
    // Keep ordinary timer updates and background sync from moving the viewport.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, examScreen]);
  const home = () => {
    if (!busy) navigate("/");
  };
  useEffect(() => {
    try {
      setRecords(readHistory(window.localStorage));
      setLegacy(readLegacyHistory(window.localStorage));
      setHistoryError("");
    } catch {
      setHistoryError("일부 평가 기록을 읽을 수 없습니다.");
    }
  }, [
    location.pathname,
    session?.endedAt,
    session?.status,
    runtime.events,
    runtime.evaluation,
  ]);
  useEffect(() => {
    const unfinished =
      session?.status === "ACTIVE" ||
      session?.status === "CREATED" ||
      (controller.mode === "api" &&
        isSessionEnded(session?.status) &&
        !runtime.evaluation);
    const unsavedResult = Boolean(
      storageError && isSessionEnded(session?.status),
    );
    if (!unfinished && !busy && !unsavedResult) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [
    session?.status,
    runtime.evaluation,
    busy,
    controller.mode,
    storageError,
  ]);
  useEffect(() => {
    void controller.sync();
  }, [controller, runtime.sessionId]);
  useEffect(() => {
    if (!runtime.sessionId) return;
    const sync = () => void controller.sync();
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const timer = window.setInterval(() => {
      if (controller.getSnapshot().runtime.session?.status === "ACTIVE") sync();
    }, 10000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", sync);
    };
  }, [controller, runtime.sessionId]);
  const begin = async () => {
    if (await controller.begin()) navigate("/survey");
  };
  const reset = () => {
    controller.reset();
    setRecords([]);
    setLegacy([]);
    navigate("/");
  };
  const active = session?.status === "ACTIVE" || session?.status === "CREATED";
  const currentRecord: RecordSnapshot | undefined =
    session && isSessionEnded(session.status)
      ? {
          id: session.assessmentSessionId,
          mode: controller.mode,
          session,
          survey: runtime.survey ?? null,
          events: runtime.events,
          itemInfo: runtime.itemInfo,
          evaluation: runtime.evaluation,
          profileAnalysis: runtime.profileAnalysis,
        }
      : undefined;
  const landing = (
    <AssessmentLayout
      onHome={home}
      mode={controller.mode}
      actions={
        <button
          disabled={busy}
          onClick={reset}
          className="border border-white px-3 py-2 text-xs"
        >
          리셋
        </button>
      }
    >
      <Panel title="투자 판단 연습">
        <h1 className="text-2xl sm:text-3xl font-black leading-snug">
          새로운 정보 앞에서,
          <br />
          나는 어떻게 판단할까?
        </h1>
        <p className="mt-3 text-sm leading-7">
          투자 성향 설문 10문항, 약 80초.
          <br />세 가지 시장 상황을 순서대로 관찰하고 상승·하락 판단과 이유를
          기록해 보세요.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {runtime.sessionId && !session ? (
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() => navigate("/exam")}
            >
              진행 상태 다시 확인
            </button>
          ) : active ? (
            <button
              disabled={busy}
              className={buttonClass + " !border"}
              onClick={() =>
                navigate(session.status === "ACTIVE" ? "/exam" : "/analysis")
              }
            >
              {session.status === "ACTIVE"
                ? "진행 중인 평가 이어하기"
                : "설문 분석 결과 이어보기"}
            </button>
          ) : (
            <button
              disabled={busy || Boolean(runtime.pending)}
              className={buttonClass}
              onClick={() => {
                if (
                  isSessionEnded(session?.status) &&
                  !controller.newAssessment()
                )
                  return;
                void begin();
              }}
            >
              {busy
                ? "설문 준비 중…"
                : records.length
                  ? "새 평가 시작"
                  : "설문 시작하기 →"}
            </button>
          )}
          {!active && runtime.questionnaire && !session && (
            <button
              className={secondaryClass}
              onClick={() => navigate("/survey")}
            >
              작성 중인 설문 이어하기
            </button>
          )}
          {controller.mode === "api" &&
            isSessionEnded(session?.status) &&
            !runtime.evaluation && (
              <button
                className={secondaryClass}
                onClick={() => navigate("/exam")}
              >
                {state.evaluating
                  ? "평가 분석 진행 보기"
                  : "평가 결과 다시 요청"}
              </button>
            )}
        </div>
      </Panel>
      {(records.length > 0 || legacy.length > 0) && (
        <section
          aria-labelledby="assessment-history-title"
          className="mx-4 pt-2 sm:mx-5"
        >
          <div className="flex items-end justify-between gap-3 pb-3">
            <h2 id="assessment-history-title" className="text-lg font-black">
              지금까지의 평가 기록
            </h2>
            <span className="text-xs text-gray-500">
              {records.length + legacy.length}건
            </span>
          </div>
          <ul className="divide-y divide-gray-300 border-t border-gray-400">
            {records.map((record) => (
              <li
                key={record.id}
                className="py-3 flex flex-wrap gap-3 items-center justify-between"
              >
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    <span>3문항 판단 평가</span>
                    <span className="text-gray-400">·</span>
                    <span>
                      {record.mode === "demo"
                        ? "데모"
                        : record.evaluation
                          ? `${record.evaluation.totalScore}점`
                          : "판단 기록"}
                    </span>
                    {record.mode !== "demo" && record.evaluation?.passed && (
                      <span className="border border-green-700 bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-800">
                        PASS
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-1 text-gray-600">
                    {new Date(record.session.endedAt!).toLocaleString("ko-KR")}{" "}
                    · 응답 {record.session.answeredQuestionCount}/3문항
                  </p>
                </div>
                <button
                  className="border border-gray-500 bg-transparent px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-black hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]"
                  onClick={() =>
                    navigate(`/record/${encodeURIComponent(record.id)}`)
                  }
                >
                  기록 보기
                </button>
              </li>
            ))}
            {legacy.map((record) => (
              <li key={record.id} className="py-3">
                <p className="font-bold text-sm">{record.title}</p>
                <p className="text-xs mt-1 text-gray-600">
                  이전 평가 기록 ·{" "}
                  {new Date(record.completedAt).toLocaleString("ko-KR")} · 판단{" "}
                  {record.judgmentCount}건
                </p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-bold">
                    이전 판단 기록 보기
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {record.decisions.map((d, index) => (
                      <li key={index} className="border p-3">
                        <p className="font-bold">
                          {d.assetName} ·{" "}
                          {d.direction === "UP" ? "▲ 상승" : "▼ 하락"} · 확신도{" "}
                          {CONFIDENCE_LABELS[d.confidence] ?? d.confidence}
                        </p>
                        <p className="text-xs mt-1">
                          {new Date(d.submittedAt).toLocaleString("ko-KR")} ·{" "}
                          {d.reasons
                            .map(
                              (reason) =>
                                REASON_LABELS[reason] ??
                                {
                                  SUPPLY_DEMAND: "수급",
                                  DISCLOSURE: "공시",
                                  COMMUNITY: "커뮤니티",
                                  MACRO: "거시경제",
                                }[reason] ??
                                reason,
                            )
                            .join(", ")}
                        </p>
                        {d.memo && (
                          <p className="mt-2 whitespace-pre-wrap">{d.memo}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          <p className="border-t border-gray-300 pt-3 text-xs text-gray-600">
            이전 평가의 원본 기록은 유지됩니다. 개정 전 점수는 현재 평가 기준과
            비교하지 않습니다.
          </p>
        </section>
      )}
      {historyError && (
        <p role="alert" className="text-red-700">
          {historyError}
        </p>
      )}
    </AssessmentLayout>
  );
  const analysis = (
    <AssessmentLayout onHome={home} mode={controller.mode}>
      {runtime.profileAnalysis ? (
        <ProfileAnalysis profile={runtime.profileAnalysis} />
      ) : (
        <Panel title="설문 분석 결과">
          <p className="text-sm leading-7">
            설문 응답을 반영해 세 가지 평가 문항을 준비했습니다.
          </p>
        </Panel>
      )}
      <div className="flex justify-end">
        <button className={buttonClass} onClick={() => navigate("/ready")}>
          평가 진행 →
        </button>
      </div>
    </AssessmentLayout>
  );
  const ready = (
    <AssessmentLayout onHome={home} mode={controller.mode}>
      <Panel title="평가 준비 완료">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-black">
            세 가지 시장 상황을 살펴보세요.
          </h1>
          <RubricHelp passThreshold={70} />
        </div>
        <p className="mt-3 text-sm">
          한 번에 한 문항씩 공개됩니다. 시작 버튼을 누르면 첫 문항의 3분
          타이머가 시작됩니다.
        </p>
        {controller.mode === "api" && (
          <p className="mt-3 text-xs text-gray-600">
            진행 중 새로고침하면 시험이 초기화됩니다. 완료된 결과는 평가 기록에
            보관됩니다.
          </p>
        )}
        <div className="mt-5">
          <Rules />
        </div>
      </Panel>
      <div className="flex justify-end">
        <button
          disabled={busy}
          className={buttonClass + " !border"}
          onClick={async () => {
            if (await controller.start()) navigate("/exam");
          }}
        >
          {busy ? "시작 중…" : "평가 시작 →"}
        </button>
      </div>
    </AssessmentLayout>
  );
  let exam;
  if (runtime.sessionId && (!state.restored || !session))
    exam = (
      <AssessmentLayout onHome={home} mode={controller.mode}>
        <Panel title="진행 상태 확인">
          <p role="status">평가 진행 상태를 불러오고 있습니다.</p>
          <button
            className={secondaryClass + " mt-4"}
            onClick={() => void controller.sync()}
          >
            다시 확인
          </button>
          <button className={secondaryClass + " mt-4 ml-2"} onClick={reset}>
            리셋
          </button>
        </Panel>
      </AssessmentLayout>
    );
  else if (session?.status === "ACTIVE" && session.currentItem)
    exam = (
      <App
        key={session.currentItem.assessmentItemId}
        controller={controller}
        session={session}
        events={runtime.events}
        receivedAt={state.receivedAt}
        busy={busy}
        pending={Boolean(runtime.pending)}
        error={error}
        onHome={home}
      />
    );
  else if (currentRecord)
    exam = (
      <AssessmentLayout onHome={home} mode={controller.mode}>
        {controller.mode === "api" && !runtime.evaluation && (
          <Panel
            title={
              state.evaluating
                ? "판단 과정을 분석하고 있습니다"
                : "평가 결과를 다시 요청해 주세요"
            }
          >
            {state.evaluating ? (
              <RadialLoader label="판단 과정 분석 중" />
            ) : (
              <p role="status" className="text-sm leading-7">
                판단 기록은 유지되어 있습니다. 같은 기록으로 평가를 다시 요청할
                수 있습니다.
              </p>
            )}
            {!busy && (
              <button
                className={buttonClass + " mt-4"}
                onClick={() => void controller.retry()}
              >
                평가 다시 요청
              </button>
            )}
          </Panel>
        )}
        <AssessmentResults record={currentRecord} />
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} onClick={home}>
            전체 평가 기록
          </button>
          <button
            className={secondaryClass}
            disabled={busy || Boolean(runtime.pending)}
            onClick={() => {
              if (!controller.newAssessment()) return;
              void begin();
            }}
          >
            새 평가 시작
          </button>
        </div>
      </AssessmentLayout>
    );
  else
    exam = (
      <Navigate
        to={session?.status === "CREATED" ? "/analysis" : "/"}
        replace
      />
    );
  return (
    <>
      {(error || storageError || runtime.pending) && (
        <div
          className="border-b-2 border-red-700 bg-red-50 p-3 text-sm text-red-900 flex flex-wrap items-center justify-between gap-2"
          role="alert"
        >
          <span>
            {error ||
              storageError ||
              (busy
                ? "요청을 처리하고 있습니다."
                : "이전 요청의 저장 결과를 확인해 주세요.")}
          </span>
          {!busy && runtime.sessionId && (
            <button
              className={secondaryClass}
              onClick={() => void controller.retry()}
            >
              {runtime.pending ? "이전 요청 다시 확인" : "다시 연결"}
            </button>
          )}
        </div>
      )}
      <Routes>
        <Route path="/" element={landing} />
        <Route
          path="/survey"
          element={
            runtime.questionnaire && !runtime.sessionId ? (
              <OnboardingSurvey
                key={runtime.questionnaire.questionnaireVersionId}
                startImmediately
                questions={runtime.questionnaire.questions}
                questionnaireVersionId={
                  runtime.questionnaire.questionnaireVersionId
                }
                initialAnswers={runtime.draft}
                onAnswersChange={controller.saveDraft}
                onGoHome={home}
                isSubmitting={busy}
                error={error}
                onComplete={async (result) => {
                  if (await controller.submit(result)) navigate("/analysis");
                }}
              />
            ) : (
              <Navigate
                to={session?.status === "CREATED" ? "/analysis" : "/exam"}
                replace
              />
            )
          }
        />
        <Route
          path="/analysis"
          element={
            session?.status === "CREATED" ? (
              analysis
            ) : (
              <Navigate to={session ? "/exam" : "/"} replace />
            )
          }
        />
        <Route
          path="/ready"
          element={
            session?.status === "CREATED" ? (
              ready
            ) : (
              <Navigate to={session ? "/exam" : "/"} replace />
            )
          }
        />
        <Route path="/matching" element={<Navigate to="/analysis" replace />} />
        <Route path="/exam" element={exam} />
        <Route
          path="/record/:recordId"
          element={
            <StoredRecord
              records={records}
              mode={controller.mode}
              onHome={home}
            />
          }
        />
        <Route
          path="/verify/:recordId"
          element={
            <StoredRecord
              records={records}
              mode={controller.mode}
              onHome={home}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
