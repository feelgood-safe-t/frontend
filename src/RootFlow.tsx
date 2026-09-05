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
  Rules,
} from "./components/AssessmentLayout";
import {
  AssessmentResults,
  RubricTable,
  SampleReport,
} from "./components/AssessmentResults";
import { OnboardingSurvey } from "./components/OnboardingSurvey";

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
  }, [location.pathname, session?.endedAt, session?.status, runtime.events]);
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
              className={buttonClass}
              onClick={() =>
                navigate(session.status === "ACTIVE" ? "/exam" : "/ready")
              }
            >
              {session.status === "ACTIVE"
                ? "진행 중인 평가 이어하기"
                : "준비된 평가 시작하기"}
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
          <button
            className={secondaryClass}
            onClick={() => navigate("/sample")}
          >
            샘플 보고서 보기
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500">포지션·거래 모드 · 준비 중</p>
      </Panel>
      {(records.length > 0 || legacy.length > 0) && (
        <Panel title="지금까지의 평가 기록">
          <ul className="divide-y divide-gray-300">
            {records.map((record) => (
              <li
                key={record.id}
                className="py-3 flex flex-wrap gap-3 items-center justify-between"
              >
                <div>
                  <p className="font-bold text-sm">
                    3문항 판단 평가 ·{" "}
                    {record.mode === "demo" ? "데모" : "제출 완료"}
                  </p>
                  <p className="text-xs mt-1 text-gray-600">
                    {new Date(record.session.endedAt!).toLocaleString("ko-KR")}{" "}
                    · 응답 {record.session.answeredQuestionCount}/3문항
                  </p>
                </div>
                <button
                  className={secondaryClass}
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
          <p className="text-xs mt-3 text-gray-600">
            이전 평가의 원본 기록은 유지됩니다. 개정 전 점수는 현재 평가 기준과
            비교하지 않습니다.
          </p>
        </Panel>
      )}
      {historyError && (
        <p role="alert" className="text-red-700">
          {historyError}
        </p>
      )}
    </AssessmentLayout>
  );
  const ready = (
    <AssessmentLayout onHome={home} mode={controller.mode}>
      <Panel title="평가 준비 완료">
        <h1 className="text-2xl font-black">세 가지 시장 상황을 살펴보세요.</h1>
        <p className="mt-3 text-sm">
          한 번에 한 문항씩 공개됩니다. 시작 버튼을 누르면 첫 문항의 3분
          타이머가 시작됩니다.
        </p>
        <div className="mt-5">
          <Rules />
        </div>
      </Panel>
      <Panel title="이렇게 평가합니다">
        <RubricTable />
        <p className="text-xs mt-3 leading-6">
          근거 태그와 확신도는 필수이며, 직접 설명은 선택입니다. 설문 응답과
          실제 판단의 연결도 평가합니다. 문항 하나라도 미응답이면 통과할 수
          없습니다.
        </p>
      </Panel>
      <div className="flex justify-end">
        <button
          disabled={busy}
          className={buttonClass}
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
          <button
            className={secondaryClass}
            onClick={() => navigate("/sample")}
          >
            샘플 보고서 보기
          </button>
        </div>
      </AssessmentLayout>
    );
  else
    exam = (
      <Navigate to={session?.status === "CREATED" ? "/ready" : "/"} replace />
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
                  if (await controller.submit(result)) navigate("/ready");
                }}
              />
            ) : (
              <Navigate to={runtime.sessionId ? "/exam" : "/"} replace />
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
        <Route path="/matching" element={<Navigate to="/ready" replace />} />
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
        <Route
          path="/sample"
          element={
            <AssessmentLayout onHome={home} mode={controller.mode}>
              <SampleReport />
            </AssessmentLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
