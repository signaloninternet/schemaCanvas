import { expect, test } from "@playwright/test";

test("loads the workspace and supports a basic visual edit", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/");

  await expect(page.getByRole("img", { name: "SchemaCanvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "main v0.4" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /customers/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /orders/i }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Migration" }).click();
  await expect(
    page.getByText("main v0.4 -> analytics-fork v0.2"),
  ).toBeVisible();
  await expect(
    page
      .locator("pre")
      .filter({
        hasText: "ALTER TABLE customers ADD COLUMN phone TEXT;",
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.locator("pre").filter({ hasText: "CREATE TABLE customers" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "New table" }).click();
  await expect(
    page.getByRole("button", { name: /new_table/i }).first(),
  ).toBeVisible();

  await expect(
    page.locator("pre").filter({ hasText: "CREATE TABLE new_table" }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "AST" }).click();
  await expect(
    page.getByText("SQL -> Parser -> AST -> SchemaModel -> Generators"),
  ).toBeVisible();
  await expect(page.getByText("create table").first()).toBeVisible();
  await expect(page.getByText("data type").first()).toBeVisible();
  await expect(page.getByText("constraints").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeVisible();

  const astDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await expect((await astDownload).suggestedFilename()).toBe(
    "schemacanvas-demo-ast.json",
  );

  await page.getByRole("tab", { name: "Mind Map" }).click();
  await expect(page.getByText("SQL mind map")).toBeVisible();
  await expect(page.getByText("Tables", { exact: true })).toBeVisible();
  await expect(page.getByText("Relationships", { exact: true })).toBeVisible();

  const mindMapDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Mind Map PNG" }).click();
  await expect((await mindMapDownload).suggestedFilename()).toBe(
    "schemacanvas-demo-mind-map.png",
  );
});
