import { SIZES, FONT, ScreenRenderer, COLOR_NAMES, DEFAULT_COLORS, SIZE_TYPES } from "./renderer.js";
import { Hct, argbFromHex } from './utils.js';
import { TerminalScreen, bimgExport, bimgImport } from "./screen.js";

import { serialize } from './textutils.js';
// 
// console.log(serialize({
//   'a': 1,
//   'b': 4,
//   'c': {
//     'd': "abcd",
//   },
//   "hello world": 'hello \"world"',
// }));

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
      screen.drawText(screen.interaction.text, screen.interaction.pos.x, screen.interaction.pos.y, screen.fgColor, screen.bgColor);
      screen.commitBuffer();
    }
  },
}

let select = {
  inBoundingBox(screen) {
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
  },
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
            areaCtx.drawImage(screen.canvas, originX * 6 + screen.border, originY * 9 + screen.border, width * 6, height * 9, 0, 0, width * 6, height * 9);
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
      if (screen.interaction.mode != MODES.Idle) {
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
      // we need to implement all this stuff here in order to improve performance on Chrome
      for (let y = Math.max(0, originY); y < Math.min(originY + height, screen.size.height); y++) {
        for (let x = Math.max(originX, 0); x < Math.min(originX + width, screen.size.width); x++) {
          screen.buffer[[y, x]] = {
            charId: 32,
            fg: screen.fgColor,
            bg: screen.bgColor,
          }
        }
      }
      screen.commitBuffer(true, false);
      screen.ctx.fillStyle = screen.colors[screen.bgColor];
      screen.ctx.fillRect(Math.max(originX, 0) * 6 + screen.border, Math.max(originY, 0) * 9 + screen.border,
        Math.min(width, screen.size.width - originX) * 6, Math.min(height, screen.size.height - originY) * 9,
      );
      screen.save();
      render();
    } else {
      executeKeybinds(e);
    }
  },
  render: (screen, bufferScreen) => {
    if (screen.interaction.mode == MODES.Selecting || screen.interaction.mode == MODES.Selected || screen.interaction.mode == MODES.MovingSelection) {
      let offsetX = screen.interaction.offset ? screen.interaction.offset.x : 0;
      let offsetY = screen.interaction.offset ? screen.interaction.offset.y : 0;
      let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) * 6 + offsetX * 6 + screen.border;
      let maxX = Math.max(screen.interaction.point1.x, screen.interaction.point2.x) * 6 + offsetX * 6 + 5 + screen.border;
      let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) * 9 + offsetY * 9 + screen.border;
      let maxY = Math.max(screen.interaction.point1.y, screen.interaction.point2.y) * 9 + offsetY * 9 + 8 + screen.border;

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
        screen.drawSubPx(subpos.x, subpos.y, screen.fgColor);
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
          screen.drawSubPx(x, y, screen.fgColor);
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
          screen.interaction.subpos.x * 3 + screen.border,
          screen.interaction.subpos.y * 3 + screen.border,
          3, 3,
        );
      } else if (screen.interaction.mode == MODES.Drawing && screen.interaction.type == TYPES.Line) {
        bufferScreen.ctx.fillStyle = screen.colors[screen.fgColor];
        for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
          bufferScreen.ctx.fillRect(
            x * 3 + screen.border,
            y * 3 + screen.border,
            3, 3,
          );
        }
      } else if (screen.interaction.mode == MODES.Drawing && screen.interaction.type == TYPES.Box) {
        bufferScreen.ctx.fillStyle = screen.colors[screen.fgColor];
        for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
          bufferScreen.ctx.fillRect(
            x * 3 + screen.border,
            y * 3 + screen.border,
            3, 3,
          );
        }
      }
    }
  },
  commit: (screen) => {
    if (screen.interaction.type == TYPES.Line) {
      for (const [x, y] of line(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
        screen.drawSubPx(x, y, screen.fgColor);
      }
    } else if (screen.interaction.type == TYPES.Box) {
      for (const [x, y] of box(screen.interaction.point1.x, screen.interaction.point1.y, screen.interaction.subpos.x, screen.interaction.subpos.y)) {
        screen.drawSubPx(x, y, screen.fgColor);
      }
    }
    screen.commitBuffer();
  },
};

let size = SIZES.computer;
// let size = {width: 100, height: 5};

let screen;
let loadingId = window.localStorage.getItem("lastOpened");
loadingId = loadingId ? loadingId : "entry";

let projects = JSON.parse(window.localStorage.getItem("projects"));
projects = projects ? projects : [];
function saveProjects() {
  window.localStorage.setItem("projects", JSON.stringify(projects));
}

let canvas = document.getElementById("screen");
let ctx = canvas.getContext('2d');

let bufferScreen;

function openProject(id) {
  let data = JSON.parse(window.localStorage.getItem('s' + id));
  if (data == null) {
    screen = new TerminalScreen(size, undefined, 2, id, "My Project");
  } else {
    screen = TerminalScreen.unserialise(data, id, 2);
  }
  if (screen.name) {
    document.title = screen.name + " - Prototuipe"
  }

  screen.interaction = { mode: MODES.Idle };
  screen.fgColor = 0;
  screen.bgColor = 15;
  screen.selectedChar = 1;
  canvas.width = screen.canvas.width;
  canvas.height = screen.canvas.height;
  bufferScreen = new ScreenRenderer(size, screen.colors, canvas, 2);

  window.localStorage.setItem("lastOpened", id);
  if (!projects.includes(id)) {
    projects.push(id);
    saveProjects();
  }
  document.getElementById("properties").close();
  document.getElementById("delete_confirmation").close();
  document.getElementById("projects_dialog").close();
}

openProject(loadingId);

let prop;
function setDefaultProp() {
  let pannel = document.getElementById("screen_panel");

  let prop1 = pannel.offsetWidth / canvas.width;
  let prop2 = pannel.offsetHeight / canvas.height;
  setProp(Math.min(prop1, prop2));
}
function setProp(value) {
  prop = Math.min(Math.max(value, 0.5), 100);
  canvas.style.setProperty('--prop', prop + "px");
}
function getProp() { return prop; }

let pos_x, pos_y
function setPos() {
  canvas.style.setProperty('--pos-x', pos_x);
  canvas.style.setProperty('--pos-y', pos_y);
}
function setDefaultPos() {
  let baseWidth = screen.size.width * 6 + screen.border * 2;
  let baseHeight = screen.size.height * 9 + screen.border * 2;
  pos_x = baseWidth / 2;
  pos_y = baseHeight / 2;
  setPos();
}
function addPos(x, y) {
  pos_x += x;
  pos_y += y;
  setPos();
}

function make_fit() {
  let baseWidth = screen.size.width * 6 + screen.border * 2;
  let baseHeight = screen.size.height * 9 + screen.border * 2;
  canvas.style.setProperty('--base-width', baseWidth);
  canvas.style.setProperty('--base-height', baseHeight);
  setDefaultPos();

  setDefaultProp();
  canvas.style.visibility = "visible";
}

function zoom(scale) {
  setProp(getProp() * scale);
};
document.getElementById("zoom_in").addEventListener("click", () => { zoom(1.2) });
document.getElementById("reset_zoom").addEventListener("click", make_fit);
document.getElementById("zoom_out").addEventListener("click", () => { zoom(1 / 1.2) });
window.addEventListener("auxclick", (e) => { e.preventDefault(); });
document.getElementById("screen_panel").addEventListener("pointermove", (e) => {
  if (e.buttons == 2) {
    addPos(-e.movementX / prop, -e.movementY / prop);
  }
});

window.onload = () => {
  updatePills();
  make_fit();
};
window.addEventListener("resize", () => { make_fit() });
window.addEventListener("storage", (e) => {
  if (e.key == "projects") {
    projects = JSON.parse(e.newValue);
    if (document.getElementById("projects_dialog").open) {
      openProjects();
    }
  } else if (e.key == "s" + screen.id) {
    if (e.newValue) {
      openProject(screen.id);
      screen.render();
      make_fit();
      render();
      updatePills();
    } else {
      projects = JSON.parse(window.localStorage.getItem("projects"));
      if (projects.length > 0) {
        openProject(projects[0]);
      } else {
        openProject(loadingId);
      }
      screen.render();
      screen.save();
      make_fit();
      render();
      updatePills();
    }
  }
});

function updateCSSColor() {
  document.documentElement.style.setProperty('--foreground-color', screen.colors[screen.fgColor]);
  document.documentElement.style.setProperty('--background-color', screen.colors[screen.bgColor]);
}

function updatePills() {
  for (let i = 0; i < 16; i++) {
    let color = Hct.fromInt(argbFromHex(screen.colors[i]));
    let elt = document.getElementById("fg" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
    if (color.tone <= 50) {
      elt.children[0].style.setProperty("color", "#FFF");
    } else {
      elt.children[0].style.setProperty("color", "#000");
    }
    elt.onclick = (e) => {
      if (screen.interaction.mode == MODES.Selected) {
        commitInteraction();
        let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
        let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
        let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
        let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;

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
        let elt = document.getElementById('fg' + screen.fgColor);
        elt.firstChild.style.setProperty('visibility', 'hidden');
        screen.fgColor = i;
        e.target.children[0].style.removeProperty('visibility');
        updateCSSColor();
      }
    }
    elt = document.getElementById("bg" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
    elt.onclick = (e) => {
      if (screen.interaction.mode == MODES.Selected) {
        commitInteraction();
        let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
        let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
        let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
        let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;

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
        let elt = document.getElementById('bg' + screen.bgColor);
        elt.firstChild.style.setProperty('visibility', 'hidden');
        screen.bgColor = i;
        e.target.children[0].style.removeProperty('visibility');
        updateCSSColor();
      }
    }
    if (color.tone <= 50) {
      elt.children[0].style.setProperty("color", "#FFF");
    } else {
      elt.children[0].style.setProperty("color", "#000");
    }
    // elt = document.getElementById("gp" + i);
    // elt.style.setProperty("--md-filled-icon-button-container-color", screen.colors[i]);
    // elt.style.setProperty("--md-filled-icon-button-disabled-container-color", screen.colors[i]);
  }
  updateCSSColor();
}

function addChars() {
  let container = document.getElementById("chars");
  let colorFg = getComputedStyle(document.body).getPropertyValue('--md-sys-color-on-surface');
  let colors = DEFAULT_COLORS.slice();
  colors[COLOR_NAMES.white] = colorFg;
  colors[COLOR_NAMES.black] = "#00000000";
  let charScreen = new ScreenRenderer({ width: 1, height: 1 }, colors);
  container.innerHTML = '';
  for (let charId = 0; charId < 16 * 16; charId++) {
    charScreen.ctx.clearRect(0, 0, charScreen.canvas.width, charScreen.canvas.height);
    charScreen.drawChar(charId, 0, 0);
    let button = document.createElement('md-icon-button');
    let img = new Image();
    img.src = charScreen.canvas.toDataURL();
    img.classList.add("char")
    button.appendChild(img);
    button.onclick = () => selectChar(charId)
    container.appendChild(button);
  }
  container.dispatchEvent(new Event('scroll'));
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', addChars)

function load() {
  addChars();
  // screen.drawText("Hello world!", 0, 0, COLOR_NAMES.orange);
  // screen.drawChar(8, 0, 1);
  // screen.drawChar(8, 1, 1);
  // screen.commitBuffer();
  screen.render();
  render();
};

export function setTool(newTool) {
  commitInteraction();
  if (tool == TOOLS.Draw && newTool != TOOLS.Draw) {
    document.getElementById('bg_icon').style.opacity = 1;
    for (let i = 0; i < 16; i++) {
      document.getElementById('bg' + i).removeAttribute('disabled');
    }
  } else if (newTool == TOOLS.Draw && tool != TOOLS.Draw) {
    document.getElementById('bg_icon').style.opacity = 0.38;
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

let TOOLS_BUTTONS = [
  document.getElementById("tool_place"),
  document.getElementById("tool_input_text"),
  document.getElementById("tool_select"),
  document.getElementById("tool_draw"),
];

TOOLS_BUTTONS[TOOLS.Place].onclick = (e) => { setTool(TOOLS.Place) };
TOOLS_BUTTONS[TOOLS.Write].onclick = (e) => { setTool(TOOLS.Write) };
TOOLS_BUTTONS[TOOLS.Select].onclick = (e) => { setTool(TOOLS.Select) };
TOOLS_BUTTONS[TOOLS.Draw].onclick = (e) => { setTool(TOOLS.Draw) };

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

function selectChar(charId) {
  if (screen.interaction.mode == MODES.Selected) {
    commitInteraction();
    let minX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
    let minY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
    let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
    let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;

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
  } else {
    screen.selectedChar = charId;
  }
}

function commitInteraction() {
  if (IMPL_TOOLS[tool].commit) {
    IMPL_TOOLS[tool].commit(screen);
  }
}

function undo() {
  screen.interaction = { mode: MODES.Idle };
  screen.clearBuffer();
  screen.history.undo();
  render();
}
document.getElementById("undo").addEventListener('click', undo);

function redo() {
  screen.interaction = { mode: MODES.Idle };
  screen.clearBuffer();
  screen.history.redo();
  render();
}
document.getElementById("redo").addEventListener('click', redo);

const SELECTION_COLOR = DEFAULT_COLORS[COLOR_NAMES.yellow];

let cursor = { shown: true, latestUpdate: null }

function render() {
  // This section could be moved in the tools render functions, but it's simpler this way for now at least
  if (tool == TOOLS.Select && (screen.interaction.mode == MODES.Idle || screen.interaction.mode == MODES.Selecting)) {
    canvas.style.cursor = "crosshair";
  } else if (tool == TOOLS.Select && screen.interaction.mode == MODES.Selected && select.inBoundingBox(screen)) {
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
  }
}

function refreshBlink() {
  // This is only used to update the blinking cursor for text input
  // window.setTimeout(refreshBlink, 650);
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

setInterval(refreshBlink, 650)

function resetBlink() {
  cursor.shown = true;
  cursor.latestUpdate = Date.now();
}

function pointMove(e) {
  if (IMPL_TOOLS[tool].pointMove) {
    IMPL_TOOLS[tool].pointMove(screen, e);
  }
}

function pointDown(e) {
  if (IMPL_TOOLS[tool].pointDown) {
    IMPL_TOOLS[tool].pointDown(screen, e);
  }
}

function pointUp(e) {
  if (IMPL_TOOLS[tool].pointUp) {
    IMPL_TOOLS[tool].pointUp(screen, e);
  }
}


function executeKeybinds(e) {
  if (e.ctrlKey && e.key == "z") {
    undo();
  } else if (e.ctrlKey && e.key == "y") {
    redo();
  } else if (e.key == "s") {
    setTool(TOOLS.Select);
  } else if (e.key == "t") {
    setTool(TOOLS.Write);
  } else if (e.key == "n" || e.key == "p") {
    setTool(TOOLS.Place);
  } else if (e.key == "d") {
    setTool(TOOLS.Draw);
  } else if (e.key == "a") {
    make_fit();
  }
}

let properties = document.getElementById('properties');
function keyDown(e) {
  if (!properties.open) {
    if (IMPL_TOOLS[tool].keyDown) {
      IMPL_TOOLS[tool].keyDown(screen, e);
    } else {
      executeKeybinds(e);
    }
  }
}

canvas.addEventListener("pointermove", pointMove);
canvas.addEventListener("pointerdown", pointDown);
canvas.addEventListener("pointerup", pointUp);
document.addEventListener("keydown", keyDown);
document.getElementById('screen_panel').addEventListener("wheel", (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    setProp(getProp() * (1 - e.deltaY / 500));
  } else {
    e.preventDefault();
    if (e.shiftKey) {
      addPos(e.deltaY / 5, e.deltaX / 5);
    } else {
      addPos(e.deltaX / 5, e.deltaY / 5);
    }
  }
  pointMove(e);
});

canvas.addEventListener('touchstart', function(e) { e.preventDefault() }, false);
canvas.addEventListener('touchmove', function(e) { e.preventDefault() }, false);

canvas.addEventListener("pointerout", (event) => {
  if (screen.interaction.mode == MODES.Idle) {
    screen.interaction = { mode: MODES.Idle };
    render();
  }
});
canvas.addEventListener("mousedown", (e) => {
  let pos = getCharCoords(e);
  let subpos = getSubPxCoords(e);
  if (tool == TOOLS.Place) {
    if (e.button == 2) {
      screen.clearBuffer();
      screen.interaction = {
        mode: MODES.Idle,
        pos: getCharCoords(e),
      };
      render();
    }
  } else if (tool == TOOLS.Draw) {
    if (e.button == 2) {
      if (screen.interaction.mode == MODES.Drawing) {
        e.preventDefault();
        screen.clearBuffer();
        screen.interaction = {
          mode: MODES.Idle,
          pos: pos,
          subpos: subpos,
        }
        render();
      }
    }
  }
});
document.getElementById('screen_panel').addEventListener("contextmenu", (event) => {
  event.preventDefault();
})
window.addEventListener("copy", (e) => {
  if (tool == TOOLS.Select && screen.interaction.mode == MODES.Selected) {
    e.preventDefault();
    let width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
    let height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;
    let originX = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
    let originY = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
    let img = bimgExport(screen, width, height, originX, originY);
    e.clipboardData.setData('text/plain', JSON.stringify(img));
  }
})
window.addEventListener("paste", (e) => {
  e.preventDefault();
  let rawdata = e.clipboardData.getData('text/plain');
  try {
    let data = JSON.parse(rawdata);
    let pos = screen.interaction.pos ? screen.interaction.pos : { x: 0, y: 0 };
    setTool(TOOLS.Select);
    let pastedScreen = bimgImport(data);
    pastedScreen.commitBuffer();
    screen.interaction = {
      mode: MODES.Selected,
      pos: pos,
      point1: pos,
      point2: { x: pos.x + pastedScreen.size.width - 1, y: pos.y + pastedScreen.size.height - 1 },
      data: pastedScreen.screen,
      area: pastedScreen.canvas,
      offset: { x: 0, y: 0 },
    }
    render();
  } catch {
    console.log("data wasn't an image");
  }
})

if (FONT.complete) {
  load();
} else {
  FONT.onload = load;
}

function selectSizeType(type) {
  let sizeSelect = document.getElementById("size_select");
  sizeSelect.childNodes.forEach((elt) => { elt.selected = elt.value == type });
  let width = document.getElementById("size_width");
  let height = document.getElementById("size_height");
  let scale = document.getElementById("size_scale");
  if (type == null || type == SIZE_TYPES.Custom) {
    scale.disabled = true;
    width.disabled = false;
    height.disabled = false;
    width.value = screen.size.width;
    height.value = screen.size.height;
    scale.childNodes.forEach((elt) => { elt.selected = elt.value == 1 });
  } else if (type == SIZE_TYPES.Monitor) {
    scale.disabled = false;
    width.disabled = false;
    height.disabled = false;
    let monitorScale = screen.size.scale ? screen.size.scale : 1;
    scale.childNodes.forEach((elt) => {
      elt.selected = elt.value == monitorScale;
    });
    width.value = screen.size.mwidth ? screen.size.mwidth : 1;
    height.value = screen.size.mheight ? screen.size.mheight : 1;
  } else {
    scale.disabled = true;
    width.disabled = true;
    height.disabled = true;
    scale.childNodes.forEach((elt) => { elt.selected = elt.value == 1 });
    if (type == SIZE_TYPES.Computer) {
      width.value = SIZES.computer.width;
      height.value = SIZES.computer.height;
    } else if (type == SIZE_TYPES.Turtle) {
      width.value = SIZES.turtle.width;
      height.value = SIZES.turtle.height;
    } else if (type == SIZE_TYPES.Pocket) {
      width.value = SIZES.pocket.width;
      height.value = SIZES.pocket.height;
    }
  }
}

let settingsColors = null;

function setSettingsPills() {
  for (let i = 0; i < 16; i++) {
    let elt = document.getElementById("p" + i);
    elt.style.setProperty("--md-filled-icon-button-container-color", settingsColors[i]);
    elt.style.setProperty("--md-filled-icon-button-disabled-container-color", settingsColors[i]);
  }
}

document.getElementById("size_select").addEventListener('closed', (select) => {
  select.target.childNodes.forEach((item) => { if (item.selected) { selectSizeType(item.value) } });
});

document.getElementById('initiate_bimg_export').addEventListener('click', () => {
  document.getElementById('bimg_select').disabled = !(tool == TOOLS.Select && screen.interaction.mode == MODES.Selected);
  if (!(tool == TOOLS.Select && screen.interaction.mode == MODES.Selected)) {
    document.getElementById('bimg_select').checked = false;
  }
  document.getElementById('properties').close();
  document.getElementById('bimg_dialog').show();
});

function downloadFile(data, filename) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function uploadFile() {
  let input = document.createElement('input');
  input.type = "file";
  input.name = "my_files[]";
  input.accept = "image/png";
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}
// document.getElementById("upload_font").addEventListener('click', uploadFile);

document.getElementById('bimg_export').addEventListener('click', () => {
  let selection = document.getElementById('bimg_select').checked;
  let x, y, width, height
  if (selection) {
    width = Math.abs(screen.interaction.point1.x - screen.interaction.point2.x) + 1;
    height = Math.abs(screen.interaction.point1.y - screen.interaction.point2.y) + 1;
    x = Math.min(screen.interaction.point1.x, screen.interaction.point2.x) + (screen.interaction.offset ? screen.interaction.offset.x : 0);
    y = Math.min(screen.interaction.point1.y, screen.interaction.point2.y) + (screen.interaction.offset ? screen.interaction.offset.y : 0);
  } else {
    x = 0; y = 0; width = screen.width; height = screen.height;
  }
  let rawData = bimgExport(screen, width, height, x, y);
  console.log(rawData);
  let data = serialize(rawData);
  let customFilename = document.getElementById("bimg_export_filename").value;
  downloadFile(data, customFilename ? customFilename : "image.bimg");
  document.getElementById('bimg_dialog').close();
});

function openProperties() {
  selectSizeType(screen.size.type);
  settingsColors = structuredClone(screen.colors);
  setSettingsPills();
  document.getElementById("project_name").value = screen.name;
  document.getElementById("draw_border").checked = screen.drawBorder;
  let properties = document.getElementById("properties");
  // document.getElementById("font_preview").src = FONT.src;
  properties.show();
}
document.getElementById('settings').onclick = openProperties;

function selectColor(i) {
  let elt = document.getElementById("color_picker");
  elt.value = screen.colors[i];
  elt.oninput = () => {
    settingsColors[i] = elt.value;
    setSettingsPills();
  }
  elt.click();
}
for (let i = 0; i < 16; i++) {
  let color = document.getElementById('p' + i);
  color.addEventListener("click", () => (selectColor(i)));
}

function saveProperties() {
  screen.colors = settingsColors;
  bufferScreen.colors = settingsColors;
  updatePills();
  screen.name = document.getElementById("project_name").value;
  screen.drawBorder = document.getElementById("draw_border").checked;
  let width = Number(document.getElementById("size_width").value);
  let height = Number(document.getElementById("size_height").value);
  let type;
  document.getElementById('size_select').childNodes.forEach((elt) => {
    if (elt.selected) {
      type = Number(elt.value);
    }
  });
  if (type != SIZE_TYPES.Monitor) {
    screen.size = {
      width: width,
      height: height,
      type: type,
    };
  } else {
    let scale;
    document.getElementById('size_scale').childNodes.forEach((elt) => {
      if (elt.selected) {
        scale = Number(elt.value);
      }
    });
    screen.size = {
      mwidth: width,
      mheight: height,
      width: Math.round((64 * width - 20) / (6 * scale)),
      height: Math.round((64 * height - 20) / (9 * scale)),
      type: type,
      scale: scale,
    };
  }
  screen.canvas.width = screen.size.width * 6 + 2 * screen.border;
  screen.canvas.height = screen.size.height * 9 + 2 * screen.border;
  bufferScreen.size = screen.size;
  bufferScreen.canvas.width = screen.canvas.width;
  bufferScreen.canvas.height = screen.canvas.height;
  screen.fixEmptyChars();
  screen.ctx.fillStyle = screen.colors[COLOR_NAMES.black];
  screen.ctx.fillRect(0, 0, screen.canvas.width, screen.canvas.height);
  screen.render();
  screen.save();
  make_fit();
  render();
  document.getElementById('properties').close();
}

document.getElementById('apply_properties').onclick = saveProperties;

function cancelProperties() {
  document.getElementById('properties').close();
}

document.getElementById('cancel_properties').onclick = cancelProperties;

document.getElementById("reset_pcolor").onclick = () => {
  settingsColors = structuredClone(DEFAULT_COLORS);
  setSettingsPills();
};

function openProjects() {
  let projectsCards = document.getElementById("project_cards");
  projectsCards.innerHTML = "";
  projects.forEach((projectID) => {
    let project = JSON.parse(window.localStorage.getItem("s" + projectID));
    if (project) {
      let card = document.createElement("div");
      card.classList.add("project_card");
      if (projectID == screen.id) {
        card.classList.add("selected");
      }
      card.appendChild(document.createElement("md-ripple"));
      let headline = document.createElement("div");
      headline.classList.add("headline");
      let name = document.createElement("label");
      name.innerHTML = project.name;
      name.classList.add("md-typescale-title-medium")
      headline.append(name);
      card.appendChild(headline);
      let preview = document.createElement("div");
      preview.classList.add("preview");
      preview.style.setProperty("background-image", "url(" + project.preview + ")");
      card.appendChild(preview);
      card.addEventListener('click', () => {
        openProject(projectID);
        screen.render();
        make_fit();
        render();
        updatePills();
        document.getElementById('projects_dialog').close();
      });
      projectsCards.appendChild(card);
    }
  });
  let newProject = document.createElement("div");
  newProject.classList.add("project_card", "new_project");
  newProject.appendChild(document.createElement("md-ripple"));
  let newIcon = document.createElement("md-icon");
  newIcon.innerHTML = "add_circle";
  newProject.appendChild(newIcon);
  newProject.addEventListener("click", () => {
    let newProjectID = (Math.random() + 1).toString(36).substring(7);
    while (window.localStorage.getItem(newProjectID)) {
      newProjectID = (Math.random() + 1).toString(36).substring(7);
    }
    openProject(newProjectID);
    screen.save();
    screen.render();
    make_fit();
    render();
    document.getElementById('projects_dialog').close();
  });
  projectsCards.appendChild(newProject);
  document.getElementById("projects_dialog").show();
}
document.getElementById('open_projects').onclick = openProjects

let didDelete = false;
function deleteProject() {
  let i = projects.indexOf(screen.id);
  if (i > -1) {
    projects.splice(i, 1);
  }
  saveProjects();
  window.localStorage.removeItem("s" + screen.id);
  if (projects.length > 0) {
    openProject(projects[0]);
  } else {
    openProject(loadingId);
  }
  updatePills();
  screen.render();
  screen.save();
  make_fit();
  render();
  didDelete = true
  document.getElementById('delete_confirmation').close();
}
document.getElementById('delete_project').addEventListener('click', deleteProject);
document.getElementById('delete_confirmation').addEventListener('open', () => {
  didDelete = false;
});
document.getElementById('delete_confirmation').addEventListener('close', () => {
  if (!didDelete) {
    document.getElementById('properties').show();
  }
});
