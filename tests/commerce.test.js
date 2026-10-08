import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../server/store.js";
function fixture() {
  const s = createStore(":memory:");
  s.saveSettings({
    commerceEnabled: true,
    sellerName: "Test",
    sellerAddress: "Adresse de test",
    sellerEmail: "test@example.com",
    taxDescription: "Prix de test, taxes incluses",
    countries: ["FR"],
    shippingCents: 1500,
    shippingDelay: "Test",
    terms: "Conditions de test",
    legal: "Mentions de test",
    privacy: "Confidentialité de test",
  });
  const p = s.get("art-001");
  s.saveProduct({
    ...p,
    title: "Pièce de test",
    status: "available",
    technique: "Test",
    support: "Test",
    width: 30,
    height: 40,
    price: 29000,
    stock: 1,
  });
  return s;
}
const address = {
  name: "Client test",
  email: "client@example.com",
  street: "Adresse de test",
  postalCode: "75001",
  city: "Paris",
  country: "FR",
};
const line = { id: "art-001", variant: "", quantity: 1 };
test("les cinq compositions sont importées en brouillon, sans prix ni stock inventés", () => {
  const s = createStore(":memory:");
  assert.equal(s.list().length, 5);
  assert.ok(
    s
      .list()
      .every(
        (p) =>
          p.status === "draft" &&
          p.price === null &&
          p.stock === 0 &&
          p.title === "",
      ),
  );
  s.db.close();
});
test("une publication marchande incomplète est rejetée", () => {
  const s = createStore(":memory:");
  const errors = s.publicationErrors({
    ...s.get("art-001"),
    status: "available",
  });
  assert.ok(errors.length >= 4);
  s.db.close();
});
test("la réservation atomique empêche deux achats du même original", () => {
  const s = fixture();
  const order = s.reserve([line], address);
  assert.equal(order.subtotal, 29000);
  assert.equal(order.total, 30500);
  assert.throws(() => s.reserve([line], address), /réservée/);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
  s.release(order.id);
  assert.doesNotThrow(() => s.reserve([line], address));
  s.db.close();
});
test("une notification répétée ne diminue le stock qu’une seule fois", () => {
  const s = fixture();
  const o = s.reserve([line], address);
  assert.equal(s.complete("evt_1", o.id, 30500), true);
  assert.equal(s.complete("evt_1", o.id, 30500), false);
  assert.equal(s.complete("evt_2", o.id, 30500), false);
  assert.equal(s.get("art-001").stock, 0);
  assert.equal(s.get("art-001").status, "sold");
  s.db.close();
});
test("un montant ou une devise différents ne confirment pas une vente", () => {
  const s = fixture();
  const o = s.reserve([line], address);
  assert.throws(() => s.complete("evt_wrong", o.id, 1), /incohérents/);
  assert.throws(
    () => s.complete("evt_wrong", o.id, 30500, "usd"),
    /incohérents/,
  );
  assert.equal(s.get("art-001").stock, 1);
  assert.equal(
    s.db.prepare("SELECT status FROM orders WHERE id=?").get(o.id).status,
    "pending",
  );
  s.db.close();
});
test("l’expiration libère la réservation sans permettre de confirmer l’ancienne commande", () => {
  const s = fixture();
  const now = Date.now();
  const o = s.reserve([line], address, now);
  s.expire(now + 31 * 60000);
  assert.throws(() => s.complete("evt_late", o.id, 30500), /expirée/);
  assert.doesNotThrow(() => s.reserve([line], address, now + 31 * 60000));
  s.db.close();
});
test("une destination non configurée est bloquée avant réservation", () => {
  const s = fixture();
  assert.throws(
    () => s.reserve([line], { ...address, country: "US" }),
    /destination/,
  );
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
  s.db.close();
});
test("les quantités d’originaux et les lignes dupliquées sont refusées", () => {
  const s = fixture();
  assert.throws(
    () => s.reserve([{ ...line, quantity: 2 }], address),
    /quantité/,
  );
  assert.throws(() => s.reserve([line, line], address), /plusieurs fois/);
  s.db.close();
});
test("un print garde le format choisi, le prix figé et son propre stock", () => {
  const s = fixture();
  const p = s.get("art-002");
  s.saveProduct({
    ...p,
    type: "print",
    title: "Print de test",
    status: "available",
    technique: "Test",
    support: "Papier",
    width: 30,
    height: 40,
    variants: [
      {
        format: "A3",
        paper: "Papier de test",
        process: "Procédé de test",
        proofApproved: true,
        width: 29.7,
        height: 42,
        price: 4900,
        stock: 5,
      },
      {
        format: "A2",
        paper: "Papier de test",
        process: "Procédé de test",
        proofApproved: true,
        width: 42,
        height: 59.4,
        price: 7900,
        stock: 3,
      },
    ],
  });
  const o = s.reserve([{ id: p.id, variant: "A3", quantity: 2 }], address);
  assert.equal(o.total, 11300);
  const changed = s.get(p.id);
  changed.variants[0].price = 9900;
  s.saveProduct(changed);
  assert.equal(
    JSON.parse(
      s.db.prepare("SELECT data FROM orders WHERE id=?").get(o.id).data,
    ).lines[0].price,
    4900,
  );
  s.complete("evt_print", o.id, 11300);
  assert.equal(s.get(p.id).variants[0].stock, 3);
  assert.equal(s.get(p.id).variants[1].stock, 3);
  s.db.close();
});
test("les e-mails sont mis en file une seule fois après paiement vérifié", () => {
  const s = fixture();
  const o = s.reserve([line], address);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM outbox").get().n, 0);
  s.complete("evt_mail", o.id, 30500);
  s.complete("evt_mail", o.id, 30500);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM outbox").get().n, 2);
  s.db.close();
});
test("expédition et remboursement conservent un historique et ne doublent pas le stock", () => {
  const s = fixture();
  const o = s.reserve([line], address);
  s.complete("evt_paid", o.id, 30500);
  s.shipment(o.id, "SUIVI-TEST");
  assert.equal(
    s.db.prepare("SELECT status FROM orders WHERE id=?").get(o.id).status,
    "shipped",
  );
  s.refunded(o.id, true);
  s.refunded(o.id, true);
  assert.equal(s.get("art-001").stock, 1);
  assert.equal(s.get("art-001").status, "available");
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM outbox").get().n, 4);
  s.db.close();
});
test("un prix modifié bloque la commande avant toute réservation", () => {
  const s = fixture();
  assert.throws(() => s.reserve([line], address, Date.now(), 100), /montant/);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
  assert.equal(s.get("art-001").stock, 1);
  s.db.close();
});
