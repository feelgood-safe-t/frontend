import type { ProfileAnalysis as ProfileAnalysisData } from "../assessment/pocTypes";
import { Panel } from "./AssessmentLayout";

export function ProfileAnalysis({ profile }: { profile: ProfileAnalysisData }) {
  return (
    <Panel title="설문 분석 결과">
      <p className="whitespace-pre-wrap break-words text-sm leading-7">
        {profile.summary}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          { title: "현재의 강점", values: profile.strengths },
          { title: "보완하면 좋은 습관", values: profile.weaknesses },
          { title: "이번에 연습할 점", values: profile.learningPriorities },
        ].map(({ title, values }) => (
          <section
            key={title}
            className="border border-gray-300 bg-gray-50 p-3"
          >
            <h3 className="text-sm font-bold">{title}</h3>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6">
              {values.map((value, index) => (
                <li key={index}>{value}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-3 text-xs leading-6 text-gray-600">
        설문 응답을 바탕으로 정리한 학습 안내이며, 투자 적합성 진단이나 투자
        추천이 아닙니다.
      </p>
    </Panel>
  );
}
