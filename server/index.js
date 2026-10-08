import express from "express";
import { createServer as createViteServer } from "vite";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, timingSafeEqual, scryptSync } from "node:crypto";
import sharp from "sharp";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { z } from "zod";
import { createStore } from "./store.js";
import { works } from "../src/content.js";
const root = resolve(import.meta.dirname, "..");
const production = process.env.NODE_ENV === "production";
const mode = process.env.SITE_MODE === "live" ? "live" : "preview";
const dataDir = process.env.DATA_DIR || resolve(root, ".data");
mkdirSync(dataDir, { recursive: true });
const mediaDir = resolve(dataDir, "media");
mkdirSync(mediaDir, { recursive: true });
const store = createStore(resolve(dataDir, "sirius.sqlite"));
const app = express();
app.disable("x-powered-by");
const sessions = new Map(),
  rates = new Map();
const passwordPath = resolve(dataDir, "admin-password");
if (!process.env.ADMIN_PASSWORD && !existsSync(passwordPath))
  writeFileSync(passwordPath, randomBytes(24).toString("base64url"), {
    mode: 0o600,
  });
const adminPassword =
  process.env.ADMIN_PASSWORD || readFileSync(passwordPath, "utf8").trim();
const passwordHash = scryptSync(adminPassword, "sirius-admin-v1", 64);
const smtp =
  process.env.SMTP_HOST && process.env.CONTACT_EMAIL
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASSWORD
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        requireTLS: process.env.SMTP_SECURE !== "true",
      })
    : null;
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const candidate = new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  });
  try {
    const balance = await candidate.balance.retrieve();
    if (balance.livemode === false) stripe = candidate;
    else
      console.error(
        "Les paiements réels restent désactivés : utilisez un compte de test.",
      );
  } catch {
    console.error("Le compte de paiement de test n’a pas pu être vérifié.");
  }
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (mode === "preview" || /^\/(panier|commande|admin)/.test(req.path))
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
  (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET)
      return res.status(503).json({ error: "Paiement non configuré." });
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      const session = event.data.object;
      if (
        event.type === "checkout.session.completed" &&
        session.payment_status === "paid"
      )
        store.complete(
          event.id,
          session.metadata.orderId,
          session.amount_total,
          session.currency,
          session.id,
        );
      if (event.type === "checkout.session.expired")
        store.release(session.metadata.orderId, "expired");
      res.json({ received: true });
    } catch {
      console.error("Notification de paiement rejetée ou incohérente.");
      res.status(400).json({ error: "Notification non validée." });
    }
  },
);
app.use(express.json({ limit: "128kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return res.status(403).json({ error: "Origine non autorisée." });
    } catch {
      return res.status(403).json({ error: "Origine non autorisée." });
    }
  }
  next();
});
function rate(limit, minutes) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`,
      now = Date.now();
    let record = rates.get(key);
    if (!record || record.until < now)
      record = { count: 0, until: now + minutes * 60000 };
    record.count++;
    rates.set(key, record);
    if (record.count > limit)
      return res
        .status(429)
        .json({ error: "Trop de tentatives. Réessayez un peu plus tard." });
    next();
  };
}
function requireAdmin(req, res, next) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sirius_admin="))
    ?.slice(13);
  const session = sessions.get(cookie);
  if (!session || session.expires < Date.now())
    return res
      .status(401)
      .json({ error: "Connectez-vous pour accéder à l’atelier." });
  if (req.method !== "GET" && req.get("X-Sirius-Request") !== "admin")
    return res.status(403).json({ error: "Requête non autorisée." });
  next();
}
const mediaList = () =>
  store.db
    .prepare("SELECT data FROM media")
    .all()
    .map((m) => JSON.parse(m.data));
function publicData() {
  const settings = store.settings();
  return {
    mode,
    media: mediaList().filter((m) =>
      store
        .list()
        .some(
          (p) =>
            p.image === m.image && !["draft", "archived"].includes(p.status),
        ),
    ),
    products: store
      .list()
      .filter((p) => !["draft", "archived"].includes(p.status)),
    settings: {
      sellerEmail: settings.sellerEmail,
      sellerName: settings.sellerName,
      sellerAddress: settings.sellerAddress,
      commerceEnabled: settings.commerceEnabled && !!stripe,
      countries: settings.countries,
      shippingCents: settings.shippingCents,
      shippingDelay: settings.shippingDelay,
      taxDescription: settings.taxDescription,
      terms: settings.terms,
      privacy: settings.privacy,
      legal: settings.legal,
      aboutText: settings.aboutText || "",
    },
  };
}
app.get("/api/health", (_req, res) => res.json({ status: "ok", mode }));
app.get("/api/catalog", (_req, res) => res.json(publicData()));
const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
  reference: z.string().max(100).nullable().optional(),
  website: z.string().max(200).optional(),
});
async function sendContact(contact) {
  if (!smtp) throw new Error("La messagerie n’est pas encore configurée.");
  const info = await smtp.sendMail({
    from: process.env.EMAIL_FROM || process.env.CONTACT_EMAIL,
    to: process.env.CONTACT_EMAIL,
    replyTo: contact.email,
    subject: `Sirius — ${contact.subject}`,
    text: `Nom : ${contact.name}\nE-mail : ${contact.email}\nRéférence : ${contact.reference || "—"}\n\n${contact.message}`,
  });
  if (!info.accepted?.length)
    throw new Error("La messagerie n’a pas accepté le message.");
}
app.post("/api/contact", rate(5, 15), async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "Vérifiez votre nom, votre e-mail, le sujet et le message.",
    });
  if (parsed.data.website)
    return res
      .status(400)
      .json({ error: "Le message n’a pas pu être envoyé." });
  const { website, ...contact } = parsed.data;
  const id = randomBytes(16).toString("hex");
  store.db
    .prepare("INSERT INTO contacts VALUES (?,?,?,?)")
    .run(id, JSON.stringify(contact), new Date().toISOString(), "queued");
  if (!smtp)
    return res.status(202).json({
      sent: false,
      message:
        "Votre demande a été enregistrée dans l’atelier. L’envoi par e-mail n’est pas encore disponible.",
    });
  try {
    await sendContact(contact);
    store.db.prepare("UPDATE contacts SET delivery='sent' WHERE id=?").run(id);
    res.json({
      sent: true,
      message: "Votre message a bien été envoyé. Merci pour votre message.",
    });
  } catch {
    store.db
      .prepare("UPDATE contacts SET delivery='failed' WHERE id=?")
      .run(id);
    res.status(502).json({
      error:
        "Le message n’a pas pu être envoyé. Réessayez ou contactez-moi à l’adresse indiquée.",
    });
  }
});
const checkoutSchema = z.object({
  expectedTotal: z.number().int().positive(),
  lines: z
    .array(
      z.object({
        id: z.string().max(100),
        variant: z.string().max(100),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
  address: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.email().max(254),
    street: z.string().trim().min(1).max(250),
    postalCode: z.string().trim().min(1).max(30),
    city: z.string().trim().min(1).max(200),
    country: z.string().regex(/^[A-Z]{2}$/),
    terms: z.literal("on"),
  }),
});
app.post("/api/checkout", rate(10, 15), async (req, res) => {
  if (!stripe)
    return res.status(503).json({
      error:
        "La vente n’est pas encore ouverte. Vous pouvez me contacter à propos de votre sélection.",
    });
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error:
        "Vérifiez votre panier, vos coordonnées et les conditions de vente.",
    });
  let order;
  try {
    order = store.reserve(
      parsed.data.lines,
      parsed.data.address,
      Date.now(),
      parsed.data.expectedTotal,
    );
    const base = process.env.SITE_URL;
    if (!base || !/^https?:\/\//.test(base))
      throw new Error("L’adresse de retour du paiement n’est pas configurée.");
    const lineItems = order.lines.map((l) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: `${l.title}${l.variant ? ` — ${l.variant}` : ""}`,
        },
        unit_amount: l.price,
      },
      quantity: l.quantity,
    }));
    if (order.shipping)
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Livraison" },
          unit_amount: order.shipping,
        },
        quantity: 1,
      });
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: order.address.email,
        line_items: lineItems,
        metadata: { orderId: order.id },
        expires_at: Math.floor(order.expiresAt / 1000),
        success_url: `${base}/commande/resultat?id=${order.id}&token=${order.token}`,
        cancel_url: `${base}/commande/resultat?id=${order.id}&token=${order.token}&annule=1`,
      },
      { idempotencyKey: order.id },
    );
    store.db
      .prepare("UPDATE orders SET session_id=? WHERE id=?")
      .run(session.id, order.id);
    res.json({ url: session.url });
  } catch (e) {
    if (order) store.release(order.id);
    res.status(400).json({
      error: e.type
        ? "Le paiement n’a pas pu être préparé. Réessayez."
        : e.message,
    });
  }
});
app.get("/api/orders/:id", (req, res) => {
  store.expire();
  const row = store.db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(req.params.id);
  if (
    !row ||
    typeof req.query.token !== "string" ||
    !safeEqual(req.query.token, row.token)
  )
    return res.status(404).json({ error: "Commande introuvable." });
  res.json({ id: row.id, status: row.status, ...JSON.parse(row.data) });
});
app.post("/api/orders/:id/cancel", rate(10, 15), async (req, res) => {
  const row = store.db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(req.params.id);
  if (
    !row ||
    typeof req.body.token !== "string" ||
    !safeEqual(req.body.token, row.token)
  )
    return res.status(404).json({ error: "Commande introuvable." });
  if (row.status !== "pending") return res.json({ ok: true });
  if (!stripe || !row.session_id)
    return res
      .status(503)
      .json({ error: "La réservation sera libérée à son expiration." });
  try {
    await stripe.checkout.sessions.expire(row.session_id);
    store.release(row.id);
    res.json({ ok: true });
  } catch {
    res.status(409).json({
      error:
        "Le paiement est en cours de vérification. La réservation reste protégée.",
    });
  }
});
function safeEqual(a, b) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
app.post("/api/admin/login", rate(8, 15), (req, res) => {
  const password =
    typeof req.body.password === "string" ? req.body.password : "";
  if (
    password.length > 200 ||
    !timingSafeEqual(scryptSync(password, "sirius-admin-v1", 64), passwordHash)
  )
    return res.status(401).json({ error: "Mot de passe incorrect." });
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { expires: Date.now() + 8 * 3600000 });
  res.setHeader(
    "Set-Cookie",
    `sirius_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${process.env.COOKIE_SECURE === "true" || process.env.SITE_URL?.startsWith("https://") ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});
app.use("/api/admin", requireAdmin);
app.post("/api/admin/logout", (req, res) => {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sirius_admin="))
    ?.slice(13);
  sessions.delete(cookie);
  res.setHeader(
    "Set-Cookie",
    "sirius_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0",
  );
  res.json({ ok: true });
});
function adminData() {
  return {
    media: mediaList(),
    products: store.list(),
    settings: store.settings(),
    contacts: store.db
      .prepare("SELECT * FROM contacts ORDER BY created_at DESC")
      .all()
      .map((c) => ({ ...c, data: JSON.parse(c.data) })),
    orders: store.db
      .prepare("SELECT id,data,status FROM orders ORDER BY expires_at DESC")
      .all()
      .map((o) => ({ ...o, data: JSON.parse(o.data) })),
  };
}
app.get("/api/admin/data", (_req, res) => res.json(adminData()));
const productSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/),
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  reference: z.string().max(100),
  title: z.string().max(200),
  image: z.string().regex(/^(art-00[1-5]|media-[a-f0-9]{24})$/),
  type: z.enum(["original", "print"]),
  description: z.string().max(5000),
  status: z.enum([
    "draft",
    "informative",
    "available",
    "reserved",
    "sold",
    "archived",
  ]),
  technique: z.string().max(250),
  support: z.string().max(250),
  year: z.union([z.string().max(20), z.number()]),
  width: z.union([z.string().max(10), z.number(), z.null()]),
  height: z.union([z.string().max(10), z.number(), z.null()]),
  price: z.number().int().nonnegative().nullable(),
  stock: z.number().int().min(0).max(10000),
  variants: z
    .array(
      z.object({
        format: z.string().max(50),
        paper: z.string().max(250),
        process: z.string().max(250),
        price: z.number().int().nonnegative().nullable(),
        stock: z.number().int().nonnegative().max(10000),
        width: z.number().nullable(),
        height: z.number().nullable(),
        proofApproved: z.boolean(),
      }),
    )
    .max(10),
  featured: z.boolean().optional(),
});
app.put("/api/admin/products/:id", (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.id !== req.params.id)
    return res.status(400).json({ error: "Vérifiez les champs de la fiche." });
  const p = parsed.data;
  if (p.type === "original" && p.stock > 1)
    return res
      .status(400)
      .json({ error: "Un original est une pièce unique : stock maximal 1." });
  if (
    store
      .list()
      .some(
        (other) =>
          other.id !== p.id && other.slug === p.slug && other.type === p.type,
      )
  )
    return res.status(400).json({ error: "Cette adresse est déjà utilisée." });
  if (p.status !== "draft" && p.status !== "archived") {
    const errors = store.publicationErrors(p);
    if (errors.length)
      return res.status(400).json({ error: errors.join("\n") });
  }
  const base = [...works, ...mediaList()].find((w) => w.image === p.image);
  if (!base)
    return res.status(400).json({ error: "Choisissez un média existant." });
  store.saveProduct({ ...p, alt: base.alt });
  res.json({ ok: true });
});
const settingsSchema = z.object({
  commerceEnabled: z.boolean(),
  sellerName: z.string().max(200),
  sellerAddress: z.string().max(1000),
  sellerEmail: z.union([z.email(), z.literal("")]),
  taxDescription: z.string().max(500),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(100),
  shippingCents: z.number().int().nonnegative().nullable(),
  shippingDelay: z.string().max(1000),
  terms: z.string().max(15000),
  privacy: z.string().max(15000),
  legal: z.string().max(15000),
  aboutText: z.string().max(15000).optional(),
});
app.put("/api/admin/settings", (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error:
        "Vérifiez les paramètres : pays ISO, montants en centimes, adresse e-mail.",
    });
  const s = parsed.data;
  if (
    s.commerceEnabled &&
    (!s.sellerName ||
      !s.sellerAddress ||
      !s.sellerEmail ||
      !s.taxDescription ||
      !s.countries.length ||
      !Number.isSafeInteger(s.shippingCents) ||
      !s.shippingDelay ||
      !s.terms ||
      !s.privacy ||
      !s.legal ||
      !stripe)
  )
    return res.status(400).json({
      error:
        "Complétez les informations légales, les taxes et la livraison, et configurez un compte Stripe en mode test avant d’activer la vente.",
    });
  store.saveSettings(s);
  res.json({ ok: true });
});
app.post("/api/admin/contacts/:id/retry", async (req, res) => {
  const row = store.db
    .prepare("SELECT * FROM contacts WHERE id=?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Message introuvable." });
  try {
    await sendContact(JSON.parse(row.data));
    store.db
      .prepare("UPDATE contacts SET delivery='sent' WHERE id=?")
      .run(row.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});
app.post(
  "/api/admin/media",
  express.raw({ type: "multipart/form-data", limit: "20mb" }),
  async (req, res) => {
    try {
      const form = await new Request("https://sirius.invalid", {
        method: "POST",
        headers: { "Content-Type": req.get("Content-Type") },
        body: req.body,
      }).formData();
      const file = form.get("image"),
        alt = form.get("alt");
      if (
        !file ||
        typeof file.arrayBuffer !== "function" ||
        typeof alt !== "string" ||
        !alt.trim() ||
        alt.length > 500
      )
        return res
          .status(400)
          .json({ error: "Choisissez une image et décrivez-la." });
      const buffer = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(buffer, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if (
        !["png", "jpeg", "webp", "avif"].includes(meta.format) ||
        (meta.pages || 1) > 1
      )
        throw new Error("Format non pris en charge.");
      const id = `media-${randomBytes(12).toString("hex")}`;
      for (const width of [480, 800, 1122])
        await sharp(buffer)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(resolve(mediaDir, `${id}-${width}.webp`));
      const info = await sharp(buffer)
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toFile(resolve(mediaDir, `${id}.png`));
      const media = {
        id,
        image: id,
        reference: "",
        alt: alt.trim(),
        pixelsWidth: info.width,
        pixelsHeight: info.height,
      };
      store.db
        .prepare("INSERT INTO media VALUES (?,?)")
        .run(id, JSON.stringify(media));
      store.audit("media.uploaded", id);
      res.json({ ok: true, media });
    } catch {
      res.status(400).json({
        error:
          "L’image n’a pas pu être importée. Utilisez un fichier PNG, JPEG, WebP ou AVIF de moins de 20 Mo.",
      });
    }
  },
);
app.post("/api/admin/orders/:id/ship", (req, res) => {
  if (
    typeof req.body.tracking !== "string" ||
    req.body.tracking.length < 3 ||
    req.body.tracking.length > 500
  )
    return res
      .status(400)
      .json({ error: "Indiquez une référence ou un lien de suivi." });
  try {
    store.shipment(req.params.id, req.body.tracking);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.post("/api/admin/orders/:id/refund", async (req, res) => {
  if (!stripe)
    return res.status(503).json({ error: "Paiement de test non configuré." });
  const row = store.db
    .prepare("SELECT * FROM orders WHERE id=?")
    .get(req.params.id);
  if (!row || !["paid", "shipped"].includes(row.status) || !row.session_id)
    return res.status(400).json({ error: "Commande non remboursable." });
  if (typeof req.body.returnToStock !== "boolean")
    return res
      .status(400)
      .json({ error: "Précisez si la pièce retournée a été contrôlée." });
  try {
    const session = await stripe.checkout.sessions.retrieve(row.session_id);
    const refund = await stripe.refunds.create(
      { payment_intent: session.payment_intent },
      { idempotencyKey: `refund-${row.id}` },
    );
    if (refund.status !== "succeeded")
      return res.status(409).json({
        error:
          "Le remboursement n’est pas encore confirmé. Vérifiez son état chez le prestataire avant de réessayer.",
      });
    store.refunded(row.id, req.body.returnToStock);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Le remboursement n’a pas été confirmé." });
  }
});
app.get("/api/admin/export/:kind", (req, res) => {
  const data = adminData();
  if (!["products", "contacts", "orders"].includes(req.params.kind))
    return res.status(404).json({ error: "Export introuvable." });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="sirius-${req.params.kind}.json"`,
  );
  res.json(data[req.params.kind]);
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Route inconnue." }),
);
app.get("/robots.txt", (_req, res) =>
  res
    .type("text")
    .send(
      mode === "preview"
        ? "User-agent: *\nDisallow: /\n"
        : "User-agent: *\nDisallow: /admin\nDisallow: /panier\nDisallow: /commande\nDisallow: /api\n",
    ),
);
app.get("/sitemap.xml", (_req, res) => {
  if (mode === "preview" || !process.env.SITE_URL)
    return res
      .type("xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
      );
  const base = process.env.SITE_URL.replace(/\/$/, "");
  const routes = [
    "/",
    "/originaux",
    "/reproductions",
    "/a-propos",
    "/contact",
    "/livraison-retours",
    ...publicData().products.map(
      (p) => `/${p.type === "print" ? "reproductions" : "originaux"}/${p.slug}`,
    ),
  ];
  res
    .type("xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((p) => `<url><loc>${escapeHtml(base + p)}</loc></url>`).join("")}</urlset>`,
    );
});
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
let vite;
if (!production) {
  vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
} else {
  app.use(
    "/assets",
    express.static(resolve(root, "dist/client/assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(express.static(resolve(root, "dist/client"), { index: false }));
}
app.use(
  "/media",
  express.static(mediaDir, { index: false, maxAge: "1y", immutable: true }),
);
app.use(
  express.static(resolve(root, "public"), {
    index: false,
    maxAge: production ? "1d" : 0,
  }),
);
app.use(async (req, res, next) => {
  if (req.method !== "GET") return next();
  try {
    let template = readFileSync(
      resolve(root, production ? "dist/client/index.html" : "index.html"),
      "utf8",
    );
    if (vite)
      template = await vite.transformIndexHtml(req.originalUrl, template);
    const { render } = vite
      ? await vite.ssrLoadModule("/src/entry-server.jsx")
      : await import("../dist/server/entry-server.js");
    const data = publicData();
    const path = req.path;
    const titles = {
      "/": "Sirius — La matière, en équilibre.",
      "/originaux": "Œuvres originales — Sirius",
      "/reproductions": "Reproductions — Sirius",
      "/a-propos": "À propos — Sirius",
      "/contact": "Me contacter — Sirius",
      "/panier": "Votre panier — Sirius",
      "/commande": "Commande — Sirius",
      "/commande/resultat": "Votre commande — Sirius",
      "/livraison-retours": "Livraison et retours — Sirius",
      "/mentions-legales": "Mentions légales — Sirius",
      "/cgv": "Conditions de vente — Sirius",
      "/confidentialite": "Confidentialité — Sirius",
      "/admin": "L’atelier — Sirius",
    };
    const product = data.products.find(
      (p) =>
        path ===
        `/${p.type === "print" ? "reproductions" : "originaux"}/${p.slug}`,
    );
    const previewWork =
      mode === "preview" &&
      works.some(
        (w) =>
          path === `/originaux/${w.id}` || path === `/reproductions/${w.id}`,
      );
    const valid = !!titles[path] || !!product || previewWork;
    const title = titles[path] || product?.title + " — Sirius";
    const robots =
      mode === "preview" || /^\/(panier|commande|admin)/.test(path)
        ? '<meta name="robots" content="noindex,nofollow"/>'
        : "";
    const canonical = process.env.SITE_URL
      ? `<link rel="canonical" href="${escapeHtml(process.env.SITE_URL.replace(/\/$/, "") + path)}"/>`
      : "";
    const head = `<title>${escapeHtml(valid ? (title === "undefined — Sirius" ? "Composition — Sirius" : title) : "Page introuvable — Sirius")}</title><meta name="description" content="Découvrez les peintures abstraites de Sirius. Un dialogue entre les formes, les couleurs et la matière. Originaux, reproductions et démarche artistique."/>${robots}${canonical}`;
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const html = template
      .replace("<!--head-->", head)
      .replace("<!--app-->", render(req.originalUrl, data))
      .replace("<!--data-->", json);
    res
      .status(valid ? 200 : 404)
      .type("html")
      .send(html);
  } catch (e) {
    if (vite) vite.ssrFixStacktrace(e);
    console.error(e.message);
    res.status(500).type("text").send("Une erreur est survenue. Réessayez.");
  }
});
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError || err.type === "entity.too.large")
    return res.status(400).json({ error: "Requête invalide." });
  console.error("Erreur serveur.");
  res.status(500).json({ error: "Une erreur est survenue." });
});
let mailBusy = false;
async function sendOutbox() {
  if (!smtp || mailBusy) return;
  mailBusy = true;
  try {
    for (const row of store.db
      .prepare(
        "SELECT * FROM outbox WHERE status!='sent' AND attempts<5 LIMIT 20",
      )
      .all()) {
      const { kind, to, order } = JSON.parse(row.data);
      const labels = {
        confirmation: "Votre commande est confirmée",
        seller: "Une commande a été payée",
        shipment: "Votre commande a été expédiée",
        refund: "Votre remboursement est confirmé",
      };
      try {
        const info = await smtp.sendMail({
          from: process.env.EMAIL_FROM || process.env.CONTACT_EMAIL,
          to,
          subject: `Sirius — ${labels[kind]}`,
          text: `${labels[kind]}.\nRéférence : ${order.id}\n\n${order.lines.map((l) => `${l.title} ${l.variant} × ${l.quantity} — ${((l.price * l.quantity) / 100).toFixed(2)} EUR`).join("\n")}\n\nTotal : ${(order.total / 100).toFixed(2)} EUR\nLivraison : ${(order.shipping / 100).toFixed(2)} EUR\n${order.address.street}, ${order.address.postalCode} ${order.address.city}, ${order.address.country}\n${order.tracking ? `Suivi : ${order.tracking}` : ""}`,
        });
        if (!info.accepted?.length) throw new Error();
        store.db
          .prepare(
            "UPDATE outbox SET status='sent',attempts=attempts+1 WHERE id=?",
          )
          .run(row.id);
      } catch {
        store.db
          .prepare(
            "UPDATE outbox SET status='failed',attempts=attempts+1 WHERE id=?",
          )
          .run(row.id);
      }
    }
  } finally {
    mailBusy = false;
  }
}
const timer = setInterval(() => {
  store.expire();
  sendOutbox();
  const now = Date.now();
  for (const [key, value] of rates) if (value.until < now) rates.delete(key);
  for (const [key, value] of sessions)
    if (value.expires < now) sessions.delete(key);
}, 60000);
timer.unref();
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", (error) => {
  if (error) {
    console.error("Le serveur n’a pas pu ouvrir le port demandé.");
    process.exit(1);
  }
  console.log(
    `Sirius démarré — port ${process.env.PORT || 3000}, mode ${mode}.`,
  );
});
