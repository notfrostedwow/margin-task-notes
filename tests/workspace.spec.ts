import { test, expect, type Page } from "@playwright/test";
import { demoWorkspace } from "../src/demo";
import {
  emptyWorkspace,
  LIMITS,
  serialize,
  type Workspace,
} from "../src/domain";
import { STORAGE_KEY } from "../src/storage";

async function seed(page: Page, workspace = demoWorkspace()) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!sessionStorage.getItem("test-seeded")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("test-seeded", "yes");
      }
    },
    { key: STORAGE_KEY, value: serialize(workspace) },
  );
  await page.goto("/");
  await openFilters(page);
}
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^Filters & sort/ });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
}
async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
}
async function dataMenu(page: Page) {
  const details = page.locator("details");
  if (!(await details.getAttribute("open").then((v) => v !== null)))
    await page.getByText("Notebook & data", { exact: true }).click();
}
async function upload(page: Page, raw: string) {
  await dataMenu(page);
  await page.getByLabel("Import notebook file").setInputFiles({
    name: "notebook.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
}
async function notesPanel(page: Page) {
  const button = page.getByRole("button", { name: /^Notes \(/ });
  if (await button.isVisible()) await button.click();
}
async function tasksPanel(page: Page) {
  const button = page.getByRole("button", { name: /^Tasks \(/ });
  if (await button.isVisible()) await button.click();
}
async function exportContent(page: Page) {
  await dataMenu(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
const incoming: Workspace = {
  version: 1,
  notes: [
    {
      id: "new-note",
      title: "Imported observations",
      body: "# Imported\n\nLiteral <script>window.pwned=true</script>\n\n[click](javascript:alert(1))",
      tags: ["new-thread"],
      archived: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  tasks: [
    {
      id: "new-task",
      title: "Imported task",
      body: "Keep every field",
      tags: ["fresh"],
      archived: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      due: "2026-01-01",
      priority: "high",
      status: "doing",
      noteIds: ["new-note"],
    },
  ],
};

test("visible notebook text has readable contrast and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  const lowContrast = await page.evaluate(() => {
    function rgb(color: string): number[] {
      return (color.match(/[\d.]+/g) ?? []).map(Number);
    }
    function luminance(channels: number[]) {
      return channels
        .slice(0, 3)
        .map((c) => c / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce(
          (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    }
    const failures: { text: string; ratio: number }[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (
        !element ||
        !node.textContent?.trim() ||
        !element.getClientRects().length ||
        element.closest("[aria-hidden=true], :disabled, script, style, option")
      )
        continue;
      let ancestor: Element | null = element;
      let background = "rgb(245, 242, 233)";
      while (ancestor) {
        const color = getComputedStyle(ancestor).backgroundColor;
        const channels = rgb(color);
        if (channels.length === 3 || channels[3] === 1) {
          background = color;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const foreground = luminance(rgb(getComputedStyle(element).color)),
        back = luminance(rgb(background));
      const ratio =
        (Math.max(foreground, back) + 0.05) /
        (Math.min(foreground, back) + 0.05);
      if (ratio < 4.5)
        failures.push({ text: node.textContent.trim().slice(0, 50), ratio });
    }
    return failures;
  });
  expect(lowContrast).toEqual([]);
  expect(
    await page
      .locator("main")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});

test("original layout, search/filter counts, sorting and no overflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  await expect(
    page.getByRole("heading", { name: "Room for good work." }),
  ).toBeVisible();
  await expect(
    page.getByText("5 of 5 tasks · 3 of 3 notes match", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search tasks and notes" })
    .fill("BENCHES fieldwork");
  await expect(
    page.getByText("1 of 5 tasks · 0 of 3 notes match", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".task-title")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("doing");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await page
    .getByRole("combobox", { name: "Tag", exact: true })
    .selectOption("fieldwork");
  await expect(page.locator(".task-title")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("low");
  await expect(
    page.getByRole("heading", { name: "No tasks match this view." }),
  ).toBeVisible();
  await page.locator(".reset-button").click();
  await page
    .getByRole("textbox", { name: "Search tasks and notes" })
    .fill("unexpected community");
  await expect(
    page.getByText("0 of 5 tasks · 1 of 3 notes match", { exact: false }),
  ).toBeVisible();
  await notesPanel(page);
  await expect(page.locator(".note-title")).toHaveText(
    "A slower way to notice",
  );
  await page.locator(".reset-button").click();
  await tasksPanel(page);
  await page
    .getByRole("combobox", { name: "Sort", exact: true })
    .selectOption("title");
  await expect(page.locator(".task-title").first()).toHaveText(
    "Agree on a meeting place",
  );
  await page.locator(".reset-button").click();
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).resolves.toBe(true);
  const toggle = page.getByRole("button", { name: /^Filters & sort/ });
  if (await toggle.isVisible()) await toggle.click();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-workspace.png`,
  });
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-workspace-full.png`,
    fullPage: true,
  });
  await notesPanel(page);
  if (info.project.name === "mobile") {
    await page
      .locator(".notes-panel")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "docs/screenshots/mobile-notes.png" });
  }
  expect(errors).toEqual([]);
});

test("keyboard creation and edit dialogs, containment, Escape, tags and linked notes survive reload", async ({
  page,
}) => {
  await seed(page);
  const trigger = page.getByRole("button", { name: "+ New note", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Save note", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await dialog.getByLabel("Title", { exact: true }).fill("Uncommitted draft");
  const before = await stored(page);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(await stored(page)).toBe(before);
  await trigger.click();
  await dialog.getByLabel("Title", { exact: true }).fill("Bridge journal");
  await dialog
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("# Bridge\n\nWatch the light at dusk.\n\n- Listen\n- Record");
  await dialog.getByLabel("Tags, separated by commas").fill("Research, dusk");
  await dialog.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "+ New task", exact: true }).click();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Return to the bridge");
  await dialog
    .getByRole("textbox", { name: "Details", exact: true })
    .fill("Photograph the handrail");
  await dialog.getByLabel("Tags, separated by commas").fill("research");
  await dialog
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("doing");
  await dialog.getByLabel("Due date").fill("2026-01-01");
  await dialog.getByLabel("Bridge journal", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page
    .getByRole("button", { name: "Return to the bridge", exact: true })
    .click();
  await dialog.getByLabel("Title", { exact: true }).fill("Return at dusk");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete Return at dusk", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen Return at dusk", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reopen Return at dusk", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Return at dusk", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".task-row")
      .filter({ hasText: "Return at dusk" })
      .getByText("01 Jan 2026"),
  ).toBeVisible();
  await page
    .locator(".task-row")
    .filter({ hasText: "Return at dusk" })
    .getByRole("button", { name: "↳ Bridge journal", exact: true })
    .click();
  await expect(page.locator(".note-title")).toHaveText("Bridge journal");
  await page.getByRole("button", { name: "Edit note", exact: false }).click();
  await dialog
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Changed observation");
  await dialog.getByRole("button", { name: "Save note", exact: true }).click();
  await page.reload();
  await notesPanel(page);
  await page
    .locator(".note-picker")
    .getByRole("button", { name: /Bridge journal/ })
    .click();
  await expect(page.locator(".markdown")).toContainText("Changed observation");
  const exported = JSON.parse(await exportContent(page));
  expect(exported).toEqual(JSON.parse((await stored(page))!));
  expect(
    exported.tasks.find((t: { title: string }) => t.title === "Return at dusk"),
  ).toMatchObject({ status: "todo", due: "2026-01-01", tags: ["research"] });
});

test("validated import Cancel, Escape and accept preserve or replace the FULL notebook across reloads", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await page
    .getByRole("combobox", { name: "Tag", exact: true })
    .selectOption("community");
  for (const cancel of ["button", "escape"]) {
    await openFilters(page);
    await page
      .getByRole("combobox", { name: "Tag", exact: true })
      .selectOption("community");
    await upload(page, serialize(incoming));
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    expect(await stored(page)).toBe(before);
    if (cancel === "button")
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    else await page.keyboard.press("Escape");
    expect(await stored(page)).toBe(before);
    await expect(
      page.getByRole("combobox", { name: "Tag", exact: true }),
    ).toHaveValue("community");
    expect(JSON.parse(await exportContent(page))).toEqual(demoWorkspace());
    await page.reload();
    expect(await stored(page)).toBe(before);
  }
  await upload(page, serialize(incoming));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace notebook", exact: true })
    .click();
  expect(JSON.parse((await stored(page))!)).toEqual(incoming);
  await openFilters(page);
  await expect(
    page.getByRole("combobox", { name: "Tag", exact: true }).locator("option"),
  ).toHaveText(["All tags", "fresh", "new-thread"]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Imported task", exact: true }),
  ).toBeVisible();
  expect(JSON.parse(await exportContent(page))).toEqual(incoming);
  await page
    .getByRole("button", { name: "↳ Imported observations", exact: true })
    .click();
  await expect(page.locator(".markdown")).toContainText(
    "<script>window.pwned=true</script>",
  );
  await expect(
    page.locator(".markdown script, .markdown a, .markdown img"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});

test("sample load and empty reset require confirmation; Cancel/Escape preserve full bytes, acceptance survives reload", async ({
  page,
}) => {
  await seed(page, incoming);
  for (const replacement of ["Load sample notebook", "Reset to empty"]) {
    const before = await stored(page);
    for (const cancel of ["button", "escape"]) {
      await dataMenu(page);
      await page
        .getByRole("button", { name: replacement, exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      if (cancel === "button")
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
      else await page.keyboard.press("Escape");
      expect(await stored(page)).toBe(before);
      expect(JSON.parse(await exportContent(page))).toEqual(
        JSON.parse(before!),
      );
      await page.reload();
      expect(await stored(page)).toBe(before);
    }
    await dataMenu(page);
    await page.getByRole("button", { name: replacement, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Replace notebook", exact: true })
      .click();
    const expected =
      replacement === "Load sample notebook"
        ? demoWorkspace()
        : emptyWorkspace();
    expect(JSON.parse((await stored(page))!)).toEqual(expected);
    await page.reload();
    expect(JSON.parse(await exportContent(page))).toEqual(expected);
  }
  if ((await page.locator("details").getAttribute("open")) !== null)
    await page.getByText("Notebook & data", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little room to begin." }),
  ).toBeVisible();
  await notesPanel(page);
  await expect(
    page.getByRole("heading", { name: "An open page." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Write your first note" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("First thought");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  expect(JSON.parse((await stored(page))!).notes).toHaveLength(1);
});

test("invalid imports never open a confirmation or touch stored bytes", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  const duplicates = demoWorkspace();
  duplicates.notes.push(duplicates.notes[0]);
  const dangling = demoWorkspace();
  dangling.tasks[0].noteIds = ["no-note"];
  const tooLong = demoWorkspace();
  tooLong.notes[0].body = "x".repeat(20001);
  const tooMany = {
    version: 1,
    tasks: [],
    notes: Array.from({ length: 201 }, (_, i) => ({
      ...demoWorkspace().notes[0],
      id: `n${i}`,
    })),
  };
  for (const [raw, message] of [
    ["{bad", "Malformed"],
    [" ".repeat(LIMITS.bytes + 1), "byte limit"],
    [JSON.stringify(duplicates), "Duplicate ID"],
    [JSON.stringify(dangling), "Dangling"],
    ['{"version":42,"tasks":[],"notes":[]}', "Unsupported"],
    [JSON.stringify(tooLong), "maximum"],
    [JSON.stringify(tooMany), "limit 200"],
    [
      '{"version":1,"tasks":[],"notes":[],"__proto__":{"polluted":true}}',
      "Unexpected",
    ],
  ]) {
    await upload(page, raw);
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await stored(page)).toBe(before);
  }
  expect(await page.evaluate(() => "polluted" in Object.prototype)).toBe(false);
  await page.reload();
  expect(await stored(page)).toBe(before);
});

test("archive/delete confirmations and note deletion clean links atomically", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive task", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  expect(await stored(page)).toBe(before);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive task", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive item", exact: true })
    .click();
  await expect(page.locator(".task-title")).toHaveCount(4);
  await page.getByRole("button", { name: /^⌑?\s*Archive/ }).click();
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore from archive", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore item", exact: true })
    .click();
  await page.getByRole("button", { name: /^All work/ }).click();
  await notesPanel(page);
  await page.getByRole("button", { name: "Edit note", exact: false }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  const preDelete = await stored(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await stored(page)).toBe(preDelete);
  await page.getByRole("button", { name: "Edit note", exact: false }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page.reload();
  const result = JSON.parse((await stored(page))!);
  expect(result.notes).toHaveLength(2);
  expect(
    result.tasks.every(
      (t: { noteIds: string[] }) => !t.noteIds.includes("note-walk"),
    ),
  ).toBe(true);
});

test("malformed storage is protected and original recovery exports exact bytes", async ({
  page,
}, info) => {
  const corrupt = '{"version":999,"notes": "do not discard these bytes"}';
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem("test-seeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("test-seeded", "yes");
      }
    },
    { key: STORAGE_KEY, raw: corrupt },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your original notebook is protected." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ New task", exact: true }),
  ).toBeDisabled();
  expect(await stored(page)).toBe(corrupt);
  await dataMenu(page);
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export original recovery", exact: true })
    .click();
  const stream = await (await wait).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(corrupt);
  await dataMenu(page);
  await page
    .getByRole("button", { name: "Reset to empty", exact: true })
    .click();
  await page.keyboard.press("Escape");
  expect(await stored(page)).toBe(corrupt);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-recovery.png`,
    fullPage: true,
  });
  await upload(page, serialize(incoming));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace notebook", exact: true })
    .click();
  await page.reload();
  expect(JSON.parse((await stored(page))!)).toEqual(incoming);
});

test("denied storage and quota failures never claim Saved; failed replacement leaves all state intact", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "+ New note", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Memory only");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Not saved.");
  expect(await stored(page)).toBe(before);
  const inMemory = await exportContent(page);
  expect(JSON.parse(inMemory).notes).toHaveLength(4);
  await dataMenu(page);
  await page
    .getByRole("button", { name: "Reset to empty", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace notebook", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Replacement not applied",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await stored(page)).toBe(before);
  expect(await exportContent(page)).toBe(inMemory);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Storage unavailable");
  await expect(
    page.getByRole("heading", { name: "A little room to begin." }),
  ).toBeVisible();
});

test("offline shell reloads without a network and keeps saved work", async ({
  page,
  context,
}) => {
  await seed(page);
  await expect(
    page.getByText("Local workspace · offline ready", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Complete Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Reopen Walk the route before the group arrives",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Offline · offline ready", { exact: false }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("fresh demo is honest about persistence and makes no remote requests", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4183/") &&
      !request.url().startsWith("blob:")
    )
      remote.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "in memory until your first change",
  );
  expect(await stored(page)).toBeNull();
  await page
    .getByRole("button", {
      name: "Complete Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(
    page.getByRole("button", {
      name: "Reopen Walk the route before the group arrives",
      exact: true,
    }),
  ).toBeVisible();
  expect(remote).toEqual([]);
});

test("another tab cannot be silently overwritten by a stale edit", async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto("/");
  await other
    .getByRole("button", {
      name: "Complete Walk the route before the group arrives",
      exact: true,
    })
    .click();
  const newer = await stored(other);
  await expect(page.getByRole("alert")).toContainText("another tab");
  await page
    .getByRole("button", {
      name: "Complete Refine the listening prompts",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("Not saved.");
  expect(await stored(page)).toBe(newer);
  const recovered = JSON.parse(await exportContent(page));
  expect(
    recovered.tasks.find((t: { id: string }) => t.id === "task-prompts").status,
  ).toBe("done");
  // The complete in-memory candidate is exportable, including its older route status.
  expect(
    recovered.tasks.find((t: { id: string }) => t.id === "task-route").status,
  ).toBe("doing");
  await other.close();
});

test("task deletion and linked-note editing cancel cleanly and deletion persists", async ({
  page,
}, info) => {
  await seed(page);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await dialog.getByLabel("The pocket field kit", { exact: true }).uncheck();
  await dialog
    .getByRole("textbox", { name: "Details", exact: true })
    .fill("Uncommitted edits");
  const before = await stored(page);
  await page.keyboard.press("Escape");
  expect(await stored(page)).toBe(before);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Delete permanently", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-confirmation.png`,
  });
  await page.keyboard.press("Escape");
  expect(await stored(page)).toBe(before);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await stored(page)).toBe(before);
  await page
    .getByRole("button", {
      name: "Walk the route before the group arrives",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page.reload();
  const after = JSON.parse((await stored(page))!);
  expect(after.tasks).toHaveLength(4);
  expect(after.notes).toEqual(demoWorkspace().notes);
  expect(after.tasks.some((t: { id: string }) => t.id === "task-route")).toBe(
    false,
  );
});
