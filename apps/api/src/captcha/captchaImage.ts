import { randomInt } from "node:crypto";

/**
 * Generador del desafío visual del CAPTCHA (RF-3.6).
 *
 * Los caracteres se dibujan como rectángulos a partir de una tipografía de mapa
 * de bits: el SVG resultante no contiene el texto de la respuesta, así que no se
 * puede leer del marcado. La respuesta solo vive en la base de datos.
 */

/** Sin 0/O ni 1/I/L: se confunden al transcribirlos. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

/** Cada fila es una máscara de 5 bits (bit más significativo = columna izquierda). */
const GLYPHS: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
};

export const CAPTCHA_LENGTH = 5;

const WIDTH = 220;
const HEIGHT = 64;
/** Paleta del diseño (documentacion/Pantallas/TesisPantallas.pen). */
const INK = "#1A4A8C";
const NOISE = "#9AB0CC";
const BACKGROUND = "#F5F5F5";

function randomBetween(min: number, max: number): number {
  return min + randomInt(0, Math.max(1, Math.round((max - min) * 100) + 1)) / 100;
}

export function generateCaptchaText(length = CAPTCHA_LENGTH): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return text;
}

function glyphMarkup(character: string, cell: number): string {
  const rows = GLYPHS[character];
  if (!rows) return "";

  const rectangles: string[] = [];
  rows.forEach((mask, row) => {
    for (let column = 0; column < GLYPH_WIDTH; column += 1) {
      if ((mask & (1 << (GLYPH_WIDTH - 1 - column))) === 0) continue;
      // Cada píxel se desplaza un poco: los bordes quedan irregulares.
      const x = (column * cell + randomBetween(-0.6, 0.6)).toFixed(2);
      const y = (row * cell + randomBetween(-0.6, 0.6)).toFixed(2);
      const size = (cell + randomBetween(0, 0.8)).toFixed(2);
      rectangles.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}"/>`);
    }
  });
  return rectangles.join("");
}

function noiseMarkup(): string {
  const shapes: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const startY = randomBetween(6, HEIGHT - 6);
    const controlY = randomBetween(-10, HEIGHT + 10);
    const endY = randomBetween(6, HEIGHT - 6);
    shapes.push(
      `<path d="M0 ${startY.toFixed(1)} Q ${(WIDTH / 2).toFixed(1)} ${controlY.toFixed(1)} ${WIDTH} ${endY.toFixed(1)}" fill="none" stroke="${NOISE}" stroke-width="${randomBetween(1, 2).toFixed(2)}"/>`,
    );
  }
  for (let index = 0; index < 40; index += 1) {
    const x = randomBetween(0, WIDTH).toFixed(1);
    const y = randomBetween(0, HEIGHT).toFixed(1);
    shapes.push(`<circle cx="${x}" cy="${y}" r="${randomBetween(0.6, 1.6).toFixed(2)}" fill="${NOISE}"/>`);
  }
  return shapes.join("");
}

/** Devuelve el SVG del desafío como data URI listo para un `<img src>`. */
export function renderCaptchaImage(text: string): string {
  const cell = 4.4;
  const glyphWidth = GLYPH_WIDTH * cell;
  const glyphHeight = GLYPH_HEIGHT * cell;
  const step = (WIDTH - 40) / text.length;

  const characters = [...text].map((character, index) => {
    const scale = randomBetween(1.15, 1.35);
    const rotation = randomBetween(-14, 14);
    const x = 26 + index * step + randomBetween(-2, 2);
    const y = HEIGHT / 2 + randomBetween(-3, 3);
    return [
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)}) translate(${(-glyphWidth / 2).toFixed(2)} ${(-glyphHeight / 2).toFixed(2)})" fill="${INK}">`,
      glyphMarkup(character, cell),
      "</g>",
    ].join("");
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BACKGROUND}"/>`,
    noiseMarkup(),
    characters.join(""),
    "</svg>",
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
