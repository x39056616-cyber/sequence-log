import { expect, test } from "@playwright/test";

test("spin fate → generate background → start the first chapter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("选择你在现实里的非凡途径")).toBeVisible();
  await page.getByTestId("pathway-fool").click();
  await page.getByTestId("confirm-pathway").click();
  await expect(page.getByText(/序列 9/).first()).toBeVisible();

  // Step 1: spin and save a fate profile
  await page.goto("/wheel");
  await expect(page.getByRole("heading", { name: "让灰雾替你掷一次骰子" })).toBeVisible();
  await page.getByRole("button", { name: "一键抽整套命运" }).click();
  await expect(page.getByText(/本轮草稿/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "存入命运档案" }).click();
  await expect(page.getByText("当前生效的命运档案")).toBeVisible({ timeout: 15_000 });

  // Step 2: generate the character background.
  // With a provider configured we get an editable draft; without one we must get an honest error,
  // never substitute template prose.
  await page.getByRole("button", { name: "生成人物背景" }).click();
  const draftAppeared = page.getByRole("button", { name: "保存人物档案" });
  const errorAppeared = page.getByText(/尚未配置 AI|人物背景生成失败/);
  await expect(draftAppeared.or(errorAppeared)).toBeVisible({ timeout: 90_000 });

  if (await errorAppeared.isVisible().catch(() => false)) {
    // No provider: the wheel itself must still work and keep the saved fate.
    await page.reload();
    await expect(page.getByText("当前生效的命运档案")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("去命运转盘").first()).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "保存人物档案" }).click();
  await expect(page.getByText("已保存，可在「档案」页查看与编辑。").first()).toBeVisible({ timeout: 20_000 });

  // Step 3: start the first chapter from the adventure page
  await page.goto("/");
  await expect(page.getByText(/人物档案已就绪|还没有人物档案/).first()).toBeVisible({ timeout: 15_000 });
  const startButton = page.getByRole("button", { name: "开始第一章" });
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.click();
    // Either a full-length chapter streams in, or we get an explicit error — never template prose.
    await expect(page.getByRole("article").or(page.getByText("正文没有生成成功"))).toBeVisible({ timeout: 180_000 });
  }

  await page.reload();
  await expect(page.getByText("命运档案").first()).toBeVisible({ timeout: 15_000 });
});

