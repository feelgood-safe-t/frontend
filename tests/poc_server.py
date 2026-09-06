"""Disposable contract server: real FastAPI/engine/rules, no OpenAI or database.

Only this test entry point injects deterministic model responses. Production
backend startup and its no-fallback policy are unchanged.
"""

from __future__ import annotations

import json
import os
import socket
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import uvicorn
from safe_t_engine.app import create_app
from safe_t_engine.config import Settings
from safe_t_engine.evaluation import RUBRIC, SnapshotV5Evaluator
from safe_t_engine.selection import SelectionResult


class FixtureSelector:
    model = "integration-test-only"
    reasoning_effort = "low"

    def select(
        self,
        *,
        questionnaire: dict[str, Any],
        survey: dict[str, Any],
        scenario_catalog: dict[str, Any],
    ) -> SelectionResult:
        assert len(questionnaire["questions"]) == len(survey["answers"]) == 10
        return SelectionResult.model_validate(
            {
                "profile": {
                    "summary": "통합 테스트용 성향 분석입니다.",
                    "strengths": ["가격과 뉴스의 근거를 확인함"],
                    "weaknesses": ["정보 출처를 비교하는 연습이 필요함"],
                    "learningPriorities": ["새 정보와 판단 근거 연결하기"],
                },
                "selections": [
                    {
                        "ordinal": ordinal,
                        "scenarioId": candidate["scenarioId"],
                        "reason": "실제 엔진 계약 검증을 위해 고정한 테스트 문항입니다.",
                    }
                    for ordinal, candidate in enumerate(
                        scenario_catalog["candidates"][:3], start=1
                    )
                ],
            }
        )


class FixtureResponses:
    def create(self, **kwargs: Any) -> SimpleNamespace:
        assert kwargs["store"] is False
        snapshot = json.loads(kwargs["input"])
        assert snapshot["payload"]["schemaVersion"] == "safe-t-evaluation-snapshot/5.0"
        output = {
            "items": [
                {
                    "ordinal": item["ordinal"],
                    "criteria": [
                        {
                            "criterionId": criterion.criterion_id,
                            "score": float(criterion.max_score),
                            "rationaleKo": "통합 테스트용 고정 근거입니다. 실제 모델 평가가 아닙니다.",
                        }
                        for criterion in RUBRIC
                    ],
                    "summaryKo": "통합 테스트용 평가 요약입니다.",
                    "improvementsKo": ["정보 출처와 판단 이유를 함께 기록해 보세요."],
                }
                for item in snapshot["payload"]["items"]
                if item["responses"]
            ]
        }
        return SimpleNamespace(output_text=json.dumps(output, ensure_ascii=False))


def main() -> None:
    run_id = str(UUID(os.environ["SAFE_T_TEST_RUN_ID"]))
    backend = Path(__file__).resolve().parents[2] / "backend"
    settings = Settings(
        fixtures_dir=backend / "fixtures",
        snapshot_schema_path=backend / "docs/schemas/evaluation-snapshot.schema.json",
        historical_scenarios_dir=backend / "data/historical-scenarios/v2",
        cors_allowed_origins=(
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ),
    )
    evaluator = SnapshotV5Evaluator(
        model="integration-test-only",
        reasoning_effort="low",
        client=SimpleNamespace(responses=FixtureResponses()),
    )
    app = create_app(settings, selector=FixtureSelector(), evaluator=evaluator)

    @app.get("/__poc_test__/identity", include_in_schema=False)
    def identity() -> dict[str, Any]:
        return {"runId": run_id, "modelCalls": "stubbed", "persistence": "none"}

    # Keep the allocated socket open, so discovering a free port cannot race
    # with another process binding it. Never bind the user's 8000 server.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        port = listener.getsockname()[1]
        print(
            json.dumps({"runId": run_id, "base": f"http://127.0.0.1:{port}"}),
            flush=True,
        )
        server = uvicorn.Server(
            uvicorn.Config(app, log_level="warning", access_log=False)
        )
        server.run(sockets=[listener])


if __name__ == "__main__":
    main()
