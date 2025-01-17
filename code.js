// import { SIZES, FONT, ScreenRenderer, COLOR_NAMES, DEFAULT_COLORS } from "./renderer.js";
// import { Hct2, argbFromHex2 } from "./bundle.js";
// import { TerminalScreen } from "./screen.js";

// import { SubPx } from './subpxutils.js';

let renderer = await import('./renderer.js');
let SIZES = renderer.SIZES;
let FONT = renderer.FONT;
let ScreenRenderer = renderer.ScreenRenderer;
let COLOR_NAMES = renderer.COLOR_NAMES;
let DEFAULT_COLORS = renderer.DEFAULT_COLORS;
let colorUtils = await import('./color-utils.js');
let Hct2 = colorUtils.Hct2;
let argbFromHex2 = colorUtils.argbFromHex2;
let TerminalScreen = (await import('./screen.js')).TerminalScreen;
let SubPx = (await import('./subpxutils.js')).SubPx;

let sign = (a) => a > 0 ? 1 : -1;

function* line(x1, y1, x2, y2) {
  let dx = x2 - x1;
  let dy = y2 - y1;

  if (Math.abs(dx) > Math.abs(dy)) {
    let y = y1;
    let i = Math.abs(dx) / 2;
    for (let x = x1; sign(dx) * (x - x2) <= 0; x += sign(dx)) {
      yield [x, y];
      i += Math.abs(dy);
      if (i > Math.abs(dx)) {
        y += sign(dy);
        i -= Math.abs(dx)
      }
    }
  } else {
    let x = x1;
    let i = Math.abs(dy) / 2;
    for (let y = y1; sign(dy) * (y - y2) <= 0; y += sign(dy)) {
      yield [x, y];
      i += Math.abs(dx);
      if (i > Math.abs(dy)) {
        x += sign(dx);
        i -= Math.abs(dy)
      }
    }
  }
}

function* box(x1, y1, x2, y2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    yield [x, y1];
    yield [x, y2];
  };
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    yield [x1, y];
    yield [x2, y];
  };
}

const MODES = {
  Idle: 0,
  Placing: 1,
  Writing: 2,
  Selecting: 3,
  Selected: 4,
  MovingSelection: 5,
  Drawing: 6,
}
const TYPES = {
  Normal: 0,
  Line: 1,
  Box: 2,
}

export const TOOLS = {
  Place: 0,
  Write: 1,
  Select: 2,
  Draw: 3,
}

let place = {
  pointDown: (screen, e) => {
    let pos = getCharCoords(e);
    if (e.button == 0) {
      if (screen.interaction.mode == MODES.Idle) {
        if (e.shiftKey) {
          screen.interaction = {
            mode: MODES.Placing,
            pos: pos,
            point1: pos,
            type: TYPES.Line,
          }
        } else if (e.ctrlKey) {
          screen.interaction = {
            mode: MODES.Placing,
            pos: pos,
            point1: pos,
            type: TYPES.Box,
          }
        } else {
          screen.interaction = {
            mode: MODES.Placing,
            pos: pos,
          };
          screen.drawChar(screen.selectedChar, screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
        }
      }
    } else if (e.button == 2) {
      screen.clearBuffer();
      screen.interaction = {
        mode: MODES.Idle,
        pos: getCharCoords(e),
      };
      render();
    }
  },
  pointMove: (screen, e) => {
    let pos = getCharCoords(e);
    if (screen.interaction.mode == MODES.Placing) {
      if (screen.interaction.type == TYPES.Line || screen.interaction.type == TYPES.Box) {
        render();
      } else if (!screen.interaction.type || screen.interaction.type == TYPES.Normal) {
        for (const [x, y] of line(screen.interaction.pos.x, screen.interaction.pos.y, pos.x, pos.y)) {
          screen.drawChar(screen.selectedChar, x, y, screen.fgColor, screen.bgColor);
        }
        // screen.drawChar(screen.selectedChar, pos.x, pos.y, screen.fgColor, screen.bgColor);
      }
    }
    screen.interaction.pos = pos;
    render();
  },
  pointUp: (screen, e) => {
    if (screen.interaction.mode == MODES.Placing) {
      let pos = getCharCoords(e);
      if (screen.interaction.type == TYPES.Line) {
        for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.pos.x, screen.interaction.pos.y)) {
          screen.drawChar(screen.selectedChar, x, y, screen.fgColor, screen.bgColor);
        }
      } else if (screen.interaction.type == TYPES.Box) {
        for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.pos.x, screen.interaction.pos.y)) {
          screen.drawChar(screen.selectedChar, x, y, screen.fgColor, screen.bgColor);
        }
      }
      screen.commitBuffer();
      screen.interaction = {
        mode: MODES.Idle,
        pos: pos,
      }
      render();
    }
  },
  render: (screen, bufferScreen) => {
    // console.log('render', screen.interaction.mode, screen.interaction.pos);
    if (screen.interaction.mode == MODES.Idle && screen.interaction.pos) {
      bufferScreen.drawChar(screen.selectedChar, screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
    } else if (screen.interaction.mode == MODES.Placing) {
      if (!screen.interaction.type || screen.interaction.type == TYPES.Normal) {
        bufferScreen.drawChar(screen.selectedChar, screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
      } else if (screen.interaction.type == TYPES.Line) {
        for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.pos.x, screen.interaction.pos.y)) {
          bufferScreen.drawChar(screen.selectedChar, x, y, screen.fgColor, screen.bgColor)
        }
      } else if (screen.interaction.type == TYPES.Box) {
        for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.pos.x, screen.interaction.pos.y)) {
          bufferScreen.drawChar(screen.selectedChar, x, y, screen.fgColor, screen.bgColor)
        }
      }
    }
  },
  commit: (screen) => {
    if (screen.interaction.mode == MODES.Placing && (!screen.interaction.type || screen.interaction.type == TYPES.Normal)) {
      screen.commitBuffer();
    }
  },
}

let input_text = {
  pointMove: (screen, e) => {
    if (screen.interaction.mode == MODES.Idle) {
      screen.interaction.pos = getCharCoords(e);
      render();
    }
  },
  pointUp: (screen, e) => {
    let pos = getCharCoords(e);
    if (screen.interaction.mode == MODES.Idle && e.button == 0) {
      screen.interaction = {
        mode: MODES.Writing,
        pos: pos,
        text: '',
      }
    }
    render();
  },
  keyDown: (screen, e) => {
    if (screen.interaction.mode == MODES.Writing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (e.key == "Backspace") {
        screen.interaction.text = screen.interaction.text.slice(0, -1);
        resetBlink();
        render();
      } else if (e.key == "Enter" && !e.shiftKey) {
        input_text.commit(screen);
        screen.interaction = { mode: MODES.Idle };
        render();
      } else if (e.key == "Enter" && e.shiftKey) {
        let dy = (screen.interaction.text.match(/\n/g) || []).length;
        if (screen.interaction.pos.y + dy < screen.size.height - 1) {
          screen.interaction.text += "\n";
          resetBlink();
          render();
        }
      } else if (e.key == "Escape") {
        screen.interaction = { mode: MODES.Idle };
        render();
      } else if (e.key.length == 1) {
        let dx = screen.interaction.text.split('\n').at(-1).length;
        if (screen.interaction.pos.x + dx < screen.size.width) {
          screen.interaction.text = screen.interaction.text + e.key;
          resetBlink();
          render();
        }
      }
    } else {
      executeKeybinds(e);
    }
  },
  render: (screen, bufferScreen) => {
    if (screen.interaction.mode == MODES.Writing) {
      if (cursor.shown) {
        bufferScreen.drawText(screen.interaction.text + "_", screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
      } else {
        bufferScreen.drawText(screen.interaction.text + " ", screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
      }
    } else if (screen.interaction.mode == MODES.Idle && screen.interaction.pos) {
      bufferScreen.drawChar(95, screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
    }
  },
  commit: (screen) => {
    if (screen.interaction.mode == MODES.Writing) {
      screen.drawText(screen.interaction.text, screen.interaction.pos.x, screen.interaction.pos.y, fgColor, bgColor);
      screen.commitBuffer();
    }
  },
}

let select = {
  pointDown: (screen, e) => {
    let pos = getCharCoords(e);
    if (e.button == 0) {
      if (screen.interaction.mode == MODES.Idle) {
        screen.interaction = {
          mode: MODES.Selecting,
          point1: pos,
          point2: pos,
        };
      } else if (screen.interaction.mode == MODES.Selected) {
        let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
        let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;
        let originX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
        let originY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);

        if (pos.x >= originX && pos.x < originX + width
          && pos.y >= originY && pos.y < originY + height) {
          screen.interaction.mode = MODES.MovingSelection;
          screen.interaction.pos = pos;
          if (!screen.interaction.offset) {
            screen.interaction.offset = { x: 0, y: 0 };
          }

          if (!screen.interaction.data) {
            let area = document.createElement('canvas');
            area.width = width * 6;
            area.height = height * 9;
            let areaCtx = area.getContext('2d');
            areaCtx.drawImage(screen.canvas, originX * 6 + 1, originY * 9 + 1, width * 6, height * 9, 0, 0, width * 6, height * 9);
            screen.interaction.area = area;

            let data = [];
            for (var i = 0; i < height; i++) {
              data.push([]);
              data[i].push(new Array(width));
              for (var j = 0; j < width; j++) {
                let char = screen.get(originX + j, originY + i);
                data[i][j] = {
                  charId: char.charId,
                  fg: char.fg,
                  bg: char.bg,
                };
                screen.drawChar(32, originX + j, originY + i, screen.fgColor, screen.bgColor);
              }
            }
            screen.interaction.data = data;
          }
          render();
        } else {
          commitInteraction();
          screen.interaction = {
            mode: MODES.Idle,
          };
          render();
        }
      }
    } else if (e.button == 2) {
      if (screen.tool == TOOLS.Select && screen.interaction.mode != MODES.Idle) {
        screen.interaction = { mode: MODES.Idle };
        screen.clearBuffer();
        render();
      }
    }
  },
  pointMove: (screen, e) => {
    let pos = getCharCoords(e);
    if (screen.interaction.mode == MODES.Selecting) {
      screen.interaction.point2 = pos;
    } else if (screen.interaction.mode == MODES.MovingSelection) {
      screen.interaction.offset = {
        x: screen.interaction.offset.x + pos.x - screen.interaction.pos.x,
        y: screen.interaction.offset.y + pos.y - screen.interaction.pos.y,
      }
      screen.interaction.pos = pos;
    } else {
      screen.interaction.pos = pos;
    };
    render();
  },
  pointUp: (screen, e) => {
    let pos = getCharCoords(e);
    let subpos = getSubPxCoords(e);
    if (e.button == 0) {
      if (screen.interaction.mode == MODES.Selecting) {
        screen.interaction.mode = MODES.Selected;
        screen.interaction.point2 = pos;
        render();
      } else if (screen.interaction.mode == MODES.MovingSelection) {
        screen.interaction.mode = MODES.Selected;
      }
    }
  },
  keyDown: (screen, e) => {
    if (e.key == "Escape") {
      e.preventDefault();
      commitInteraction();
      screen.interaction = { mode: MODES.Idle };
      render();
    } else if (e.key == "Delete" || e.key == "Backspace") {
      e.preventDefault();
      commitInteraction();
      let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
      let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;
      let originX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
      let originY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
      for (let y = originY; y < originY + height; y++) {
        for (let x = originX; x < originX + width; x++) {
          screen.drawChar(32, x, y, screen.fgColor, screen.bgColor);
        }
      }
      screen.commitBuffer();
      render();
    } else {
      executeKeybinds(e);
    }
  },
  render: (screen, bufferScreen) => {
    if (screen.interaction.mode == MODES.Selecting || screen.interaction.mode == MODES.Selected || screen.interaction.mode == MODES.MovingSelection) {
      let offsetX = screen.interaction.offset ? screen.interaction.offset.x : 0;
      let offsetY = screen.interaction.offset ? screen.interaction.offset.y : 0;
      let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) * 6 + offsetX * 6 + 1;
      let maxX = Math.max(screen.interaction.point1.x, screen.interaction.point2.x) * 6 + offsetX * 6 + 6;
      let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) * 9 + offsetY * 9 + 1;
      let maxY = Math.max(screen.interaction.point1.y, screen.interaction.point2.y) * 9 + offsetY * 9 + 9;

      if (screen.interaction.area) {
        bufferScreen.ctx.drawImage(screen.interaction.area, minX, minY);
      }

      bufferScreen.ctx.fillStyle = SELECTION_COLOR;
      bufferScreen.ctx.fillRect(minX, minY, 2, 2);
      bufferScreen.ctx.fillRect(minX, maxY - 1, 2, 2);
      bufferScreen.ctx.fillRect(maxX - 1, maxY - 1, 2, 2);
      bufferScreen.ctx.fillRect(maxX - 1, minY, 2, 2);
      for (let i = 4; i < Math.abs(minX - maxX) / 2; i += 3) {
        bufferScreen.ctx.fillRect(minX + i, minY, 1, 1);
        bufferScreen.ctx.fillRect(maxX - i, minY, 1, 1);
        bufferScreen.ctx.fillRect(minX + i, maxY, 1, 1);
        bufferScreen.ctx.fillRect(maxX - i, maxY, 1, 1);
      }
      for (let i = 4; i <= Math.abs(minY - maxY) / 2; i += 3) {
        bufferScreen.ctx.fillRect(minX, minY + i, 1, 1);
        bufferScreen.ctx.fillRect(minX, maxY - i, 1, 1);
        bufferScreen.ctx.fillRect(maxX, minY + i, 1, 1);
        bufferScreen.ctx.fillRect(maxX, maxY - i, 1, 1);
      }
    }
  },
  commit: (screen) => {
    if ((screen.interaction.mode == MODES.Selected || screen.interaction.mode == MODES.MovingSelection) && screen.interaction.data) {
      let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
      let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
      let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
      let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;

      if (screen.interaction.data) {
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            screen.drawChar(
              screen.interaction.data[i][j].charId,
              minX + j, minY + i,
              screen.interaction.data[i][j].fg,
              screen.interaction.data[i][j].bg,
            )
          }
        }
      }
      delete screen.interaction.data
      delete screen.interaction.area
      screen.commitBuffer();
    }
  },
};
let draw = {
  pointDown: (screen, e) => {
    let pos = getCharCoords(e);
    let subpos = getSubPxCoords(e);
    if (e.button == 0) {
      if (e.shiftKey) {
        screen.interaction = {
          mode: MODES.Drawing,
          pos: pos,
          point1: subpos,
          subpos: subpos,
          type: TYPES.Line,
        }
      } else if (e.ctrlKey) {
        screen.interaction = {
          mode: MODES.Drawing,
          pos: pos,
          point1: subpos,
          subpos: subpos,
          type: TYPES.Box,
        }
      } else {
        screen.interaction.mode = MODES.Drawing;
        screen.interaction.pos = pos;
        screen.interaction.subpos = subpos;
        setSubPx(subpos.x, subpos.y, fgColor);
      }
    } else if (e.button == 2) {
      if (screen.interaction.mode == MODES.Drawing) {
        screen.clearBuffer();
        screen.interaction = {
          mode: MODES.Idle,
          pos: pos,
          subpos: subpos,
        }
        render();
      }
    }
  },
  pointMove: (screen, e) => {
    let pos = getCharCoords(e);
    let subpos = getSubPxCoords(e);
    if (screen.interaction.mode == MODES.Idle) {
      screen.interaction.pos = pos;
      screen.interaction.subpos = subpos;
      render();
    } else if (screen.interaction.mode == MODES.Drawing) {
      if (!screen.interaction.type || screen.interaction.type == TYPES.Normal) {
        for (const [x, y] of line(screen.interaction.subpos.x, screen.interaction.subpos.y, subpos.x, subpos.y)) {
          setSubPx(x, y, fgColor);
        }
      }
      screen.interaction.pos = pos;
      screen.interaction.subpos = subpos;
      render();
    }
  },
  pointUp: (screen, e) => {
    let pos = getCharCoords(e);
    let subpos = getSubPxCoords(e);
    if (e.button == 0) {
      if (screen.interaction.mode == MODES.Drawing) {
        screen.interaction.subpos = subpos;
        draw.commit(screen);
        screen.interaction = {
          mode: MODES.Idle,
          pos: pos,
          subpos: subpos,
        };
      }
    }
  },
  render: (screen, bufferScreen) => {
    if (screen.interaction.subpos && 0 <= screen.interaction.pos.x
      && screen.interaction.pos.x < screen.size.width && 0 <= screen.interaction.pos.y && screen.interaction.pos.y < screen.size.height) {
      if (screen.interaction.mode == MODES.Idle || (screen.interaction.mode == MODES.Drawing && !screen.interaction.type || screen.interaction.type == TYPES.Normal)) {
        bufferScreen.ctx.fillStyle = screen.colors[screen.fgColor];
        bufferScreen.ctx.fillRect(
          screen.interaction.subpos.x * 3 + 1,
          screen.interaction.subpos.y * 3 + 1,
          3, 3,
        );
      } else if (screen.interaction.mode == MODES.Drawing && screen.interaction.type == TYPES.Line) {
        bufferScreen.ctx.fillStyle = screen.colors[screen.fgColor];
        for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
          bufferScreen.ctx.fillRect(
            x * 3 + 1,
            y * 3 + 1,
            3, 3,
          );
        }
      } else if (screen.interaction.mode == MODES.Drawing && screen.interaction.type == TYPES.Box) {
        bufferScreen.ctx.fillStyle = screen.colors[screen.fgColor];
        for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
          bufferScreen.ctx.fillRect(
            x * 3 + 1,
            y * 3 + 1,
            3, 3,
          );
        }
      }
    }
  },
  commit: (screen) => {
    if (screen.interaction.type == TYPES.Line) {
      for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
        setSubPx(x, y, screen.fgColor);
      }
    } else if (screen.interaction.type == TYPES.Box) {
      for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
        setSubPx(x, y, screen.fgColor);
      }
    }
    screen.commitBuffer();
  },
};


let size = SIZES.computer;
// let size = {width: 100, height: 5};

let screen = new TerminalScreen(size);
screen.interaction = { mode: MODES.Idle };
screen.fgColor = 0;
screen.bgColor = 15;
screen.selectedChar = 1;

let canvas = document.getElementById("screen");

canvas.width = screen.canvas.width;
canvas.height = screen.canvas.height;

let ctx = canvas.getContext('2d');
let bufferScreen = new ScreenRenderer(size, screen.colors, canvas);

let prop;
function make_fit() {
  let pannel = document.getElementById("screen_panel");
  let prop1 = pannel.offsetWidth / canvas.width;
  let prop2 = pannel.offsetHeight / canvas.height;
  prop = Math.min(prop1, prop2);
  canvas.style.width = canvas.width * prop + "px";
  canvas.style.height = canvas.height * prop + "px";
  canvas.style.visibility = "visible";
}

// make_fit()

window.onload = () => {
  updatePills();
  make_fit();
};
window.addEventListener("resize", () => { make_fit() })

function updateCSSColor() {
  document.documentElement.style.setProperty('--foreground-color', screen.colors[fgColor]);
  document.documentElement.style.setProperty('--background-color', screen.colors[bgColor]);
}

function updatePills() {
  for (let i = 0; i < 16; i++) {
    let color = Hct2.fromInt(argbFromHex2(screen.colors[i]));
    let elt = document.getElementById("fg" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
    if (color.tone <= 50) {
      elt.children[0].style.setProperty("color", "#FFF");
    } else {
      elt.children[0].style.setProperty("color", "#000");
    }
    elt.onclick = (e) => {
      if (interaction.mode == MODES.Selected) {
        commitInteraction();
        let minX = Math.min(interaction.point1.x, interaction.point2.x) + (interaction.offset ? interaction.offset.x : 0);
        let minY = Math.min(interaction.point1.y, interaction.point2.y) + (interaction.offset ? interaction.offset.y : 0);
        let width = Math.abs(interaction.point1.x - interaction.point2.x) + 1;
        let height = Math.abs(interaction.point1.y - interaction.point2.y) + 1;

        for (let j = 0; j < height; j++) {
          for (let k = 0; k < width; k++) {
            let char = screen.get(minX + k, minY + j);
            screen.drawChar(
              char.charId,
              minX + k, minY + j, i, char.bg,
            )
          }
        }
        screen.commitBuffer();
        render();
      } else {
        let elt = document.getElementById('fg' + fgColor);
        elt.firstChild.style.setProperty('visibility', 'hidden');
        fgColor = i;
        e.target.children[0].style.removeProperty('visibility');
        updateCSSColor();
      }
    }
    elt = document.getElementById("bg" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
    elt.onclick = (e) => {
      if (interaction.mode == MODES.Selected) {
        commitInteraction();
        let minX = Math.min(interaction.point1.x, interaction.point2.x) + (interaction.offset ? interaction.offset.x : 0);
        let minY = Math.min(interaction.point1.y, interaction.point2.y) + (interaction.offset ? interaction.offset.y : 0);
        let width = Math.abs(interaction.point1.x - interaction.point2.x) + 1;
        let height = Math.abs(interaction.point1.y - interaction.point2.y) + 1;

        for (let j = 0; j < height; j++) {
          for (let k = 0; k < width; k++) {
            let char = screen.get(minX + k, minY + j);
            screen.drawChar(
              char.charId,
              minX + k, minY + j, char.fg, i,
            )
          }
        }
        screen.commitBuffer();
        render();
      } else {
        let elt = document.getElementById('bg' + bgColor);
        elt.firstChild.style.setProperty('visibility', 'hidden');
        bgColor = i;
        e.target.children[0].style.removeProperty('visibility');
        updateCSSColor();
      }
    }
    if (color.tone <= 50) {
      elt.children[0].style.setProperty("color", "#FFF");
    } else {
      elt.children[0].style.setProperty("color", "#000");
    }
    elt = document.getElementById("p" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
  }
  updateCSSColor();
}

function addChars() {
  let container = document.getElementById("chars");
  let colorBg = getComputedStyle(document.body).getPropertyValue('--md-sys-color-surface-container-lowest');
  let colorFg = getComputedStyle(document.body).getPropertyValue('--md-sys-color-on-surface');
  let colors = DEFAULT_COLORS.slice();
  colors[COLOR_NAMES.white] = colorFg;
  colors[COLOR_NAMES.black] = "#00000000";
  let charScreen = new ScreenRenderer({ width: 1, height: 1 }, colors);
  // container.innerHTML = '';
  for (let charId = 0; charId < 16 * 16; charId++) {
    charScreen.ctx.clearRect(0, 0, charScreen.canvas.width, charScreen.canvas.height);
    charScreen.drawChar(charId, 0, 0);
    let button = document.createElement('md-icon-button');
    let img = new Image();
    img.src = charScreen.canvas.toDataURL();
    img.classList.add("char")
    button.appendChild(img);
    button.onclick = (e) => selectChar(charId)
    container.appendChild(button);
  }
}

function load() {
  addChars();
  screen.drawText("Hello world!", 0, 0, COLOR_NAMES.orange);
  screen.drawChar(8, 0, 1);
  screen.drawChar(8, 1, 1);
  render();
};



let TOOLS_BUTTONS = [
  document.getElementById("tool_place"),
  document.getElementById("tool_input_text"),
  document.getElementById("tool_select"),
  document.getElementById("tool_draw"),
];

let IMPL_TOOLS = [
  place,
  input_text,
  select,
  draw,
]

let interaction = { mode: MODES.Idle, pos: { x: 0, y: 0 }, text: '', point1: { x: 0, y: 0 }, point2: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, subpos: { x: 0, y: 0 }, type: 0 };
interaction = { mode: MODES.Idle };
// let interaction = { mode: MODES.Selecting, point1: {x: 1, y:1}, point2: {x:3, y:4} };
let tool = TOOLS.Place;
let selectedChar = 1;

function selectChar(charId) {
  if (tool == TOOLS.Place) {
    selectedChar = charId;
  } else if (interaction.mode == MODES.Selected) {
    commitInteraction();
    let minX = Math.min(interaction.point1.x, interaction.point2.x) + (interaction.offset ? interaction.offset.x : 0);
    let minY = Math.min(interaction.point1.y, interaction.point2.y) + (interaction.offset ? interaction.offset.y : 0);
    let width = Math.abs(interaction.point1.x - interaction.point2.x) + 1;
    let height = Math.abs(interaction.point1.y - interaction.point2.y) + 1;

    for (let j = 0; j < height; j++) {
      for (let k = 0; k < width; k++) {
        let char = screen.get(minX + k, minY + j);
        screen.drawChar(
          charId,
          minX + k, minY + j, char.fg, char.bg,
        )
      }
    }
    screen.commitBuffer();
  }
}

function commitInteraction() {
  if (IMPL_TOOLS[tool].commit) {
    IMPL_TOOLS[tool].commit(screen);
  } else if (interaction.mode == MODES.Drawing || interaction.mode == MODES.Placing) {
    screen.commitBuffer();
  }
}

export function setTool(newTool) {
  commitInteraction();
  if (tool == TOOLS.Draw && newTool != TOOLS.Draw) {
    document.getElementById('bg_button').removeAttribute('disabled');
    for (let i = 0; i < 16; i++) {
      document.getElementById('bg' + i).removeAttribute('disabled');
    }
  } else if (newTool == TOOLS.Draw && tool != TOOLS.Draw) {
    document.getElementById('bg_button').setAttribute('disabled', "true");
    for (let i = 0; i < 16; i++) {
      document.getElementById('bg' + i).setAttribute('disabled', "true");
    }
  }
  tool = newTool;
  screen.interaction = { mode: MODES.Idle };
  TOOLS_BUTTONS.forEach(button => {
    button.classList.remove('selected-tool');
  })
  TOOLS_BUTTONS[newTool].classList.add('selected-tool');
  render();
}

let fgColor = COLOR_NAMES.white;
let bgColor = COLOR_NAMES.black;

const SELECTION_COLOR = DEFAULT_COLORS[COLOR_NAMES.yellow];

let cursor = { shown: true, latestUpdate: null }

function cursorInBoundingBox() {
  if (!screen.interaction.point1 || !screen.interaction.point2 || !screen.interaction.pos) {
    return false;
  } else {
    let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
    let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;
    let originX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
    let originY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
    return (screen.interaction.pos.x >= originX && screen.interaction.pos.x < originX + width
      && screen.interaction.pos.y >= originY && screen.interaction.pos.y < originY + height);
  }
}

function render() {
  if (tool == TOOLS.Select && (screen.interaction.mode == MODES.Idle || screen.interaction.mode == MODES.Selecting)) {
    canvas.style.cursor = "crosshair";
  } else if (tool == TOOLS.Select && screen.interaction.mode == MODES.Selected && cursorInBoundingBox()) {
    canvas.style.cursor = "grab";
  } else if (screen.interaction.mode == MODES.MovingSelection) {
    canvas.style.cursor = "grabbing";
  } else if (tool == TOOLS.Write && screen.interaction.mode == MODES.Idle) {
    canvas.style.cursor = "text";
  } else {
    canvas.style.cursor = "";
  }
  ctx.drawImage(screen.canvas, 0, 0, canvas.width, canvas.height);

  if (IMPL_TOOLS[tool].render) {
    IMPL_TOOLS[tool].render(screen, bufferScreen);
  } else {
    if (tool == TOOLS.Draw && interaction.subpos && 0 <= interaction.pos.x && interaction.pos.x < screen.size.width && 0 <= interaction.pos.y && interaction.pos.y < screen.size.height) {
      if (!interaction.type || interaction.type == TYPES.Normal) {
        ctx.fillStyle = screen.colors[fgColor];
        let sbpx = interaction.subpos.x % 2;
        let sbpy = interaction.subpos.y % 3;
        ctx.fillRect(
          interaction.pos.x * 6 + sbpx * 3 + 1,
          interaction.pos.y * 9 + sbpy * 3 + 1,
          3, 3,
        );
      } else if (interaction.type == TYPES.Line) {
        ctx.fillStyle = screen.colors[fgColor];
        for (const [x, y] of line(interaction.point1.x, interaction.point1.y, interaction.subpos.x, interaction.subpos.y)) {
          ctx.fillRect(
            x * 3 + 1,
            y * 3 + 1,
            3, 3,
          );
        }
      } else if (interaction.type == TYPES.Box) {
        ctx.fillStyle = screen.colors[fgColor];
        for (const [x, y] of box(interaction.point1.x, interaction.point1.y, interaction.subpos.x, interaction.subpos.y)) {
          ctx.fillRect(
            x * 3 + 1,
            y * 3 + 1,
            3, 3,
          );
        }
      }
    } else if (interaction.mode == MODES.Selecting || interaction.mode == MODES.Selected || interaction.mode == MODES.MovingSelection) {
      // let offsetX = interaction.offset ? interaction.offset.x : 0;
      // let offsetY = interaction.offset ? interaction.offset.y : 0;
      // let minX = Math.min(interaction.point1.x, interaction.point2.x) * 6 + offsetX * 6 + 1;
      // let maxX = Math.max(interaction.point1.x, interaction.point2.x) * 6 + offsetX * 6 + 6;
      // let minY = Math.min(interaction.point1.y, interaction.point2.y) * 9 + offsetY * 9 + 1;
      // let maxY = Math.max(interaction.point1.y, interaction.point2.y) * 9 + offsetY * 9 + 9;

      // if (interaction.area) {
      //   ctx.drawImage(interaction.area, minX, minY);
      // }

      // ctx.fillStyle = SELECTION_COLOR;
      // ctx.fillRect(minX, minY, 2, 2);
      // ctx.fillRect(minX, maxY - 1, 2, 2);
      // ctx.fillRect(maxX - 1, maxY - 1, 2, 2);
      // ctx.fillRect(maxX - 1, minY, 2, 2);
      // for (let i = 4; i < Math.abs(minX - maxX) / 2; i += 3) {
      //   ctx.fillRect(minX + i, minY, 1, 1);
      //   ctx.fillRect(maxX - i, minY, 1, 1);
      //   ctx.fillRect(minX + i, maxY, 1, 1);
      //   ctx.fillRect(maxX - i, maxY, 1, 1);
      // }
      // for (let i = 4; i <= Math.abs(minY - maxY) / 2; i += 3) {
      //   ctx.fillRect(minX, minY + i, 1, 1);
      //   ctx.fillRect(minX, maxY - i, 1, 1);
      //   ctx.fillRect(maxX, minY + i, 1, 1);
      //   ctx.fillRect(maxX, maxY - i, 1, 1);
      // }
    }
  }
}

function refreshBlink() {
  // This is only used to update the blinking cursor for text input
  window.setTimeout(refreshBlink, 650);
  if (cursor.latestUpdate) {
    if (Date.now() - cursor.latestUpdate >= 1000) {
      cursor.shown = false;
      cursor.latestUpdate = null;
      render();
    }
  } else {
    cursor.shown = !cursor.shown;
    render();
  }
}

refreshBlink()

function resetBlink() {
  cursor.shown = true;
  cursor.latestUpdate = Date.now();
}

// document.onload = () => {console.log("load"); render(); updatePills()};

function getRelativeCoords(event) {
  return { x: ~~(event.offsetX / prop), y: ~~(event.offsetY / prop) };
}
function getCharCoords(event) {
  let pos = getRelativeCoords(event);
  return {
    x: ~~((pos.x - 1) / 6),
    y: ~~((pos.y - 1) / 9),
  }
}
function getSubPxCoords(event) {
  let pos = getRelativeCoords(event);
  return {
    x: ~~((pos.x - 1) / 3),
    y: ~~((pos.y - 1) / 3),
  }
}

function setSubPx(sx, sy, color) {
  let x = ~~(sx / 2);
  let y = ~~(sy / 3);
  if (0 <= x && x < screen.size.width && 0 <= y && y < screen.size.height) {
    sx = sx % 2;
    sy = sy % 3;
    let char = screen.get(x, y);
    let px = new SubPx(char.charId, char.fg, char.bg);
    px.set(sx, sy, color);
    let [valid, newChar] = px.toChar();
    if (valid) {
      screen.drawChar(newChar.charId, x, y, newChar.fg, newChar.bg);
    }
  }
}

function pointMove(e) {
  if (IMPL_TOOLS[tool].pointMove) {
    IMPL_TOOLS[tool].pointMove(screen, e);
  }
  // else {
  //   let pos = getCharCoords(e);
  //   if (interaction.mode == MODES.Idle || interaction.mode == MODES.Selected) {
  //     interaction.pos = pos;
  //     if (tool == TOOLS.Draw) {
  //       interaction.subpos = getSubPxCoords(e);
  //     }
  //     render();
  //   } else if (interaction.mode == MODES.Drawing) {
  //     let subpos = getSubPxCoords(e);
  //     if (!interaction.type || interaction.type == TYPES.Normal) {
  //       for (const [x, y] of line(interaction.subpos.x, interaction.subpos.y, subpos.x, subpos.y)) {
  //         setSubPx(x, y, fgColor);
  //       }
  //     }
  //     interaction.pos = pos;
  //     interaction.subpos = subpos;
  //     render();
  //   }
  // }
}

function pointDown(e) {
  if (IMPL_TOOLS[tool].pointDown) {
    IMPL_TOOLS[tool].pointDown(screen, e);
  }
  // else {
  //   let pos = getCharCoords(e);
  //   if (e.button == 0) {
  //     if (interaction.mode == MODES.Idle) {
  //       if (tool == TOOLS.Select && interaction.mode == MODES.Idle) {
  //         // interaction = {
  //         //   mode: MODES.Selecting,
  //         //   point1: pos,
  //         //   point2: pos,
  //         // };
  //       } else if (tool == TOOLS.Draw) {
  //         // if (e.shiftKey) {
  //         //   interaction = {
  //         //     mode: MODES.Drawing,
  //         //     pos: pos,
  //         //     point1: getSubPxCoords(e),
  //         //     subpos: getSubPxCoords(e),
  //         //     type: TYPES.Line,
  //         //   }
  //         // } else if (e.ctrlKey) {
  //         //   interaction = {
  //         //     mode: MODES.Drawing,
  //         //     pos: pos,
  //         //     point1: getSubPxCoords(e),
  //         //     subpos: getSubPxCoords(e),
  //         //     type: TYPES.Box,
  //         //   }
  //         // } else {
  //         //   interaction.mode = MODES.Drawing;
  //         //   interaction.pos = pos;
  //         //   interaction.subpos = getSubPxCoords(e)
  //         //   setSubPx(interaction.subpos.x, interaction.subpos.y, fgColor);
  //         // }
  //       }
  //     } else if (interaction.mode == MODES.Selected) {
  //       // let width = Math.abs(interaction.point1.x - interaction.point2.x) + 1;
  //       // let height = Math.abs(interaction.point1.y - interaction.point2.y) + 1;
  //       // let originX = Math.min(interaction.point1.x, interaction.point2.x) + (interaction.offset ? interaction.offset.x : 0);
  //       // let originY = Math.min(interaction.point1.y, interaction.point2.y) + (interaction.offset ? interaction.offset.y : 0);

  //       // if (pos.x >= originX && pos.x < originX + width
  //       //   && pos.y >= originY && pos.y < originY + height) {
  //       //   interaction.mode = MODES.MovingSelection;
  //       //   interaction.pos = pos;
  //       //   if (!interaction.offset) {
  //       //     interaction.offset = { x: 0, y: 0 };
  //       //   }


  //       //   if (!interaction.data) {
  //       //     let area = document.createElement('canvas');
  //       //     area.width = width * 6;
  //       //     area.height = height * 9;
  //       //     let areaCtx = area.getContext('2d');
  //       //     areaCtx.drawImage(screen.canvas, originX * 6 + 1, originY * 9 + 1, width * 6, height * 9, 0, 0, width * 6, height * 9);
  //       //     interaction.area = area;

  //       //     let data = [];
  //       //     for (var i = 0; i < height; i++) {
  //       //       data.push([]);
  //       //       data[i].push(new Array(width));
  //       //       for (var j = 0; j < width; j++) {
  //       //         let char = screen.get(originX + j, originY + i);
  //       //         data[i][j] = {
  //       //           charId: char.charId,
  //       //           fg: char.fg,
  //       //           bg: char.bg,
  //       //         };
  //       //         screen.drawChar(32, originX + j, originY + i, fgColor, bgColor);
  //       //       }
  //       //     }
  //       //     interaction.data = data;
  //       //   }
  //       // } else {
  //       //   commitInteraction();
  //       //   interaction = {
  //       //     mode: MODES.Idle,
  //       //   };
  //       //   render();
  //       // }
  //     }
  //     render();
  //   } else if (e.button == 2) {
  //     if (interaction.mode == MODES.Placing) {
  //     } else if (interaction.mode == MODES.Drawing) {
  //       screen.clearBuffer();
  //       interaction = {
  //         mode: MODES.Idle,
  //         pos: getRelativeCoords(e),
  //         subpos: getSubPxCoords(e),
  //       }
  //       render();
  //     } else if (tool == TOOLS.Select && interaction.mode != MODES.Idle) {
  //       // interaction.offset = { x: 0, y: 0 };
  //       // commitInteraction();
  //       interaction = { mode: MODES.Idle, pos: getRelativeCoords(e) };
  //       screen.clearBuffer();
  //       render();
  //     }
  //   }
  // }
}

function pointUp(e) {
  if (IMPL_TOOLS[tool].pointUp) {
    IMPL_TOOLS[tool].pointUp(screen, e);
  }
//   else {
//     let pos = getCharCoords(e);
//     if (e.button == 0) {
//       if (interaction.mode == MODES.Placing) {
//         // if (interaction.type == TYPES.Line) {
//         //   for (const [x, y] of line(interaction.point1.x, interaction.point1.y, interaction.pos.x, interaction.pos.y)) {
//         //     screen.drawChar(selectedChar, x, y, fgColor, bgColor);
//         //   }
//         // } else if (interaction.type == TYPES.Box) {
//         //   for (const [x, y] of box(interaction.point1.x, interaction.point1.y, interaction.pos.x, interaction.pos.y)) {
//         //     screen.drawChar(selectedChar, x, y, fgColor, bgColor);
//         //   }
//         // }
//         // // screen.drawChar(selectedChar, interaction.pos.x, interaction.pos.y, fgColor, bgColor);
//         // screen.commitBuffer();
//         // interaction = {
//         //   mode: MODES.Idle,
//         //   pos: pos,
//         // }
//         // render();
//       } else if (interaction.mode == MODES.Selecting) {
//         interaction.mode = MODES.Selected;
//         render();
//       } else if (interaction.mode == MODES.MovingSelection) {
//         // interaction.point1.x = interaction.point1.x + interaction.offset.x;
//         // interaction.point2.x = interaction.point2.x + interaction.offset.x;
//         // interaction.point1.y = interaction.point1.y + interaction.offset.y;
//         // interaction.point2.y = interaction.point2.y + interaction.offset.y;
//         interaction.mode = MODES.Selected;
//       } else if (interaction.mode == MODES.Drawing) {
//         let subpos = getSubPxCoords(e);
//         if (interaction.type == TYPES.Line) {
//           for (const [x, y] of line(interaction.point1.x, interaction.point1.y, subpos.x, subpos.y)) {
//             setSubPx(x, y, fgColor);
//           }
//         } else if (interaction.type == TYPES.Box) {
//           for (const [x, y] of box(interaction.point1.x, interaction.point1.y, subpos.x, subpos.y)) {
//             setSubPx(x, y, fgColor);
//           }
//         }
//         screen.commitBuffer();
//         interaction = {
//           mode: MODES.Idle,
//           pos: pos,
//           subpos: subpos
//         };
//       }
//     }
//   }
}

function executeKeybinds(e) {
  if (e.key == "s") {
    setTool(TOOLS.Select);
  } else if (e.key == "t") {
    setTool(TOOLS.Write);
  } else if (e.key == "n" || e.key == "p") {
    setTool(TOOLS.Place);
  } else if (e.key == "d") {
    setTool(TOOLS.Draw);
  }
}

function keyDown(e) {
  if (IMPL_TOOLS[tool].keyDown) {
    IMPL_TOOLS[tool].keyDown(screen, e);
  // } else if (interaction.mode == MODES.Writing && !e.ctrlKey && !e.metaKey && !e.altKey) {
  //   e.preventDefault();
  //   if (e.key == "Backspace") {
  //     interaction.text = interaction.text.slice(0, -1);
  //     resetBlink();
  //     render();
  //   } else if (e.key == "Enter" && !e.shiftKey) {
  //     screen.drawText(interaction.text, interaction.pos.x, interaction.pos.y, fgColor, bgColor);
  //     screen.commitBuffer();
  //     interaction = { mode: MODES.Idle };
  //     render();
  //   } else if (e.key == "Enter" && e.shiftKey) {
  //     let dy = (interaction.text.match(/\n/g) || []).length;
  //     if (interaction.pos.y + dy < screen.size.height - 1) {
  //       interaction.text += "\n";
  //       resetBlink();
  //       render();
  //     }
  //   } else if (e.key == "Escape") {
  //     interaction = { mode: MODES.Idle };
  //     render();
  //   } else if (e.key.length == 1) {
  //     let dx = interaction.text.split('\n').at(-1).length;
  //     if (interaction.pos.x + dx < screen.size.width) {
  //       interaction.text = interaction.text + e.key;
  //       resetBlink();
  //       render();
  //     }
  //   } else {
  //     executeKeybinds(e);
  //   }
  // } else if (interaction.mode == MODES.Selected) {
  //   if (e.key == "Escape") {
  //     commitInteraction();
  //     interaction = { mode: MODES.Idle };
  //     render();
  //   } else if (e.key == "Delete" || e.key == "Backspace") {
  //     commitInteraction();
  //     let width = Math.abs(interaction.point1.x - interaction.point2.x) + 1;
  //     let height = Math.abs(interaction.point1.y - interaction.point2.y) + 1;
  //     let originX = Math.min(interaction.point1.x, interaction.point2.x) + (interaction.offset ? interaction.offset.x : 0);
  //     let originY = Math.min(interaction.point1.y, interaction.point2.y) + (interaction.offset ? interaction.offset.y : 0);
  //     for (let y = originY; y < originY + height; y++) {
  //       for (let x = originX; x < originX + width; x++) {
  //         screen.drawChar(32, x, y, fgColor, bgColor);
  //       }
  //     }
  //     screen.commitBuffer();
  //     render();
  //   } else {
  //     executeKeybinds(e);
  //   }
  } else {
    executeKeybinds(e);
  }
}

canvas.addEventListener("mousemove", pointMove);
canvas.addEventListener("mousedown", pointDown);
canvas.addEventListener("mouseup", pointUp);
document.addEventListener("keydown", keyDown);
canvas.addEventListener("mouseleave", (event) => {
  if (interaction.mode == MODES.Idle) {
    interaction = { mode: 0 }; render();
  }
})
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
})

if (FONT.complete) {
  load();
} else {
  FONT.onload(load);
}
