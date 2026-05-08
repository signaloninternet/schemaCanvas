import { expect, test } from "@playwright/test";

test("loads the workspace and supports a basic visual edit", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('input[value="SchemaCanvas Demo"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /customers/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /orders/i }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Table" }).click();
  await expect(
    page.getByRole("button", { name: /new_table/i }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Migration" }).click();
  await expect(
    page.locator("pre").filter({ hasText: "CREATE TABLE new_table" }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "AST" }).click();
  await expect(
    page.getByText("SQL -> Parser -> AST -> SchemaModel -> Generators"),
  ).toBeVisible();
  await expect(page.getByText("create table").first()).toBeVisible();
});
