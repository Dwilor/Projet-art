import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createStore } from "../server/store.js";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const dir = await mkdtemp(join(tmpdir(), "sirius-room-test-"));
const servers = [];
let browser;
async function startServer(mode, port) {
  const dataDir = join(dir, mode);
  await mkdir(dataDir);
  if (mode === "live") {
    const store = createStore(join(dataDir, "sirius.sqlite"));
    store.saveSettings({
      taxDescription: "Test",
      countries: ["FR"],
      shippingCents: 1000,
      shippingDelay: "Test",
    });
    store.saveProduct({
      ...store.get("art-001"),
      title: "Original de test",
      status: "available",
      width: 40,
      height: 50,
      technique: "Test",
      support: "Test",
      price: 10000,
      stock: 1,
    });
    store.saveProduct({
      ...store.get("art-002"),
      title: "Reproduction de test",
      type: "print",
      status: "available",
      width: 30,
      height: 40,
      technique: "Test",
      support: "Test",
      variants: [
        {
          format: "Petit",
          width: 30,
          height: 40,
          price: 1000,
          stock: 2,
          paper: "Test",
          process: "Test",
          proofApproved: true,
        },
        {
          format: "Grand",
          width: 60,
          height: 80,
          price: 2000,
          stock: 3,
          paper: "Test",
          process: "Test",
          proofApproved: true,
        },
        {
          format: "Épuisé",
          width: 90,
          height: 120,
          price: 3000,
          stock: 0,
          paper: "Test",
          process: "Test",
          proofApproved: true,
        },
      ],
    });
    store.db.close();
  }
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      SITE_MODE: mode,
      DATA_DIR: dataDir,
      ADMIN_PASSWORD: randomBytes(24).toString("hex"),
      SMTP_HOST: "",
      STRIPE_SECRET_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push(child);
  let error = "";
  child.stderr.on("data", (chunk) => {
    error += chunk;
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null)
      throw new Error(`Le serveur de recette s’est arrêté : ${error}`);
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok && (await response.json()).mode === mode) return base;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Le serveur de recette ne répond pas.");
}
async function rectangle(page) {
  const photo = await page.locator(".room-stage").boundingBox();
  const art = await page.locator(".room-artwork").boundingBox();
  assert.ok(art.x >= photo.x - 1 && art.y >= photo.y - 1);
  assert.ok(
    art.x + art.width <= photo.x + photo.width + 1 &&
      art.y + art.height <= photo.y + photo.height + 1,
  );
  return {
    photo,
    art,
    x: (art.x - photo.x + art.width / 2) / photo.width,
    y: (art.y - photo.y + art.height / 2) / photo.height,
    width: art.width / photo.width,
  };
}
async function importPhoto(page, path) {
  await page
    .getByLabel("Importer une photo de mon intérieur")
    .setInputFiles(path);
  await page.locator(".room-photo").waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: "Enregistrer l’aperçu", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector(".room-result-actions .button").disabled,
  );
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
try {
  const photo = join(dir, "interieur.png");
  const oriented = join(dir, "photo-appareil.jpg");
  await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 221, g: 210, b: 191 },
    },
  })
    .png()
    .toFile(photo);
  await sharp(photo).withMetadata({ orientation: 6 }).jpeg().toFile(oriented);
  const preview = await startServer("preview", 3130);
  const live = await startServer("live", 3131);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [],
    network = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().startsWith("http")) network.push(request.method());
  });
  await mkdir("test-results", { recursive: true });
  let response = await page.goto(preview + "/chez-moi?oeuvre=art-003", {
    waitUntil: "networkidle",
  });
  assert.equal(response.status(), 200);
  assert.match(await page.locator("h1").innerText(), /chez vous/);
  assert.equal(
    await page
      .getByRole("button", { name: "Choisir ART-003, composition" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".room-work-option").count(), 5);
  assert.equal((await new AxeBuilder({ page }).analyze()).violations.length, 0);
  await page.screenshot({
    path: "test-results/room-empty-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Importer une photo de mon intérieur").setInputFiles({
    name: "incorrect.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  assert.match(await page.getByRole("alert").innerText(), /JPG/);
  await page.getByLabel("Importer une photo de mon intérieur").setInputFiles({
    name: "illisible.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("Ceci n’est pas une image"),
  });
  await page.waitForFunction(() =>
    document
      .querySelector('[role="alert"]')
      ?.textContent.includes("ne peut pas être ouverte"),
  );
  await page.getByLabel("Importer une photo de mon intérieur").setInputFiles({
    name: "trop-grande.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(21 * 1024 * 1024),
  });
  assert.match(await page.getByRole("alert").innerText(), /20 Mo/);
  await importPhoto(page, photo);
  const localPhoto = await page.locator(".room-photo").getAttribute("src");
  assert.ok(localPhoto.startsWith("blob:"));
  assert.ok(
    network.every((method) => method === "GET"),
    "Aucune photo ne doit être envoyée au serveur",
  );
  const medium = await rectangle(page);
  await page.getByRole("button", { name: "Grand", exact: true }).click();
  const large = await rectangle(page);
  assert.ok(large.width > medium.width * 1.3);
  await page.getByRole("button", { name: "Petit", exact: true }).click();
  const small = await rectangle(page);
  assert.ok(small.width < medium.width);
  assert.ok(Math.abs(small.art.width / small.art.height - 1122 / 1402) < 0.005);
  await page
    .getByRole("button", { name: "Choisir ART-005, composition" })
    .click();
  assert.equal(
    await page.locator(".room-photo").getAttribute("src"),
    localPhoto,
  );
  assert.match(
    await page.locator(".room-artwork > img").getAttribute("src"),
    /art-005/,
  );
  let start = await rectangle(page);
  await page.mouse.move(
    start.art.x + start.art.width / 2,
    start.art.y + start.art.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    start.art.x + start.art.width / 2 + 70,
    start.art.y + start.art.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  let moved = await rectangle(page);
  assert.ok(Math.abs(moved.art.x - start.art.x - 70) < 2);
  await page.mouse.move(
    moved.art.x + moved.art.width / 2,
    moved.art.y + moved.art.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    moved.photo.x + moved.photo.width + 200,
    moved.photo.y + moved.photo.height + 200,
    { steps: 5 },
  );
  await page.mouse.up();
  await rectangle(page);
  const beforeCenter = await rectangle(page);
  await page.getByRole("button", { name: "Recentrer", exact: true }).click();
  assert.ok(
    Math.abs((await rectangle(page)).width - beforeCenter.width) < 0.005,
    "Recentrer doit conserver la taille choisie",
  );
  await page.locator(".room-artwork").focus();
  start = await rectangle(page);
  await page.keyboard.press("ArrowRight");
  assert.ok((await rectangle(page)).x > start.x);
  const handle = await page.locator(".room-resize-handle").boundingBox();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 25,
    handle.y + handle.height / 2 + 25,
    { steps: 5 },
  );
  const beforeUp = await rectangle(page);
  await page.mouse.up();
  const resized = await rectangle(page);
  assert.ok(resized.width > start.width);
  assert.ok(
    Math.abs(resized.width - beforeUp.width) < 0.002,
    "Le relâchement de la poignée ne doit pas modifier la taille",
  );
  await page.getByLabel("Taille dans la photo").focus();
  await page.keyboard.press("Home");
  assert.ok((await rectangle(page)).width < resized.width);
  await page.keyboard.press("End");
  await rectangle(page);
  await page.getByRole("button", { name: "Recentrer", exact: true }).click();
  const geometry = await rectangle(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Enregistrer l’aperçu", exact: true })
      .click(),
  ]);
  const saved = await download.path();
  const metadata = await sharp(saved).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.format, "jpeg");
  const pixel = await sharp(saved)
    .extract({
      left: Math.round(geometry.x * 1200),
      top: Math.round(geometry.y * 800),
      width: 1,
      height: 1,
    })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(
    Math.abs(pixel[0] - 221) +
      Math.abs(pixel[1] - 210) +
      Math.abs(pixel[2] - 191) >
      20,
    "L’export doit inclure l’œuvre",
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    const current = await rectangle(page);
    assert.ok(
      Math.abs(current.x - geometry.x) < 0.005 &&
        Math.abs(current.width - geometry.width) < 0.005,
    );
  }
  await page.screenshot({
    path: "test-results/room-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/room-mobile.png",
    fullPage: true,
  });
  assert.equal((await new AxeBuilder({ page }).analyze()).violations.length, 0);
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  assert.equal(await page.locator(".room-photo").count(), 0);
  assert.equal(
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return true;
      } catch {
        return false;
      }
    }, localPhoto),
    false,
    "L’URL de la photo doit être libérée",
  );
  await importPhoto(page, oriented);
  assert.equal(
    await page
      .locator(".room-photo")
      .evaluate((image) => image.naturalWidth / image.naturalHeight),
    800 / 1200,
  );
  assert.ok(network.every((method) => method === "GET"));
  assert.deepEqual(errors, []);
  console.log(
    "Desktop : import privé, validation, sélection, formats, glisser, poignée, clavier, export, EXIF et responsive validés.",
  );

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touch = await mobile.newPage();
  await touch.goto(preview + "/chez-moi", { waitUntil: "networkidle" });
  await importPhoto(touch, photo);
  await touch.locator(".room-artwork").scrollIntoViewIfNeeded();
  const before = await rectangle(touch);
  const cdp = await mobile.newCDPSession(touch);
  const point = {
    x: before.art.x + before.art.width / 2,
    y: before.art.y + before.art.height / 2,
    id: 1,
  };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, x: point.x + 40, y: point.y + 18 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await rectangle(touch)).art.x > before.art.x + 25);
  const touchBeforeResize = await rectangle(touch);
  const touchHandle = await touch.locator(".room-resize-handle").boundingBox();
  const resizePoint = {
    x: touchHandle.x + touchHandle.width / 2,
    y: touchHandle.y + touchHandle.height / 2,
    id: 2,
  };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [resizePoint],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { ...resizePoint, x: resizePoint.x + 20, y: resizePoint.y + 20 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await rectangle(touch)).width > touchBeforeResize.width * 1.1);
  await noOverflow(touch);
  await mobile.close();
  console.log("Mobile : déplacement et redimensionnement tactiles validés.");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(live + "/chez-moi?oeuvre=art-002&format=Grand", {
    waitUntil: "networkidle",
  });
  assert.equal(await page.locator(".room-work-option").count(), 2);
  assert.equal(
    await page
      .getByRole("button", { name: /Choisir Reproduction de test/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page
      .getByRole("button", { name: /Grand.*60/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.getByRole("button", { name: /Épuisé/ }).count(), 0);
  await importPhoto(page, photo);
  const big = await rectangle(page);
  await page.getByRole("button", { name: /Petit.*30/ }).click();
  const little = await rectangle(page);
  assert.ok(Math.abs(big.width / little.width - 2) < 0.03);
  assert.ok(Math.abs(little.art.width / little.art.height - 0.75) < 0.005);
  await page.goto(live + "/originaux/art-001", { waitUntil: "networkidle" });
  await page
    .getByRole("link", { name: "Voir l’œuvre chez moi", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: /Choisir Original de test/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".room-formats button").count(), 1);
  console.log(
    "Catalogue publié : formats réels, stocks, présélection et entrée depuis une fiche validés.",
  );
} finally {
  if (browser) await browser.close();
  for (const child of servers) {
    if (child.exitCode === null) {
      const ended = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await ended;
    }
  }
  await rm(dir, { recursive: true, force: true });
}
