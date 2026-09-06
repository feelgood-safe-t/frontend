/** Errors from the local assessment/demo lifecycle, not participant authentication. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(
      code === "RESPONSE_REQUIRED"
        ? "판단을 한 번 이상 기록해 주세요."
        : code === "CONTENT_NOT_AVAILABLE"
          ? "아직 공개되지 않은 뉴스입니다."
          : status === 409
            ? "문항이 종료되었거나 상태가 변경됐습니다. 현재 문항을 확인해 주세요."
            : "진행 정보를 확인할 수 없습니다. 새 평가를 시작해 주세요.",
    );
  }
}
