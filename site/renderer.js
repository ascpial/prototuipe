export const SIZE_TYPES = {
  Computer: 0,
  Turtle: 1,
  Pocket: 2,
  Monitor: 3,
  Custom: 4,
}

export const SIZES = {
  computer: {
    width: 51,
    height: 19,
    type: SIZE_TYPES.Computer,
  },
  turtle: {
    width: 39,
    height: 13,
    type: SIZE_TYPES.Turtle,
  },
  pocket: {
    width: 26,
    height: 20,
    type: SIZE_TYPES.Pocket,
  },
}

export const COLOR_NAMES = {
  white: 0,
  orange: 1,
  magenta: 2,
  lightBlue: 3,
  yellow: 4,
  lime: 5,
  pink: 6,
  gray: 7,
  lightGray: 8,
  cyan: 9,
  purple: 10,
  blue: 11,
  brown: 12,
  green: 13,
  red: 14,
  black: 15,
}
export const DEFAULT_COLORS = ["#F0F0F0", "#F2B233", "#E57FD8", "#99B2F2", "#DEDE6C", "#7FCC19", "#F2B2CC", "#4C4C4C", "#999999", "#4C99B2", "#B266E5", "#3366CC", "#7F664C", "#57A64E", "#CC4C4C", "#111111"];

export const FONT = new Image();
FONT.src = `term_font.png`;

export class ScreenRenderer {
  canvas;
  ctx;
  cache;
  cachedCharId;
  cachedFg;
  cacheCtx;

  colors;
  size;
  border;
  drawBorder;

  constructor(size, colors = null, canvas = null, border = 1, drawBorder) {
    if (!canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = size.width * 6 + 2 * border;
      this.canvas.height = size.height * 9 + 2 * border;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.fillStyle = colors[COLOR_NAMES.black];
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }
    this.border = border;
    this.drawBorder = drawBorder ? drawBorder : false;
    this.size = size;
    this.colors = colors ? colors : structuredClone(colors);

    this.cache = document.createElement('canvas');
    this.cache.width = 6;
    this.cache.height = 9;
    this.cacheCtx = this.cache.getContext('2d');
    this.cachedCharId = null;
    this.cachedFg = null;
  }

  drawChar(charId, x, y, fgColor = null, bgColor = null) {
    if (0 <= x && x < this.size.width && 0 <= y && y < this.size.height) {
      fgColor = fgColor !== null ? fgColor : COLOR_NAMES.white;
      bgColor = bgColor !== null ? bgColor : COLOR_NAMES.black;

      this.ctx.fillStyle = this.colors[bgColor];
      this.ctx.fillRect(x * 6 + this.border, y * 9 + this.border, 6, 9)

      if (this.drawBorder) {
        if (x == 0) {
          this.ctx.fillRect((x - 1) * 6 + this.border, y * 9 + this.border, 6, 9);
          if (y == 0) {
            this.ctx.fillRect((x - 1) * 6 + this.border, (y - 1) * 9 + this.border, 6, 9);
          } else if (y == this.size.height - 1) {
            this.ctx.fillRect((x - 1) * 6 + this.border, (y + 1) * 9 + this.border, 6, 9);
          }
        } else if (x == this.size.width - 1) {
          this.ctx.fillRect((x + 1) * 6 + this.border, y * 9 + this.border, 6, 9);
          if (y == 0) {
            this.ctx.fillRect((x + 1) * 6 + this.border, (y - 1) * 9 + this.border, 6, 9);
          } else if (y == this.size.height - 1) {
            this.ctx.fillRect((x + 1) * 6 + this.border, (y + 1) * 9 + this.border, 6, 9);
          }
        }
        if (y == 0) {
          this.ctx.fillRect(x * 6 + this.border, (y - 1) * 9 + this.border, 6, 9);
        } else if (y == this.size.height - 1) {
          this.ctx.fillRect(x * 6 + this.border, (y + 1) * 9 + this.border, 6, 9);
        }
      }

      if (this.cachedCharId != charId || this.cachedFg != fgColor) {
        let sourceX = (charId % 16) * 8 + 1
        let sourceY = ~~(charId / 16) * 11 + 1
        this.cacheCtx.globalCompositeOperation = "source-over";
        this.cacheCtx.fillStyle = this.colors[fgColor];
        this.cacheCtx.fillRect(0, 0, 6, 9);
        this.cacheCtx.globalCompositeOperation = "destination-in";
        this.cacheCtx.drawImage(FONT, sourceX, sourceY, 6, 9, 0, 0, 6, 9);
        this.cacheCtx.globalCompositeOperation = "source-over";
      }
      this.ctx.drawImage(
        this.cache,
        x * 6 + this.border, y * 9 + this.border,
      );
    }
  }

  drawText(text, x, y, fgColor = null, bgColor = null) {
    const ox = x;
    for (let i = 0; i < text.length; i++) {
      if (text[i] == "\n") {
        y += 1;
        x = ox;
      } else if (x < this.size.width && y < this.size.height) {
        this.drawChar(text.charCodeAt(i), x, y, fgColor, bgColor);
        x += 1;
      }
    }
  }
}

