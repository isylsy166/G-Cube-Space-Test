import { strict as assert } from "node:assert";
import { test } from "node:test";
import { purchaseTiming, shiftDate, reviewRecipient } from "../src/lib/fulfillment";

test("scenario shortages distinguish three timely orders from four late orders", () => {
  const cases = [
    ["2026-07-24", 2, true], ["2026-07-26", 4, true], ["2026-07-27", 4, true],
    ["2026-07-23", 2, false], ["2026-07-25", 5, false], ["2026-07-24", 5, false], ["2026-07-26", 5, false],
  ] as const;
  for (const [delivery, lead, expected] of cases) assert.equal(purchaseTiming(delivery, lead).onTime, expected);
});
test("delivery day arrivals miss the previous-day deadline", () => {
  assert.deepEqual(purchaseTiming("2026-07-23T09:00:00", 2), { deadline: "2026-07-22", availableAt: "2026-07-23", onTime: false });
});
test("missing and invalid supplier lead times never permit purchase", () => {
  for (const lead of [undefined, -1, NaN, 1.5]) assert.equal(purchaseTiming("2026-07-30", lead).onTime, null);
});
test("deadlines cross month and year boundaries", () => {
  assert.equal(shiftDate("2027-01-01", -1), "2026-12-31");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});
test("review reasons direct the operator to the appropriate team", () => {
  assert.match(reviewRecipient("사용 중지된 창고"), /영업/);
  assert.match(reviewRecipient("미등록 품목"), /상품팀/);
  assert.match(reviewRecipient("품목으로 등록되어 있지 않습니다"), /상품팀/);
  assert.match(reviewRecipient("수량이 0 입니다"), /CS/);
});
