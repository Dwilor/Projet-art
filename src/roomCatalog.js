import { works } from "./content.js";

const dimensions = (width, height) =>
  Number.isFinite(Number(width)) &&
  Number.isFinite(Number(height)) &&
  Number(width) > 0 &&
  Number(height) > 0;
export const previewFormats = [
  { key: "small", label: "Petit", scale: 0.72 },
  { key: "medium", label: "Moyen", scale: 1 },
  { key: "large", label: "Grand", scale: 1.45 },
];

export function roomChoices(data) {
  const images = [...works, ...(data.media || [])];
  const products = data.products || [];
  const choices = products.flatMap((product) => {
    if (product.status !== "available") return [];
    const work = images.find((image) => image.image === product.image);
    if (!work) return [];
    const formats =
      product.type === "print"
        ? (product.variants || [])
            .filter(
              (variant) =>
                variant.stock > 0 && dimensions(variant.width, variant.height),
            )
            .map((variant) => ({
              key: variant.format,
              label: variant.format,
              width: Number(variant.width),
              height: Number(variant.height),
            }))
        : product.stock > 0 && dimensions(product.width, product.height)
          ? [
              {
                key: "original",
                label: "Format original",
                width: Number(product.width),
                height: Number(product.height),
              },
            ]
          : [];
    if (!formats.length) return [];
    return [
      {
        id: product.id,
        title: product.title || work.reference,
        kind: product.type === "print" ? "Reproduction" : "Original",
        work,
        formats,
        preview: false,
        href: `/${product.type === "print" ? "reproductions" : "originaux"}/${encodeURIComponent(product.slug)}`,
      },
    ];
  });
  if (data.mode === "preview") {
    const published = new Set(products.map((product) => product.image));
    for (const work of works.filter((work) => !published.has(work.image))) {
      choices.push({
        id: `preview:${work.id}`,
        title: work.reference,
        kind: "Composition",
        work,
        formats: previewFormats,
        preview: true,
        href: `/originaux/${work.id}`,
      });
    }
  }
  return choices;
}

export function roomImage(work) {
  return `${work.image.startsWith("media-") ? "/media" : "/images"}/${work.image}-1122.webp`;
}
