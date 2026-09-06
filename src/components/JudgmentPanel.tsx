import { useRef, useState } from "react";
import type { AssessmentController } from "../assessment/controller";
import type {
  Confidence,
  CurrentItem,
  Direction,
  JudgmentInput,
  ReasonTag,
} from "../assessment/types";
import {
  CONFIDENCE_LABELS,
  REASON_LABELS,
  validateJudgment,
} from "../assessment/domain";
import { createUuid } from "../assessment/uuid";
import { buttonClass, secondaryClass } from "./AssessmentLayout";

export function JudgmentPanel({
  item,
  controller,
  judgmentCount = item.responseCount,
  busy,
  pending,
  error,
  expired,
}: {
  item: CurrentItem;
  controller: AssessmentController;
  judgmentCount?: number;
  busy: boolean;
  pending: boolean;
  error: string;
  expired: boolean;
}) {
  const [confidence, setConfidence] = useState<Confidence>("MEDIUM"),
    [tags, setTags] = useState<ReasonTag[]>(["PRICE"]),
    [text, setText] = useState(""),
    [validation, setValidation] = useState("");
  const submitting = useRef(false);
  const disabled = busy || pending || expired;
  const submit = async (direction: Direction) => {
    if (disabled || submitting.current) return;
    const clientEventId = createUuid();
    let body: JudgmentInput;
    try {
      body = validateJudgment({
        clientEventId,
        direction,
        confidence,
        reasonTags: tags,
        reasonText: text,
      });
    } catch (e) {
      setValidation((e as Error).message);
      return;
    }
    setValidation("");
    submitting.current = true;
    try {
      await controller.respond(item.assessmentItemId, body);
      if (
        controller
          .getSnapshot()
          .runtime.events.some(
            (entry) =>
              entry.kind === "judgment" &&
              entry.event.clientEventId === clientEventId,
          )
      ) {
        setText("");
      }
    } finally {
      submitting.current = false;
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 mt-3">
        기본값은 확신도 보통 · 가격·차트입니다. 선택을 바꾼 뒤 상승 또는 하락을
        누르면 바로 기록됩니다.
      </p>
      <fieldset disabled={disabled}>
        <legend className="font-bold text-sm mb-2">확신도 · 필수</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["LOW", "MEDIUM", "HIGH"] as const).map((c) => (
            <label
              key={c}
              className={`border p-3 cursor-pointer ${confidence === c ? "border-blue-800 bg-blue-50" : "border-gray-400"}`}
            >
              <input
                type="radio"
                name="confidence"
                value={c}
                checked={confidence === c}
                onChange={() => setConfidence(c)}
              />{" "}
              <span className="text-sm">{CONFIDENCE_LABELS[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend className="font-bold text-sm mb-2">
          판단 근거 · 1개 이상 필수
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(REASON_LABELS).map(([id, label]) => (
            <label
              key={id}
              className={`border p-3 cursor-pointer text-sm ${tags.includes(id as ReasonTag) ? "border-blue-800 bg-blue-50" : "border-gray-400"}`}
            >
              <input
                type="checkbox"
                value={id}
                checked={tags.includes(id as ReasonTag)}
                onChange={() =>
                  setTags((previous) =>
                    previous.includes(id as ReasonTag)
                      ? previous.filter((t) => t !== id)
                      : [...previous, id as ReasonTag],
                  )
                }
              />{" "}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-bold">
        직접 설명 · 선택
        <textarea
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="mt-2 block border border-gray-400 p-3 w-full font-normal"
          placeholder="새로 확인한 정보와 판단 이유를 적어 주세요."
        />
        <span
          className={`block text-right text-xs mt-1 ${Array.from(text.trim().normalize("NFC")).length > 500 ? "text-red-700" : "text-gray-500"}`}
        >
          {Array.from(text.trim().normalize("NFC")).length}/500자
        </span>
      </label>
      <p className="text-xs text-gray-600">
        직접 설명을 생략해도 감점하지 않습니다. 근거 태그와 확신도는 반드시
        선택해 주세요.
      </p>
      {(validation || error) && (
        <p
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-300 p-3"
        >
          {validation || error}
        </p>
      )}
      {pending && !busy && (
        <button
          type="button"
          className={secondaryClass}
          onClick={() => void controller.retry()}
        >
          이전 요청 저장 결과 확인
        </button>
      )}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={item.latestDirection === "UP"}
            className={
              buttonClass +
              " transition-colors " +
              (item.latestDirection === "UP"
                ? "!bg-red-700 !text-white !border-red-700 hover:!bg-red-800"
                : "!bg-white !text-red-800 !border-red-700 hover:!bg-red-50")
            }
            disabled={disabled}
            onClick={() => void submit("UP")}
          >
            ▲ 상승 판단
          </button>
          <button
            type="button"
            aria-pressed={item.latestDirection === "DOWN"}
            className={
              buttonClass +
              " transition-colors " +
              (item.latestDirection === "DOWN"
                ? "!bg-blue-800 !text-white !border-blue-800 hover:!bg-blue-900"
                : "!bg-white !text-blue-900 !border-blue-800 hover:!bg-blue-50")
            }
            disabled={disabled}
            onClick={() => void submit("DOWN")}
          >
            ▼ 하락 판단
          </button>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
          <p>
            현재까지 판단 <strong>{judgmentCount}회</strong>
            {item.latestDirection &&
              ` · 최근 ${item.latestDirection === "UP" ? "▲ 상승" : "▼ 하락"}`}
          </p>
          <p className="text-gray-600">
            새 정보를 확인하고 판단을 추가할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
