import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("public/images", { recursive: true });
for (let i = 1; i <= 5; i++) {
  const name = `art-${String(i).padStart(3, "0")}`;
  for (const width of [480, 800, 1122]) {
    await sharp(`public/images/${name}.png`)
      .resize({ width })
      .webp({ quality: 85 })
      .toFile(`public/images/${name}-${width}.webp`);
  }
}
console.log("15 images WebP responsives préparées.");
