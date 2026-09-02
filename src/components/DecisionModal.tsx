import React, { useState, useEffect, useRef } from 'react';
import { AssetData, ConfidenceLevel, DirectionType, ReasonCategory } from '../types';

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: DirectionType;
  asset: AssetData;
  onSubmit: (decision: {
    direction: DirectionType;
    confidence: ConfidenceLevel;
    reasons: ReasonCategory[];
    memo: string;
  }) => void;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  isOpen,
  direction,
  asset,
  onClose,
  onSubmit,
}) => {
  const [confidence, setConfidence] = useState<ConfidenceLevel>('MEDIUM');
  const [reasons, setReasons] = useState<ReasonCategory[]>([]);
  const [memo, setMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitProgress, setSubmitProgress] = useState<number>(0);
  const [validationError, setValidationError] = useState<string>('');
  const submitIntervalRef = useRef<number | null>(null);
  const submitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfidence('MEDIUM');
      setReasons([]);
      setMemo('');
      setIsSubmitting(false);
      setSubmitProgress(0);
      setValidationError('');
    }

    return () => {
      if (submitIntervalRef.current !== null) {
        window.clearInterval(submitIntervalRef.current);
        submitIntervalRef.current = null;
      }
      if (submitTimeoutRef.current !== null) {
        window.clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleReason = (r: ReasonCategory) => {
    if (reasons.includes(r)) {
      setReasons(reasons.filter((item) => item !== r));
    } else {
      setReasons([...reasons, r]);
      setValidationError('');
    }
  };

  const handleFinalSubmit = () => {
    if (isSubmitting) return;

    const trimmedMemo = memo.trim();

    if (reasons.length === 0 && trimmedMemo.length === 0) {
      setValidationError('※ 판단 근거를 선택하거나 직접 입력해 주세요.');
      return;
    }

    setValidationError('');
    setIsSubmitting(true);

    // Visualize standard server transmission progress
    let p = 15;
    submitIntervalRef.current = window.setInterval(() => {
      p += 35;
      if (p >= 100) {
        if (submitIntervalRef.current !== null) {
          window.clearInterval(submitIntervalRef.current);
          submitIntervalRef.current = null;
        }
        setSubmitProgress(100);
        submitTimeoutRef.current = window.setTimeout(() => {
          submitTimeoutRef.current = null;
          onSubmit({
            direction,
            confidence,
            reasons,
            memo: trimmedMemo,
          });
          onClose();
        }, 250);
      } else {
        setSubmitProgress(p);
      }
    }, 90);
  };

  const reasonList: { id: ReasonCategory; label: string; desc: string }[] = [
    { id: 'PRICE', label: '가격/차트', desc: '캔들 패턴, 지지/저항선, 전일대비 등락' },
    { id: 'SUPPLY_DEMAND', label: '수급 동향', desc: '외국인·기관 대량 순매수/순매도' },
    { id: 'DISCLOSURE', label: '공시 정보', desc: 'DART 전자공시, 실적, 유상증자 등' },
    { id: 'NEWS', label: '뉴스 속보', desc: '언론 보도, 정책 발표, 긴급 속보' },
    { id: 'COMMUNITY', label: '커뮤니티', desc: '투자자 여론, 반대매매 루머, 심리' },
    { id: 'MACRO', label: '거시 지표', desc: '기준금리, 환율, 변동성지수(VKOSPI)' },
    { id: 'INTUITION', label: '직감/경험', desc: '경험칙 기반 시장 감각 및 육감' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 select-none">
      {/* Rigid Window Dialog */}
      <div className="w-full max-w-lg bg-[#F0F0F0] border-2 border-black flex flex-col">
        {/* Title Bar */}
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span>답안 마킹 및 근거 제출</span>
          <button
            onClick={onClose}
            className="bg-[#C0C0C0] hover:bg-white text-black px-2 py-0 text-xs font-black border border-black cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Notice Ribbon */}
        <div className="bg-[#FFFFCC] border-b border-black px-3 py-1.5 text-xs text-[#804000] font-bold">
          선택한 방향: {direction === 'UP' ? '▲ 상승' : '▼ 하락'} ({asset.name})
        </div>

        {/* Modal Form Content */}
        <div className="p-3.5 flex flex-col gap-3 text-xs bg-white">
          {/* 1. Confidence Level (Radio) */}
          <div className="border border-black p-2.5 bg-[#FAFAFA]">
            <div className="font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
              <span className="bg-[#004080] text-white px-1.5 py-0.2 text-[10px]">필수</span>
              <span>1. 판단 확신도</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { val: 'HIGH', label: '높음', desc: '충분한 근거 확보' },
                  { val: 'MEDIUM', label: '보통', desc: '일반적 확률 판단' },
                  { val: 'LOW', label: '낮음', desc: '불확실성 상존' },
                ] as const
              ).map((opt) => (
                <button
                  type="button"
                  key={opt.val}
                  onClick={() => setConfidence(opt.val)}
                  className={`flex flex-col p-2 border text-left cursor-pointer select-none ${
                    confidence === opt.val
                      ? 'border-2 border-[#004080] bg-[#EBF3FF] font-bold text-[#004080]'
                      : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      name="confidence"
                      checked={confidence === opt.val}
                      readOnly
                      className="pointer-events-none"
                    />
                    <span className="text-xs font-bold whitespace-nowrap">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Reasoning Categories (Checkboxes) */}
          <div className="border border-black p-2.5 bg-[#FAFAFA]">
            <div className="font-bold text-gray-900 mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="bg-[#004080] text-white px-1.5 py-0.2 text-[10px] whitespace-nowrap">택1 필수</span>
                <span className="whitespace-nowrap">2. 판단 근거 태그 (복수 선택 가능)</span>
              </div>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">선택 {reasons.length}개</span>
            </div>

            {validationError && (
              <div
                id="decision-reason-error"
                role="alert"
                className="bg-[#FFEAEA] text-[#D90000] border border-[#D90000] p-1 mb-2 text-[11px] font-bold"
              >
                {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {reasonList.map((r) => {
                const isChecked = reasons.includes(r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggleReason(r.id)}
                    className={`flex items-start space-x-2 p-2 border text-left w-full cursor-pointer select-none transition-none ${
                      isChecked
                        ? 'border-2 border-[#004080] bg-[#FFF7E6] font-bold shadow-none'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mt-0.5 pointer-events-none shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-black font-bold whitespace-nowrap">{r.label}</div>
                      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Direct Reason Input */}
          <div className="border border-black p-2.5 bg-[#FAFAFA]">
            <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
              <span className="bg-[#004080] text-white px-1.5 py-0.2 text-[10px]">택1 필수</span>
              <span>3. 판단 근거 직접 입력</span>
            </div>
            <input
              type="text"
              value={memo}
              onChange={(e) => {
                setMemo(e.target.value);
                if (e.target.value.trim().length > 0) setValidationError('');
              }}
              placeholder="예: 외국인 순매수 지속 및 실적 호조"
              className="w-full border border-black p-1.5 text-xs bg-white focus:outline-none"
              maxLength={60}
              aria-describedby={validationError ? 'decision-reason-error' : undefined}
            />
            <p className="mt-1 text-[10px] text-gray-500">
              근거 태그 또는 직접 입력 중 한 가지 이상을 작성해야 합니다.
            </p>
          </div>

          {/* Submission in progress indicator */}
          {isSubmitting && (
            <div className="bg-[#E6EEF8] border border-black p-2 text-center flex flex-col gap-1.5">
              <span className="font-bold text-xs text-[#004080]">
                답안 저장 중... ({submitProgress}%)
              </span>
              <div className="w-full bg-gray-200 border border-black h-2.5">
                <div
                  className="bg-[#004080] h-full transition-all duration-100"
                  style={{ width: `${submitProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Buttons Footer */}
        <div className="bg-[#E0E0E0] border-t border-black p-2.5 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-white hover:bg-gray-100 text-black px-3 py-1.5 border border-black text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className="bg-[#004080] hover:bg-[#002b57] text-white px-4 py-1.5 border-2 border-black text-xs font-bold active:bg-[#001f3f] cursor-pointer disabled:opacity-50"
          >
            답안 확정
          </button>
        </div>
      </div>
    </div>
  );
};
