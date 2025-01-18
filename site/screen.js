import { ScreenRenderer, DEFAULT_COLORS, COLOR_NAMES } from "./renderer.js";
import { SubPx } from './subpxutils.js';

export class TerminalScreen extends ScreenRenderer {
  interaction;
  fgColor;
  bgColor;
  selectedChar;

  constructor(size, colors = DEFAULT_COLORS, border = 1) {
    super(size, colors, null, border);
    this.screen = [];
    this.buffer = [];

    for (var i = 0; i < this.size.height; i++) {
      this.screen.push(new Array(this.size.width));
      this.buffer.push(new Array(this.size.width));
      for (var j = 0; j < this.size.width; j++) {
        this.screen[i][j] = {
          charId: 0,
          fg: COLOR_NAMES.white,
          bg: COLOR_NAMES.black,
        };
        this.buffer[i][j] = null;
      }
    }
  }

  render() {
    for (let y = 0; y < this.size.height; y++) {
      for (let x = 0; x < this.size.width; x++) {
        let pixel;
        if (this.buffer[y][x] === null) {
          pixel = this.screen[y][x]
        } else if (this.buffer[y][x] instanceof SubPx) {
          console.warn('subpx merging not implemented');
        } else {
          pixel = this.buffer[y][x];
        }
        super.drawChar(pixel.charId, x, y, pixel.fg, pixel.bg);
      }
    }
  }

  drawChar(charId, x, y, fgColor = null, bgColor = null) {
    fgColor = fgColor !== null ? fgColor : COLOR_NAMES.white;
    bgColor = bgColor !== null ? bgColor : COLOR_NAMES.black;
    if (0 <= x && x < this.size.width && 0 <= y && y < this.size.height) {
      this.buffer[y][x] = {
        charId: charId,
        fg: fgColor,
        bg: bgColor,
      }
    }
    super.drawChar(charId, x, y, fgColor, bgColor);
  }

  get(x, y) {
    if (this.buffer[y][x] !== null) {
      return this.buffer[y][x];
    } else {
      return this.screen[y][x];
    }
  }

  commitBuffer() {
    for (let y = 0; y < this.size.height; y++) {
      for (let x = 0; x < this.size.width; x++) {
        let pixel = this.buffer[y][x];
        if (pixel !== null) {
          if (pixel instanceof SubPx) {
            console.warn('subpx merging not implemented')
          } else {
            this.screen[y][x] = pixel;
            this.buffer[y][x] = null;
          }
        }
      }
    }
    document.getElementById('debug').style.backgroundColor = "#0f0";
    setTimeout(() => { document.getElementById('debug').style.backgroundColor = null; }, 100)
  }

  clearBuffer() {
    for (let y = 0; y < this.size.height; y++) {
      for (let x = 0; x < this.size.width; x++) {
        this.buffer[y][x] = null;
      }
    }
    this.render();
    document.getElementById('debug').style.backgroundColor = "#f00";
    setTimeout(() => { document.getElementById('debug').style.backgroundColor = null; }, 100)
  }
}

export function bimgExport(screen, width, height, x, y) {
  let data = [];
  width = width ? width : screen.size.width;
  height = height ? height : screen.size.height;
  x = x ? x : 0;
  y = y ? y : 0;

  for (let i = 0; i < height; i++) {
    let char = "";
    let bg = "";
    let fg = "";
    for (let j = 0; j < width; j++) {
      char += String.fromCharCode(screen.screen[i + y][j + x].charId);
      bg += screen.screen[i + y][j + x].bg.toString(16);
      fg += screen.screen[i + y][j + x].fg.toString(16);
    }
    data[i.toString()] = [char, fg, bg]; // this is ugly and will be changed once bimg is fully supported
  }
  let img = {"0": data};
  img.version = "1.0.0";
  img.creator = "prototuip";
  img.width = width;
  img.height = height;
  img.animated = false;

  return img;
}

export function bimgImport(img, screen, x, y, width, height) {
  if (img.version !== "1.0.0") {
    throw new Error('No bimg image found in data');
  }
  width = width ? width : (img.width ? img.width : img["0"][0][0].length);
  height = height ? height : (img.height ? img.height : img["0"].length);
  x = x ? x : 0;
  y = y ? y : 0;
  let data = img["0"];

  if (!screen) {
    screen = new TerminalScreen({width: width+x, height: height+y}, undefined, 0);
  }

  for (let i = 0; i < height; i++) {
    let row = data[i];
    let char = row[0];
    let fgs = row[1];
    let bgs = row[2];
    for (let j = 0; j < width; j++) {
      let charId = char.charCodeAt(j);
      let fg = fgs[j] != " " ? parseInt(fgs[j], 16) : null;
      let bg = bgs[j] != " " ? parseInt(bgs[j], 16) : null;
      if (charId != 32 || fg || bg) {
        screen.drawChar(charId, x + j, y + i,
          fg !== null ? fg : screen.get(x + j, y + i).fg,
          bg !== null ? bg : screen.get(x + j, y + i).bg,
        )
      }
    }
  }
  return screen;
}

