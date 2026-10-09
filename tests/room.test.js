import test from "node:test";
import assert from "node:assert/strict";
import { roomChoices } from "../src/roomCatalog.js";
import { artworkRect } from "../src/roomGeometry.js";

test("l’œuvre reste entière dans la photo, quelle que soit la position, la taille ou l’orientation", () => {
  for (const photoRatio of [0.3, 0.75, 1, 1.5, 4]) {
    for (const artworkRatio of [0.5, 0.8, 1, 2]) {
      for (const placement of [
        { x: -4, y: -2, width: 5 },
        { x: 5, y: 9, width: 0 },
        { x: 0.5, y: 0.4, width: 0.28 },
      ]) {
        const rect = artworkRect(placement, photoRatio, artworkRatio);
        assert.ok(rect.left >= -1e-10 && rect.top >= -1e-10);
        assert.ok(rect.left + rect.width <= 1 + 1e-10);
        assert.ok(rect.top + rect.height <= 1 + 1e-10);
        assert.ok(rect.width > 0 && rect.height > 0);
        assert.ok(
          Math.abs((rect.width * photoRatio) / rect.height - artworkRatio) <
            1e-9,
        );
      }
    }
  }
});

test("des données géométriques invalides ne produisent pas une image invisible ou hors cadre", () => {
  const rect = artworkRect({ x: NaN, y: Infinity, width: NaN }, 0, NaN);
  assert.ok(Object.values(rect).every(Number.isFinite));
  assert.ok(rect.width > 0 && rect.left >= 0 && rect.top >= 0);
});

const original = {
  id: "original",
  slug: "original",
  type: "original",
  title: "Original",
  image: "art-001",
  status: "available",
  stock: 1,
  width: 40,
  height: 50,
};
const print = {
  id: "print",
  slug: "tirage",
  type: "print",
  title: "Tirage",
  image: "art-002",
  status: "available",
  variants: [
    { format: "30 × 40", width: 30, height: 40, stock: 2 },
    { format: "60 × 80", width: 60, height: 80, stock: 3 },
    { format: "Épuisé", width: 90, height: 120, stock: 0 },
  ],
};
test("en production, seuls les originaux et formats de reproduction disponibles sont proposés", () => {
  const choices = roomChoices({
    mode: "live",
    products: [
      original,
      print,
      ...["draft", "sold", "archived", "reserved"].map((status) => ({
        ...original,
        id: status,
        status,
      })),
      { ...original, id: "empty", stock: 0 },
    ],
  });
  assert.deepEqual(
    choices.map((choice) => choice.id),
    ["original", "print"],
  );
  assert.deepEqual(
    choices[1].formats.map((format) => format.width),
    [30, 60],
  );
  assert.equal(choices[0].formats[0].height, 50);
  assert.ok(choices.every((choice) => !choice.preview));
});

test("les références d’aperçu ne créent aucune dimension commerciale et ne réintroduisent pas une œuvre vendue", () => {
  const choices = roomChoices({
    mode: "preview",
    products: [{ ...original, status: "sold" }],
  });
  assert.equal(choices.length, 4);
  assert.ok(
    choices.every(
      (choice) => choice.preview && choice.work.image !== "art-001",
    ),
  );
  assert.ok(
    choices.every((choice) =>
      choice.formats.every((format) => !format.width && !format.height),
    ),
  );
  assert.equal(roomChoices({ mode: "live", products: [] }).length, 0);
});
