import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = new URL("..", import.meta.url);
const sourceDir = new URL("../icon-src/", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);

await fs.rm(publicDir, { recursive: true, force: true });
await fs.mkdir(publicDir, { recursive: true });

const entries = (await fs.readdir(sourceDir)).filter(name => name.endsWith(".svg")).sort();

for (const file of entries) {
  const slug = path.basename(file, ".svg");
  const src = new URL(file, sourceDir);
  const out = new URL(`./${slug}/pwa/`, publicDir);
  await fs.mkdir(out, { recursive: true });

  const svg = await fs.readFile(src);
  await fs.writeFile(new URL("icon.svg", out), svg);

  for (const size of [192, 512]) {
    await sharp(svg)
      .resize(size, size, { fit: "contain" })
      .png({ compressionLevel: 9, palette: true, colours: 128 })
      .toFile(new URL(`icon-${size}.png`, out));
  }

  console.log(`Built PWA icons for ${slug}`);
}
