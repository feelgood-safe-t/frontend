import React, { useEffect, useRef } from "react";
import { HomeLogo } from "./HomeLogo";
export const buttonClass =
  "min-h-11 border-2 border-black px-4 py-2 font-bold text-sm bg-[#004080] text-white hover:bg-[#002B57] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004080]";
export const secondaryClass =
  buttonClass + " !bg-white !text-black hover:!bg-gray-100";
export function AssessmentLayout({
  children,
  onHome,
  actions,
  mode = "demo",
}: {
  children: React.ReactNode;
  onHome: () => void;
  actions?: React.ReactNode;
  mode?: "demo" | "api";
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#E7EBEF] text-black">
      <header className="bg-[#004080] text-white border-b-2 border-black">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <HomeLogo onGoHome={onHome} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        </div>
      </header>
      <main className="w-full max-w-6xl mx-auto p-3 sm:p-6 flex-1 space-y-4">
        {children}
      </main>
      <footer className="border-t border-black bg-[#D4D0C8] px-4 py-3 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between gap-2">
          <span>청노 · 투자 추천이 아닌 교육용 시뮬레이션</span>
          {mode === "demo" && <span>데모 · 고정 예시 데이터</span>}
        </div>
      </footer>
    </div>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-2 border-black bg-white">
      <h2 className="bg-[#E0E0E0] border-b border-black px-4 py-2 font-bold text-sm">
        {title}
      </h2>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) closeRef.current();
      }}
      className="m-auto w-[calc(100%-24px)] max-w-2xl max-h-[90dvh] overflow-y-auto border-2 border-black bg-white p-0 backdrop:bg-black/60"
    >
      <div className="sticky top-0 bg-[#004080] text-white p-3 flex items-center justify-between gap-3 z-10">
        <h2 className="font-bold">{title}</h2>
        <button
          className="min-h-10 px-3 border border-white disabled:opacity-40"
          disabled={locked}
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
export function Rules() {
  return (
    <div className="text-sm space-y-3">
      <p>
        가격을 맞혔는지가 아니라, 당시 공개된 정보로 어떻게 판단했는지를
        평가합니다.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>3문항을 순서대로 진행하며 문항당 최대 3분입니다.</li>
        <li>
          각 문항에서 판단을 한 번 이상 남긴 뒤 다음 문항으로 이동할 수
          있습니다.
        </li>
        <li>
          같은 방향의 재확인도 새 판단으로 기록됩니다. 이전 기록은 수정되지
          않습니다.
        </li>
        <li>문항 조기 완료와 시험 종료 자체에는 고정 감점이 없습니다.</li>
        <li>
          미응답 문항은 0점입니다. 세 문항 평균이 반올림 전 70점 이상이면
          통과합니다.
        </li>
        <li>
          화면을 나가도 시간이 흐릅니다. 결과는 전체 평가가 끝난 뒤 공개합니다.
        </li>
      </ul>
    </div>
  );
}
