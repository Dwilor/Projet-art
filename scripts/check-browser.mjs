import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const dir = await mkdtemp(join(tmpdir(), "sirius-e2e-"));
const password = randomBytes(24).toString("hex");
const server = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    PORT: "3100",
    DATA_DIR: dir,
    ADMIN_PASSWORD: password,
    NODE_ENV: "production",
    SITE_MODE: "preview",
    SMTP_HOST: "",
    STRIPE_SECRET_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverError = "";
server.stderr.on("data", (c) => {
  serverError += c;
});
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3100/api/health");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
    if (i === 79) throw new Error(`Serveur indisponible : ${serverError}`);
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("test-results", { recursive: true });
  await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  assert.match(await page.locator("h1").innerText(), /La matière/);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ["Latin Modern Roman", "Nimbus Sans", "Nimbus Sans Narrow"].map(
      (font) => document.fonts.check(`16px "${font}"`),
    );
  });
  assert.ok(fonts.every(Boolean));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "test-results/desktop-hero.png" });
  for (const el of await page.locator("section").all()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  let checks = 0;
  const routes = [
    "/",
    "/originaux",
    "/reproductions",
    "/originaux/art-001",
    "/reproductions/art-002",
    "/a-propos",
    "/contact",
    "/panier",
    "/commande",
    "/commande/resultat",
    "/livraison-retours",
    "/mentions-legales",
    "/cgv",
    "/confidentialite",
    "/admin",
  ];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const response = await page.goto(`http://127.0.0.1:3100${route}`, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator("h1").count(), 1, `H1 ${route}`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Débordement ${route} ${viewport.width}`,
      );
      checks++;
    }
  }
  console.log(`${checks} rendus de pages vérifiés à 360, 390, 768 et 1440 px.`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3100/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Ouvrir le menu" })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: /Originaux/ })
    .click();
  await page.waitForURL("**/originaux");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Disponibles", exact: true }).click();
  await page
    .getByRole("heading", { name: "Les œuvres se préparent." })
    .waitFor();
  await page.getByRole("button", { name: "Voir toutes les œuvres" }).click();
  assert.equal(await page.locator(".work-card").count(), 5);
  await page
    .getByRole("link", { name: "Découvrir ART-001", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agrandir la vue complète", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  const dimensions = await page
    .locator(".detail-main img")
    .evaluate((img) => ({ w: img.clientWidth, h: img.clientHeight }));
  assert.ok(Math.abs(dimensions.w / dimensions.h - 1122 / 1402) < 0.01);
  await page.getByRole("link", { name: "Me poser une question" }).click();
  await page.waitForURL("**/contact?oeuvre=ART-001");
  assert.equal(
    await page.getByLabel("Sujet", { exact: true }).inputValue(),
    "À propos de ART-001",
  );
  await page.getByRole("button", { name: "Envoyer mon message" }).click();
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 3);
  await page.getByLabel("Votre nom", { exact: true }).fill("Visiteur test");
  await page
    .getByLabel("Votre adresse e-mail", { exact: true })
    .fill("visiteur@example.com");
  await page
    .getByLabel("Votre message", { exact: true })
    .fill("Bonjour, je souhaite en savoir plus sur cette composition.");
  await page.getByRole("button", { name: "Envoyer mon message" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /demande a été enregistrée/ })
    .waitFor();
  console.log("Menu, focus, filtre, zoom, ratios et formulaire vérifiés.");
  for (const route of [
    "/",
    "/originaux",
    "/originaux/art-001",
    "/contact",
    "/panier",
  ]) {
    await page.goto(`http://127.0.0.1:3100${route}`, {
      waitUntil: "networkidle",
    });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.equal(
      result.violations.length,
      0,
      `Accessibilité ${route}: ${result.violations.map((v) => v.id + " " + v.nodes.map((n) => n.target).join(",")).join("\n")}`,
    );
  }
  console.log(
    "Audit axe : aucune violation détectée sur 5 pages représentatives.",
  );
  await page.goto("http://127.0.0.1:3100/admin");
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("button", { name: "Messages", exact: true }).waitFor();
  await page.getByRole("button", { name: "Messages", exact: true }).click();
  await page
    .getByRole("cell")
    .filter({ hasText: "visiteur@example.com" })
    .waitFor();
  await page.getByRole("button", { name: "Œuvres", exact: true }).click();
  await page
    .getByLabel("Publication", { exact: true })
    .selectOption("available");
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /titre est obligatoire/ })
    .waitFor();
  await page.getByLabel("Publication", { exact: true }).selectOption("draft");
  await page
    .getByLabel("Titre public", { exact: true })
    .fill("Titre de recette");
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /ont été enregistrées/ })
    .waitFor();
  const catalog = await (
    await fetch("http://127.0.0.1:3100/api/catalog")
  ).json();
  assert.ok(!catalog.products.some((p) => p.title === "Titre de recette"));
  await page.getByRole("button", { name: "Médias", exact: true }).click();
  await page
    .getByLabel("Image (PNG, JPEG, WebP, AVIF · 20 Mo maximum)", {
      exact: true,
    })
    .setInputFiles("public/images/art-001.png");
  await page
    .getByLabel("Description de l’image", { exact: true })
    .fill("Visuel de recette importé depuis la composition fournie.");
  await page.getByRole("button", { name: "Importer l’image" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /versions web préparées/ })
    .waitFor();
  assert.equal(await page.locator(".admin-media-grid figure").count(), 6);
  console.log(
    "Import d’image et génération des versions responsives vérifiés.",
  );
  const adminHeaders = { "X-Sirius-Request": "admin" };
  const admin = await (
    await page.request.get("http://127.0.0.1:3100/api/admin/data")
  ).json();
  const settingsResponse = await page.request.put(
    "http://127.0.0.1:3100/api/admin/settings",
    {
      headers: adminHeaders,
      data: {
        ...admin.settings,
        countries: ["FR"],
        shippingCents: 900,
        shippingDelay: "Délai de recette",
        taxDescription: "Prix de recette TTC",
      },
    },
  );
  assert.ok(settingsResponse.ok());
  const original = {
    ...admin.products[0],
    title: "Œuvre de recette",
    status: "available",
    technique: "Technique de recette",
    support: "Support de recette",
    width: 30,
    height: 40,
    price: 12000,
    stock: 1,
  };
  assert.ok(
    (
      await page.request.put(
        `http://127.0.0.1:3100/api/admin/products/${original.id}`,
        { headers: adminHeaders, data: original },
      )
    ).ok(),
  );
  const print = {
    ...admin.products[1],
    type: "print",
    title: "Reproduction de recette",
    status: "available",
    technique: "Technique de recette",
    support: "Papier de recette",
    width: 29.7,
    height: 42,
    variants: [
      {
        format: "A3",
        price: 4900,
        stock: 5,
        paper: "Papier de recette",
        process: "Procédé de recette",
        width: 29.7,
        height: 42,
        proofApproved: true,
      },
      {
        format: "A2",
        price: 7900,
        stock: 3,
        paper: "Papier de recette",
        process: "Procédé de recette",
        width: 42,
        height: 59.4,
        proofApproved: true,
      },
    ],
  };
  assert.ok(
    (
      await page.request.put(
        `http://127.0.0.1:3100/api/admin/products/${print.id}`,
        { headers: adminHeaders, data: print },
      )
    ).ok(),
  );
  await page.goto("http://127.0.0.1:3100/originaux/art-001", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page
    .getByRole("link", { name: "Panier, 1 article(s)", exact: true })
    .click();
  await page.locator(".cart-item").waitFor();
  assert.equal(await page.locator(".cart-item").count(), 1);
  assert.equal(
    await page
      .getByLabel("Quantité pour Œuvre de recette", { exact: true })
      .count(),
    0,
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".cart-item").waitFor();
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await page.getByRole("heading", { name: /Une place pour vos/ }).waitFor();
  await page.goto("http://127.0.0.1:3100/reproductions/art-002", {
    waitUntil: "networkidle",
  });
  assert.ok(
    await page
      .getByRole("button", { name: "Choisir un format", exact: true })
      .isDisabled(),
  );
  await page.getByRole("button", { name: /A3/ }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page
    .getByRole("link", { name: "Panier, 1 article(s)", exact: true })
    .click();
  await page
    .getByLabel("Quantité pour Reproduction de recette", { exact: true })
    .fill("2");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page
      .getByLabel("Quantité pour Reproduction de recette", { exact: true })
      .inputValue(),
    "2",
  );
  assert.ok(
    await page
      .locator(".cart-item")
      .innerText()
      .then((t) => t.includes("A3")),
  );
  await page.getByRole("link", { name: "Poursuivre la commande" }).click();
  await page.getByRole("heading", { name: "La vente se prépare." }).waitFor();
  await page.goto("http://127.0.0.1:3100/panier", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  for (const p of [original, print])
    assert.ok(
      (
        await page.request.put(
          `http://127.0.0.1:3100/api/admin/products/${p.id}`,
          { headers: adminHeaders, data: { ...p, status: "draft", title: "" } },
        )
      ).ok(),
    );
  await page.goto("http://127.0.0.1:3100/admin", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Se déconnecter" }).waitFor();
  console.log(
    "Panier persistant, original limité à 1, choix explicite de variante, quantité et blocage de paiement vérifiés avec des données de recette isolées.",
  );
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByRole("button", { name: "Se connecter" }).waitFor();
  const secret = await fetch("http://127.0.0.1:3100/api/admin/data");
  assert.equal(secret.status, 401);
  const order = await fetch(
    "http://127.0.0.1:3100/api/orders/inconnue?token=invalide",
  );
  assert.equal(order.status, 404);
  console.log(
    "Administration, enregistrement, brouillons invisibles et accès privés vérifiés.",
  );
  await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  for (const el of await page.locator("section").all()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "Aucune erreur JavaScript");
  console.log("Recette navigateur terminée sans erreur JavaScript.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
  await rm(dir, { recursive: true, force: true });
}
