import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { works } from "../src/content.js";
export function createStore(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL, delivery TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, token TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, session_id TEXT, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS reservations (order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL, variant TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, ref TEXT, created_at TEXT NOT NULL);
 `);
  for (const w of works)
    db.prepare("INSERT OR IGNORE INTO products VALUES (?,?)").run(
      w.id,
      JSON.stringify({
        ...w,
        slug: w.id,
        title: "",
        type: "original",
        description: "",
        status: "draft",
        technique: "",
        support: "",
        year: "",
        width: "",
        height: "",
        price: null,
        stock: 0,
        variants: [],
        featured: false,
      }),
    );
  db.prepare("INSERT OR IGNORE INTO settings VALUES (1,?)").run(
    JSON.stringify({
      commerceEnabled: false,
      sellerName: "",
      sellerAddress: "",
      sellerEmail: "",
      taxDescription: "",
      countries: [],
      shippingCents: null,
      shippingDelay: "",
      terms: "",
      privacy: "",
      legal: "",
    }),
  );
  const list = () =>
    db
      .prepare("SELECT data FROM products")
      .all()
      .map((x) => JSON.parse(x.data));
  const settings = () =>
    JSON.parse(db.prepare("SELECT data FROM settings WHERE id=1").get().data);
  const get = (id) => {
    const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
    return row ? JSON.parse(row.data) : null;
  };
  const audit = (kind, ref) =>
    db
      .prepare("INSERT INTO audit(kind,ref,created_at) VALUES (?,?,?)")
      .run(kind, ref, new Date().toISOString());
  function saveProduct(product) {
    db.prepare(
      "INSERT INTO products VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    ).run(product.id, JSON.stringify(product));
    audit("product.updated", product.id);
  }
  function publicationErrors(p, config = settings()) {
    const errors = [];
    if (!p.title?.trim()) errors.push("Le titre est obligatoire.");
    if (
      !p.image ||
      (!works.some((w) => w.image === p.image) &&
        !db.prepare("SELECT id FROM media WHERE id=?").get(p.image))
    )
      errors.push("Une vue complète est obligatoire.");
    if (!["original", "print"].includes(p.type))
      errors.push("Le type est invalide.");
    if (p.status === "available") {
      if (
        !p.technique ||
        !p.support ||
        !(Number(p.width) > 0) ||
        !(Number(p.height) > 0)
      )
        errors.push("Complétez la technique, le support et les dimensions.");
      if (
        !config.taxDescription ||
        !config.countries?.length ||
        !Number.isSafeInteger(config.shippingCents) ||
        config.shippingCents < 0 ||
        !config.shippingDelay
      )
        errors.push("Configurez les taxes et la livraison.");
      if (
        p.type === "original" &&
        (!Number.isSafeInteger(p.price) || p.price <= 0 || p.stock !== 1)
      )
        errors.push("Un original nécessite un prix validé et un stock de 1.");
      if (
        p.type === "print" &&
        (!p.variants?.length ||
          p.variants.some(
            (v) =>
              !v.format ||
              !v.paper ||
              !v.process ||
              !v.proofApproved ||
              !(v.width > 0) ||
              !(v.height > 0) ||
              !Number.isSafeInteger(v.price) ||
              v.price <= 0 ||
              !Number.isSafeInteger(v.stock) ||
              v.stock < 0,
          ))
      )
        errors.push(
          "Validez le format, le papier, le procédé, l’épreuve, le prix et le stock de chaque reproduction.",
        );
    }
    return errors;
  }
  function expire(now = Date.now()) {
    db.prepare(
      "UPDATE reservations SET active=0 WHERE order_id IN (SELECT id FROM orders WHERE status='pending' AND expires_at<=?)",
    ).run(now);
    db.prepare(
      "UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<=?",
    ).run(now);
  }
  function reserve(lines, address, now = Date.now(), expectedTotal) {
    db.exec("BEGIN IMMEDIATE");
    try {
      expire(now);
      const config = settings();
      if (
        !config.commerceEnabled ||
        !config.sellerName ||
        !config.sellerAddress ||
        !config.sellerEmail ||
        !config.terms ||
        !config.legal ||
        !config.privacy ||
        !config.taxDescription
      )
        throw new Error("La vente n’est pas encore ouverte.");
      if (!config.countries.includes(address.country))
        throw new Error("Livraison à confirmer pour votre destination.");
      if (
        !Number.isSafeInteger(config.shippingCents) ||
        config.shippingCents < 0 ||
        !config.shippingDelay
      )
        throw new Error("La livraison n’est pas configurée.");
      if (!lines?.length || lines.length > 30)
        throw new Error("Le panier est vide ou invalide.");
      const snapshot = [];
      const seen = new Set();
      for (const line of lines) {
        const p = get(line.id);
        const key = `${line.id}:${line.variant || ""}`;
        if (seen.has(key))
          throw new Error("Un article est présent plusieurs fois.");
        seen.add(key);
        if (
          !p ||
          p.status !== "available" ||
          publicationErrors(p, config).length
        )
          throw new Error("Une œuvre du panier est indisponible.");
        const variant =
          p.type === "print"
            ? p.variants.find((v) => v.format === line.variant)
            : p;
        if (
          !variant ||
          !Number.isSafeInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 20 ||
          (p.type === "original" && line.quantity !== 1)
        )
          throw new Error("Format ou quantité invalide.");
        const held = db
          .prepare(
            "SELECT COALESCE(SUM(quantity),0) AS n FROM reservations WHERE product_id=? AND variant=? AND active=1",
          )
          .get(p.id, line.variant || "").n;
        if (variant.stock - held < line.quantity)
          throw new Error(
            "Cette œuvre vient d’être réservée ou n’est plus disponible.",
          );
        snapshot.push({
          id: p.id,
          title: p.title,
          reference: p.reference,
          variant: line.variant || "",
          quantity: line.quantity,
          price: variant.price,
          type: p.type,
        });
      }
      const subtotal = snapshot.reduce((s, l) => s + l.price * l.quantity, 0),
        total = subtotal + config.shippingCents;
      if (!Number.isSafeInteger(total) || total <= 0)
        throw new Error("Montant invalide.");
      if (expectedTotal !== undefined && expectedTotal !== total)
        throw new Error(
          "Le montant de votre sélection a changé. Vérifiez votre panier avant de payer.",
        );
      const id = randomUUID(),
        token = randomUUID(),
        expiresAt = now + 30 * 60 * 1000;
      const data = {
        lines: snapshot,
        address,
        subtotal,
        shipping: config.shippingCents,
        total,
        currency: "EUR",
        taxDescription: config.taxDescription,
        createdAt: new Date(now).toISOString(),
      };
      db.prepare("INSERT INTO orders VALUES (?,?,?,?,NULL,?)").run(
        id,
        token,
        JSON.stringify(data),
        "pending",
        expiresAt,
      );
      for (const l of snapshot)
        db.prepare(
          "INSERT INTO reservations(order_id,product_id,variant,quantity) VALUES (?,?,?,?)",
        ).run(id, l.id, l.variant, l.quantity);
      audit("order.reserved", id);
      db.exec("COMMIT");
      return { id, token, ...data, expiresAt };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function release(id, status = "cancelled") {
    db.prepare("UPDATE reservations SET active=0 WHERE order_id=?").run(id);
    db.prepare(
      "UPDATE orders SET status=? WHERE id=? AND status='pending'",
    ).run(status, id);
  }
  function complete(eventId, orderId, amount, currency = "eur", sessionId) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (db.prepare("SELECT id FROM events WHERE id=?").get(eventId)) {
        db.exec("COMMIT");
        return false;
      }
      const row = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
      if (!row) throw new Error("Commande inconnue.");
      const data = JSON.parse(row.data);
      if (
        amount !== data.total ||
        currency !== "eur" ||
        (sessionId && row.session_id !== sessionId)
      )
        throw new Error("Montant, devise ou session incohérents.");
      if (["paid", "shipped", "refunded"].includes(row.status)) {
        db.prepare("INSERT INTO events VALUES (?)").run(eventId);
        db.exec("COMMIT");
        return false;
      }
      if (row.status !== "pending")
        throw new Error(
          "Réservation expirée ou libérée : vérification manuelle nécessaire.",
        );
      for (const l of data.lines) {
        const p = get(l.id);
        const v =
          p.type === "print"
            ? p.variants.find((v) => v.format === l.variant)
            : p;
        if (!v || v.stock < l.quantity) throw new Error("Stock insuffisant.");
        v.stock -= l.quantity;
        if (p.type === "original") p.status = "sold";
        saveProduct(p);
      }
      db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(orderId);
      db.prepare("UPDATE reservations SET active=0 WHERE order_id=?").run(
        orderId,
      );
      db.prepare("INSERT INTO events VALUES (?)").run(eventId);
      audit("order.paid", orderId);
      queueMail(`${orderId}-paid-buyer`, {
        kind: "confirmation",
        to: data.address.email,
        order: { id: orderId, ...data },
      });
      if (settings().sellerEmail)
        queueMail(`${orderId}-paid-seller`, {
          kind: "seller",
          to: settings().sellerEmail,
          order: { id: orderId, ...data },
        });
      db.exec("COMMIT");
      return true;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function queueMail(id, data) {
    db.prepare("INSERT OR IGNORE INTO outbox(id,data) VALUES (?,?)").run(
      id,
      JSON.stringify(data),
    );
  }
  function shipment(id, tracking) {
    const row = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
    if (!row || row.status !== "paid")
      throw new Error("Seule une commande payée peut être expédiée.");
    const data = JSON.parse(row.data);
    data.tracking = tracking;
    data.shippedAt = new Date().toISOString();
    db.prepare("UPDATE orders SET status='shipped',data=? WHERE id=?").run(
      JSON.stringify(data),
      id,
    );
    queueMail(`${id}-shipped`, {
      kind: "shipment",
      to: data.address.email,
      order: { id, ...data },
    });
    audit("order.shipped", id);
  }
  function refunded(id, returnToStock) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
      if (!row || !["paid", "shipped", "refunded"].includes(row.status))
        throw new Error("Cette commande ne peut pas être remboursée.");
      if (row.status === "refunded") {
        db.exec("COMMIT");
        return;
      }
      const data = JSON.parse(row.data);
      if (returnToStock)
        for (const l of data.lines) {
          const p = get(l.id);
          const v =
            p.type === "print"
              ? p.variants.find((v) => v.format === l.variant)
              : p;
          v.stock += l.quantity;
          if (p.type === "original") {
            v.stock = 1;
            p.status = "available";
          }
          saveProduct(p);
        }
      data.refundedAt = new Date().toISOString();
      data.returnToStock = returnToStock;
      db.prepare("UPDATE orders SET status='refunded',data=? WHERE id=?").run(
        JSON.stringify(data),
        id,
      );
      queueMail(`${id}-refund`, {
        kind: "refund",
        to: data.address.email,
        order: { id, ...data },
      });
      audit("order.refunded", id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return {
    db,
    list,
    queueMail,
    shipment,
    refunded,
    get,
    settings,
    saveProduct,
    publicationErrors,
    reserve,
    release,
    complete,
    expire,
    audit,
    saveSettings: (value) => {
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(value),
      );
      audit("settings.updated", "1");
    },
  };
}
