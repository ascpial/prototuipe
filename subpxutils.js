export class SubPx {
  pxData;
  color1;
  color2;
  usedAllColors;
  valid;

  constructor (charId, fgColor, bgColor) {
    this.pxData = Array(6);
    let id = charId - 128;
    this.color1 = fgColor;
    this.color2 = bgColor;
    this.usedAllColors = false;
    this.valid = true;
    if (this.color1 == this.color2 || charId == 0 || charId == 9 || charId == 32 || charId == 160) {
      this.pxData = [2, 2, 2, 2, 2, 2]
    } else if (id < 0 || id >= 128) {
      this.valid = false
    } else {
      for (let i=0; i<5; i++) {
        if ((id >> i) % 2 == 1) {
          this.pxData[i] = 1;
          this.usedAllColors = true;
        } else {
          this.pxData[i] = 2
        }
      }
      this.pxData[5] = 2;
    }
  }

  toChar () {
    let baseColor = this.pxData[5];
    let id = 0;
    for (let i=5; i>=0; i--) {
      id = id << 1;
      if (this.pxData[i] != baseColor) {
        id++;
      }
    };
    if (baseColor == 1) {
      return {charId: id + 128, fg: this.color2, bg: this.color1}
    } else {
      return {charId: id + 128, fg: this.color1, bg: this.color2}
    }
  }

  set (x, y, color) {
    if (!this.valid) {
      return false
    } else if (color != this.color1 && color != this.color2 && this.usedAllColors) {
      return false
    };
    if (color == this.color2) {
      this.pxData[x+y*2] = 2;
    } else {
      this.pxData[x+y*2] = 1;
      this.color1 = color;
      this.usedAllColors = true;
    }
    return true;
  }
}
