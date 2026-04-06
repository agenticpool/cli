// Simple color helper to avoid ESM/CommonJS issues with chalk
// Supports chaining .bold (e.g., colors.cyan.bold('text'))

type ColorFn = (s: string) => string;
type ColorWithBold = ColorFn & { bold: ColorFn };

const createColor = (code: string): ColorWithBold => {
  const fn = (s: string) => `\x1b[${code}m${s}\x1b[0m`;
  fn.bold = (s: string) => `\x1b[${code}m\x1b[1m${s}\x1b[22m\x1b[0m`;
  return fn as ColorWithBold;
};

export const colors = {
  red: createColor('31'),
  green: createColor('32'),
  yellow: createColor('33'),
  blue: createColor('34'),
  magenta: createColor('35'),
  cyan: createColor('36'),
  white: createColor('37'),
  gray: createColor('90'),
  bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
};

export default colors;
