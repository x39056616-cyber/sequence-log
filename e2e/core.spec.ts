import { expect, test } from "@playwright/test";

test("choose a pathway, complete a quest, and undo the settlement", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("选择你在现实里的非凡途径")).toBeVisible();
  await page.getByTestId("pathway-fool").click();
  await page.getByTestId("confirm-pathway").click();
  await expect(page.getByText(/序列 9/).first()).toBeVisible();

  await page.getByRole("link", { name: "任务" }).first().click();
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.locator("#quest-title").fill("完成一次端到端阅读");
  await page.getByLabel("扮演契合度").selectOption("1");
  await page.getByTestId("save-quest").click();
  const card = page.locator("article").filter({ hasText: "完成一次端到端阅读" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "完成任务" }).click();
  await page.getByRole("button", { name: "完成结算" }).click();
  await expect(page.getByRole("dialog", { name: "魔药消化结算" })).toBeVisible();
  await page.getByRole("button", { name: "撤销完成" }).click();
  await expect(page.getByRole("dialog", { name: "魔药消化结算" })).toBeHidden();

  await page.reload();
  await expect(page.getByText("完成一次端到端阅读")).toBeVisible();
});
