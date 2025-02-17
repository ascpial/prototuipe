import { ScreenRenderer, DEFAULT_COLORS, COLOR_NAMES } from "./renderer.js";
import { SubPx } from './subpxutils.js';

export class TerminalScreen extends ScreenRenderer {
  interaction;
  fgColor;
  bgColor;
  selectedChar;
  name;

  constructor(size, colors = DEFAULT_COLORS, border = 1, id, name) {
    super(size, colors, null, border);
    this.screen = [];
    this.buffer = {};
    this.id = id;
    this.name = name;

    this.fixEmptyChars()
  }

  fixEmptyChars() {
    this.screen.length = this.size.height;
    for (var i = 0; i < this.size.height; i++) {
      if (!this.screen[i]) {
        this.screen[i] = [];
      }
      this.screen[i].length = this.size.width;
      for (var j = 0; j < this.size.width; j++) {
        if (!this.screen[i][j]) {
          this.screen[i][j] = {
            charId: 32,
            fg: COLOR_NAMES.white,
            bg: COLOR_NAMES.black,
          };
        };
      }

    }
  }

  render() {
    for (let y = 0; y < this.size.height; y++) {
      for (let x = 0; x < this.size.width; x++) {
        let pixel;
        if (!this.buffer[[y, x]]) {
          pixel = this.screen[y][x]
        } else if (this.buffer[[y, x]] instanceof SubPx) {
          let [valid, char] = this.buffer[[y, x]].toChar();
          if (valid) {
            pixel = char;
          } else {
            pixel = this.screen[y][x];
          }
        } else {
          pixel = this.buffer[[y, x]];
        }
        super.drawChar(pixel.charId, x, y, pixel.fg, pixel.bg);
      }
    }
  }

  drawChar(charId, x, y, fgColor = null, bgColor = null) {
    fgColor = fgColor !== null ? fgColor : COLOR_NAMES.white;
    bgColor = bgColor !== null ? bgColor : COLOR_NAMES.black;
    if (0 <= x && x < this.size.width && 0 <= y && y < this.size.height) {
      this.buffer[[y, x]] = {
        charId: charId,
        fg: fgColor,
        bg: bgColor,
      }
    }
    super.drawChar(charId, x, y, fgColor, bgColor);
  }

  drawSubPx(sx, sy, color) {
    let x = ~~(sx / 2);
    let y = ~~(sy / 3);
    if (0 <= x && x < this.size.width && 0 <= y && y < this.size.height) {
      let px = sx % 2;
      let py = sy % 3;
      if (this.buffer[[y, x]] && this.buffer[[y, x]] instanceof SubPx) {
        this.buffer[[y, x]].set(px, py, color);
        this.ctx.fillStyle = this.colors[this.fgColor];
        this.ctx.fillRect(
          sx * 3 + this.border,
          sy * 3 + this.border,
          3, 3,
        );
      } else if (!this.buffer[[y, x]]) {
        let char = this.get(x, y);
        let newPx = new SubPx(char.charId, char.fg, char.bg);
        newPx.set(px, py, color);
        this.buffer[[y, x]] = newPx;
        this.ctx.fillStyle = this.colors[this.fgColor];
        this.ctx.fillRect(
          sx * 3 + this.border,
          sy * 3 + this.border,
          3, 3,
        );
      }
    }
  }

  get(x, y) {
    if (this.buffer[[y, x]]) {
      return this.buffer[[y, x]];
    } else {
      return this.screen[y][x];
    }
  }

  commitBuffer() {
    for (const [key, pixel] of Object.entries(this.buffer)) {
      let [y, x] = key.split(',').map(Number);
      if (pixel instanceof SubPx) {
        let [valid, value] = pixel.toChar();
        if (valid) {
          this.screen[y][x] = value;
        }
      } else {
        this.screen[y][x] = pixel;
      }
      let char = this.screen[y][x];
      super.drawChar(char.charId, x, y, char.fg, char.bg);
    }
    this.buffer = {};
    this.save();
  }

  save() {
    if (this.id) {
      let data = this.serialise();
      window.localStorage.setItem("s" + this.id, JSON.stringify(data));
    }
  }

  clearBuffer() {
    for (const [key, _] of Object.entries(this.buffer)) {
      let [y, x] = key.split(',').map(Number);
      let char = this.screen[y][x];
      super.drawChar(char.charId, x, y, char.fg, char.bg);
    }
    this.buffer = {};
    // document.getElementById('debug').style.backgroundColor = "#f00";
    // setTimeout(() => { document.getElementById('debug').style.backgroundColor = null; }, 100)
  }

  serialise() {
    // We need to include: Size (and size type, which includes computer, pocket, monitor, etc...)
    // Pixel data
    // Palette data (if changed)
    let serialised = {};
    let pxData = [];

    for (var i = 0; i < this.size.height; i++) {
      pxData.push(new Array(this.size.width));
      for (var j = 0; j < this.size.width; j++) {
        let px = this.screen[i][j];
        pxData[i][j] = [px.charId, px.fg, px.bg];
      }
    }
    serialised.screen = pxData;
    serialised.size = this.size;
    serialised.palette = this.colors;
    serialised.preview = this.canvas.toDataURL();
    serialised.name = this.name;
    return serialised;
  }

  load(data) {
    for (var i = 0; i < this.size.height; i++) {
      for (var j = 0; j < this.size.width; j++) {
        let px = data[i][j];
        this.screen[i][j].charId = px[0];
        this.screen[i][j].fg = px[1];
        this.screen[i][j].bg = px[2];
      }
    }
  }
}

TerminalScreen.unserialise = (data, id, border) => {
  let screen = new TerminalScreen(data.size, data.palette, border, id, data.name);
  screen.load(data.screen);
  return screen;
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
      // console.log(i, j);
      char += String.fromCharCode(screen.screen[i + y][j + x].charId);
      bg += screen.screen[i + y][j + x].bg.toString(16);
      fg += screen.screen[i + y][j + x].fg.toString(16);
    }
    data[i] = [char, fg, bg]; // this is ugly and will be changed once bimg is fully supported
  }
  let img = { 0: data };
  img.version = "1.0.0";
  img.creator = "prototuipe";
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
    screen = new TerminalScreen({ width: width + x, height: height + y }, undefined, 0);
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

