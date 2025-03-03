export class History {
  screen;
  size;
  snapshots;
  oldest;
  latest;
  current;

  constructor(screen, size = 100) {
    this.size = size;
    this.snapshots = new Array(size);
    this.screen = screen;
    this.oldest = 0;
    this.latest = 0;
    this.current = 0;
  }

  takeSnapshot() {
    let snapshot = {
      old: {},
      new: {},
    };
    let modified = 0;
    for (const [key, pixel] of Object.entries(this.screen.buffer)) {
      let [y, x] = key.split(',').map(Number);
      if (this.screen.screen[y][x] != pixel) {
        modified += 1;
        snapshot.old[key] = this.screen.screen[y][x];
        snapshot.new[key] = pixel;
      }
    }
    if (modified > 0) {
      if ((((this.oldest - this.latest) % this.size) + this.size) % this.size == 1) {
        this.oldest = (this.oldest + 1) % this.size;
      }
      this.latest = (this.current + 1) % this.size;
      this.current = (this.current + 1) % this.size;

      this.snapshots[this.latest] = snapshot;
      document.getElementById('undo').disabled = (this.current == this.oldest);
      document.getElementById('redo').disabled = (this.current == this.latest);
    }
  }

  undo() {
    if (this.oldest != this.current) {
      this.screen.clearBuffer();
      this.screen.buffer = this.snapshots[this.current].old;
      this.screen.commitBuffer(false);
      this.current = (((this.current - 1) % this.size) + this.size) % this.size;
      document.getElementById('undo').disabled = (this.current == this.oldest);
      document.getElementById('redo').disabled = (this.current == this.latest);
    }
  }

  redo() {
    if (this.current != this.latest) {
      this.screen.clearBuffer();
      this.current = (this.current + 1) % this.size;
      this.screen.buffer = this.snapshots[this.current].new;
      this.screen.commitBuffer(false);
      document.getElementById('undo').disabled = (this.current == this.oldest);
      document.getElementById('redo').disabled = (this.current == this.latest);
    }
  }
}
