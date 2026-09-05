import { useState, type FormEvent } from "react";
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
import { buttonClass, secondaryClass, Dialog } from "./AssessmentLayout";

export function JudgmentDialog({
  direction,
  item,
  controller,
  busy,
  pending,
  error,
  onClose,
}: {
  direction: Direction;
  item: CurrentItem;
  controller: AssessmentController;
  busy: boolean;
  pending: boolean;
  error: string;
  onClose: () => void;
}) {
  const [confidence, setConfidence] = useState<Confidence | null>(null),
    [tags, setTags] = useState<ReasonTag[]>([]),
    [text, setText] = useState(""),
    [validation, setValidation] = useState("");
  const [clientEventId] = useState(() => crypto.randomUUID());
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) {
      if (await controller.retry()) onClose();
      return;
    }
    if (!confidence) {
      setValidation("확신도를 선택해 주세요.");
      return;
    }
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
    await controller.respond(item.assessmentItemId, body);
    if (
      controller
        .getSnapshot()
        .runtime.events.some(
          (entry) => entry.event.clientEventId === clientEventId,
        )
    )
      onClose();
  };
  return (
    <Dialog
      title={`${direction === "UP" ? "▲ 상승" : "▼ 하락"} 판단 기록`}
      onClose={onClose}
      locked={busy}
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm">
          {item.scenario.asset.displayName} · 새 판단과 이유가 시간순으로
          추가됩니다.
        </p>
        <fieldset disabled={busy || pending}>
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
                  checked={confidence === c}
                  onChange={() => setConfidence(c)}
                />{" "}
                <span className="text-sm">{CONFIDENCE_LABELS[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy || pending}>
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
            disabled={busy || pending}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
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
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={secondaryClass}
            disabled={busy}
            onClick={onClose}
          >
            닫기
          </button>
          <button className={buttonClass} disabled={busy}>
            {busy ? "저장 중…" : pending ? "저장 결과 확인" : "판단 기록"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
