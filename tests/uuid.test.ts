import assert from "node:assert/strict";
import { test } from "node:test";
import { createUuid } from "../src/assessment/uuid";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("UUID generation prefers the browser native implementation", () => {
  const native = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(createUuid({ randomUUID: () => native }), native);
});

test("UUID generation works when randomUUID is unavailable on an HTTP page", () => {
  const value = createUuid({
    getRandomValues: (bytes) => {
      bytes.forEach((_, index) => {
        bytes[index] = index;
      });
    },
  });
  assert.match(value, UUID_V4);
});

test("UUID generation retains a final fallback when Web Crypto is unavailable", () => {
  const first = createUuid(
    null,
    () => 0.25,
    () => 1234567890,
  );
  const second = createUuid(
    null,
    () => 0.25,
    () => 1234567890,
  );
  assert.match(first, UUID_V4);
  assert.match(second, UUID_V4);
  assert.notEqual(first, second);
});
