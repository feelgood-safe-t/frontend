import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingSurvey } from "../src/components/OnboardingSurvey";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../src/data/onboardingQuestions";

const props = {
  onGoHome: () => {},
  onComplete: () => {},
  startImmediately: true,
  questions: ONBOARDING_QUESTIONS,
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
};

test("questionnaire removes redundant labels and keeps help/navigation outside the question box", () => {
  const html = renderToStaticMarkup(createElement(OnboardingSurvey, props));
  assert.ok(html.includes(ONBOARDING_QUESTIONS[0].detail));
  assert.doesNotMatch(
    html,
    /현재 선택|선택됨|필수 응답|border-l-4|설문에는 별도 제한 시간이 없습니다/,
  );
  assert.match(html, /h-dvh min-h-0 overflow-hidden/);
  assert.match(html, /shrink-0 z-30/);
  assert.match(html, /min-h-0 flex-1[^\"]*overflow-y-auto/);
  assert.match(html, /bg-\[#EAF3FF\] px-3 py-2 text-xs/);
  assert.match(html, /min-h-8 border px-1 py-1 text-\[10px\]/);
  const help = html.indexOf(
    "선택한 응답은 이전 문항으로 돌아가 다시 수정할 수 있습니다.",
  );
  const question = html.indexOf('aria-labelledby="question-heading"');
  const navigation = html.indexOf('<nav aria-label="설문 문항 이동"');
  assert.ok(help > -1 && help < question);
  assert.ok(navigation > question);
  assert.match(html, /← 이전 문항/);
  assert.match(html, /다음 문항 →/);
  assert.match(html, /class="flex items-center justify-between gap-2"/);
  assert.doesNotMatch(html, /bg-\[#E0E0E0\] border-t border-black p-3/);
});

test("a selected option uses the card state without a selected text badge", () => {
  const initialAnswers = Object.fromEntries(
    ONBOARDING_QUESTIONS.map((question) => [
      question.id,
      question.options
        .slice(0, question.minSelections)
        .map((option) => option.id),
    ]),
  );
  const html = renderToStaticMarkup(
    createElement(OnboardingSurvey, { ...props, initialAnswers }),
  );
  assert.match(html, /checked=""/);
  assert.match(html, /border-2 border-\[#004080\] bg-\[#EAF3FF\]/);
  assert.doesNotMatch(html, />선택됨</);
});
