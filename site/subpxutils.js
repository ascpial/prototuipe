export class SubPx {
  valid;
  pxData;

  constructor(charId, fgColor, bgColor) {
    this.pxData = Array(6);
    let id = charId - 128;
    if (charId == 0 || charId == 9 || charId == 32 || charId == 160) {
      id = 0;
    }
    if (id < 0 || id >= 128) {
      this.valid = false;
    } else {
      this.valid = true;
      for (let i = 0; i < 6; i++) {
        if ((id >> i) % 2 == 1) {
          this.pxData[i] = fgColor;
        } else {
          this.pxData[i] = bgColor;
        }
      }
    }
  }

  set(x, y, color) {
    if (this.valid) {
      this.pxData[y * 2 + x] = color;
    }
  }

  toChar() {
    if (!this.valid) {
      return [false, null];
    } else {
      let bgColor = this.pxData[5];
      let fgColor = null;
      let id = 0;
      for (let i = 4; i >= 0; i--) {
        id = id << 1;
        if (this.pxData[i] != bgColor) {
          if (fgColor === null || fgColor === this.pxData[i]) {
            fgColor = this.pxData[i];
            id++;
          } else {
            return [false, null];
          }
        }
      }
      return [true, { charId: id + 128, fg: fgColor, bg: bgColor }];
    }
  }
}
