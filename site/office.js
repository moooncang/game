const states = new Set([
  "offline",
  "idle",
  "coding",
  "designing",
  "writing",
  "reviewing",
  "meeting",
  "blocked",
]);
export const normalizeState = (value) => (states.has(value) ? value : "idle");
const layouts = {
  wide: {
    width: 320,
    height: 208,
    floor: [12, 68, 296, 128],
    desks: { claude: [36, 86], gpt: [132, 86] },
    homes: { claude: [60, 120], gpt: [156, 120] },
    board: [224, 28, 56, 28],
    inbox: [264, 94, 28, 40],
    drop: [248, 128],
    meeting: [122, 158, 64, 24],
    seats: { claude: [108, 176], gpt: [200, 176] },
    exit: [24, 196],
    windows: [
      [30, 24, 60, 30],
      [130, 24, 60, 30],
    ],
    plants: [
      [18, 62],
      [292, 172],
    ],
  },
  tall: {
    width: 160,
    height: 224,
    floor: [8, 60, 144, 156],
    desks: { claude: [16, 74], gpt: [80, 126] },
    homes: { claude: [40, 108], gpt: [104, 160] },
    board: [102, 24, 42, 26],
    inbox: [124, 64, 24, 36],
    drop: [112, 100],
    meeting: [24, 184, 50, 18],
    seats: { claude: [12, 204], gpt: [88, 204] },
    exit: [16, 216],
    windows: [[18, 24, 58, 27]],
    plants: [[18, 150]],
  },
};

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scene = canvas.parentElement;
    this.people = {};
    this.queue = [];
    this.active = null;
    this.sprites = {};
    this.scale = 1;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    for (const id of ["claude", "gpt"]) {
      const image = new Image();
      image.src = `./assets/${id}.svg`;
      this.sprites[id] = image;
      const actor = document.createElement("button");
      actor.className = "actor";
      actor.hidden = true;
      actor.id = `actor-${id}`;
      actor.setAttribute(
        "aria-label",
        `${id === "gpt" ? "GPT" : "Claude"} 사원 상태 열기`,
      );
      const label = document.createElement("span");
      label.className = "actor-label";
      label.textContent = id === "gpt" ? "GPT" : "Claude";
      const message = document.createElement("span");
      message.className = "actor-message";
      actor.append(label, message);
      document.querySelector("#actors").append(actor);
      actor.addEventListener("click", () =>
        canvas.dispatchEvent(
          new CustomEvent("employee-select", { detail: id }),
        ),
      );
    }
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(this.scene.parentElement);
    this.fit();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
  fit() {
    const viewport = this.scene.parentElement;
    const mode = viewport.clientWidth < 600 ? "tall" : "wide";
    const changed = this.layout !== layouts[mode];
    this.layout = layouts[mode];
    const { width, height } = this.layout;
    this.scale = Math.max(
      1,
      Math.floor(
        Math.min(
          (viewport.clientWidth - 12) / width,
          (viewport.clientHeight - 12) / height,
        ),
      ),
    );
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
    Object.assign(this.canvas.style, {
      width: `${width * this.scale}px`,
      height: `${height * this.scale}px`,
    });
    Object.assign(this.scene.style, {
      width: `${width * this.scale}px`,
      height: `${height * this.scale}px`,
    });
    this.scene.dataset.layout = mode;
    for (const [id, rect] of [
      ["scene-inbox", this.layout.inbox],
      ["scene-board", this.layout.board],
    ]) {
      const el = document.getElementById(id);
      Object.assign(el.style, {
        left: `${rect[0] * this.scale}px`,
        top: `${rect[1] * this.scale}px`,
        width: `${rect[2] * this.scale}px`,
        height: `${rect[3] * this.scale}px`,
      });
    }
    if (changed)
      for (const p of Object.values(this.people)) {
        const point = this.destination(p);
        [p.x, p.y] = point;
        p.target = null;
        p.path = [];
        if (this.active?.report.author === p.id) {
          this.active.phase = "out";
          this.active.hold = 0;
        }
      }
  }
  update(employees) {
    for (const id of ["claude", "gpt"]) {
      const source = employees[id] || { state: "offline", message: "" };
      const existing = this.people[id];
      const p = existing || { id, path: [], target: null };
      p.state = normalizeState(source.state);
      p.message = String(source.message || "");
      // 첫 피드는 목적지에 즉시 배치하고 이후 상태 변경만 걸어서 이동한다.
      if (!existing) [p.x, p.y] = this.destination(p);
      this.people[id] = p;
      const actor = document.getElementById(`actor-${id}`);
      actor.dataset.state = p.state;
      actor.querySelector(".actor-message").textContent = p.message;
      actor.querySelector(".actor-message").hidden = !p.message;
    }
  }
  destination(p) {
    const l = this.layout;
    if (p.state === "offline") return l.exit;
    if (p.state === "meeting") return l.seats[p.id];
    if (p.state === "reviewing") {
      const other = l.homes[p.id === "gpt" ? "claude" : "gpt"];
      return [other[0] + 16, other[1]];
    }
    return l.homes[p.id];
  }
  deliver(report) {
    if (this.people[report.author]) this.queue.push(report);
  }
  // 가구를 피해 4px 격자로 경로를 찾으며 이동 중 상태 변경에도 다시 계산한다.
  route(start, end) {
    const l = this.layout,
      step = 4;
    const obstacles = [
      ...Object.values(l.desks).map(([x, y]) => [x - 4, y - 4, 60, 30]),
      l.inbox,
      l.meeting,
    ];
    const key = ([x, y]) => `${x},${y}`;
    const from = start.map((v) => Math.round(v / step) * step),
      to = end.map((v) => Math.round(v / step) * step);
    const available = ([x, y]) =>
      x >= l.floor[0] &&
      x <= l.floor[0] + l.floor[2] &&
      y >= l.floor[1] &&
      y <= l.floor[1] + l.floor[3] &&
      !obstacles.some(
        ([ox, oy, w, h]) =>
          x >= ox - 2 && x <= ox + w + 2 && y >= oy - 2 && y <= oy + h + 4,
      );
    const queue = [from],
      previous = new Map([[key(from), null]]);
    let found = false;
    for (let head = 0; head < queue.length; head++) {
      const point = queue[head];
      if (key(point) === key(to)) {
        found = true;
        break;
      }
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const next = [point[0] + dx, point[1] + dy],
          id = key(next);
        if (!previous.has(id) && available(next)) {
          previous.set(id, point);
          queue.push(next);
        }
      }
    }
    if (!found) return [];
    const path = [];
    let current = to;
    while (previous.get(key(current))) {
      path.unshift(current);
      current = previous.get(key(current));
    }
    return path;
  }
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  desk(x, y, id) {
    this.rect(x + 3, y + 8, 52, 23, "#6c5440");
    this.rect(x + 4, y + 25, 5, 9, "#463f34");
    this.rect(x + 44, y + 25, 5, 9, "#463f34");
    this.rect(x, y, 52, 24, "#715c42");
    this.rect(x + 2, y + 2, 48, 17, "#d6ad72");
    this.rect(x + 3, y + 3, 46, 2, "#f0cc8b");
    this.rect(x + 2, y + 20, 48, 3, "#a77b4c");
    this.rect(x + 14, y - 12, 25, 19, "#343e36");
    this.rect(x + 16, y - 10, 21, 14, "#6eab9c");
    this.rect(x + 18, y - 8, 17, 9, id === "gpt" ? "#bdc47e" : "#92c4ad");
    this.rect(x + 19, y - 6, 8, 1, "#e6e9b4");
    this.rect(x + 19, y - 3, 14, 1, "#e6e9b4");
    this.rect(x + 24, y + 7, 5, 2, "#3d4538");
    this.rect(x + 15, y + 11, 23, 5, "#eee5bd");
    this.rect(x + 17, y + 12, 18, 1, "#8f9476");
    this.rect(x + 5, y + 10, 5, 6, "#f5e3b6");
    this.rect(x + 6, y + 10, 4, 2, "#a76c48");
    this.rect(x + 18, y + 27, 16, 9, "#5d7467");
    this.rect(x + 20, y + 26, 12, 3, "#81947a");
  }
  plant(x, y) {
    this.rect(x, y, 10, 10, "#aa724c");
    this.rect(x - 1, y, 12, 3, "#dfac6a");
    this.rect(x + 4, y - 14, 2, 16, "#456147");
    this.rect(x - 4, y - 10, 9, 7, "#65835a");
    this.rect(x + 5, y - 16, 9, 8, "#82a267");
    this.rect(x - 2, y - 15, 6, 5, "#9db579");
  }
  room() {
    const l = this.layout,
      w = l.width,
      h = l.height;
    this.ctx.clearRect(0, 0, w, h);
    this.rect(2, 12, w - 4, h - 12, "#23382e");
    this.rect(6, 10, w - 12, h - 18, "#776745");
    this.rect(8, 12, w - 16, h - 24, "#e9cc95");
    this.rect(8, 12, w - 16, 44, "#e5d3a5");
    this.rect(8, 12, w - 16, 4, "#a49770");
    for (let y = 60; y < h - 10; y += 12) {
      this.rect(8, y, w - 16, 1, "#c7a779");
      for (let x = 8 + (y % 24 ? 0 : 20); x < w - 8; x += 40)
        this.rect(x, y, 1, Math.min(12, h - 12 - y), "#d7b785");
    }
    this.rect(8, 54, w - 16, 5, "#9b885f");
    this.rect(8, 54, w - 16, 2, "#c6b182");
    for (const [x, y, ww, hh] of l.windows) {
      this.rect(x - 2, y - 2, ww + 4, hh + 4, "#887956");
      this.rect(x, y, ww, hh, "#f0e5bc");
      this.rect(x + 3, y + 3, ww - 6, hh - 6, "#90bdb0");
      this.rect(x + 7, y + 5, 15, hh - 9, "#bed9c2");
      this.rect(x + ww / 2 - 1, y, 3, hh, "#f7ebc4");
      this.rect(x - 3, y + hh, ww + 6, 3, "#bba26d");
    }
    const [bx, by, bw, bh] = l.board;
    this.rect(bx, by, bw, bh, "#745b40");
    this.rect(bx + 2, by + 2, bw - 4, bh - 4, "#ac9468");
    for (const offset of [5, Math.floor(bw / 2)]) {
      this.rect(bx + offset, by + 5, 14, bh - 10, "#eee3b6");
      this.rect(bx + offset + 5, by + 4, 3, 3, "#b8714a");
      this.rect(bx + offset + 3, by + 10, 8, 1, "#a29671");
      this.rect(bx + offset + 3, by + 13, 6, 1, "#a29671");
    }
    for (const [id, [x, y]] of Object.entries(l.desks)) this.desk(x, y, id);
    const [ix, iy, iw, ih] = l.inbox;
    this.rect(ix + 2, iy + 4, iw, ih, "#6f5740");
    this.rect(ix, iy, iw, ih, "#b08a57");
    this.rect(ix + 2, iy + 2, iw - 4, ih - 4, "#cfb077");
    for (const row of [5, Math.floor(ih / 2) + 1]) {
      this.rect(ix + 3, iy + row, iw - 6, ih / 2 - 5, "#bba06a");
      this.rect(ix + iw / 2 - 4, iy + row + 4, 8, 2, "#665c42");
    }
    this.rect(ix, iy - 4, iw, 5, "#4f6753");
    this.rect(ix + 4, iy - 8, iw - 8, 5, "#fff0c9");
    this.rect(ix + 7, iy - 7, iw - 14, 1, "#c1b795");
    const [mx, my, mw, mh] = l.meeting;
    this.rect(mx + 2, my + 3, mw, mh, "#665e42");
    this.rect(mx, my, mw, mh, "#839366");
    this.rect(mx + 2, my + 2, mw - 4, mh - 4, "#b0bc84");
    this.rect(mx + 8, my + 5, 14, 9, "#f3e5bb");
    this.rect(mx + mw - 14, my + 5, 6, 6, "#cf9d66");
    for (const [x, y] of l.plants) this.plant(x, y);
    if (l === layouts.wide) {
      this.rect(32, 159, 54, 24, "#586f59");
      this.rect(35, 157, 48, 20, "#849779");
      this.rect(38, 158, 20, 16, "#9caa86");
      this.rect(60, 158, 20, 16, "#9caa86");
      this.rect(30, 163, 6, 19, "#566d56");
      this.rect(82, 163, 6, 19, "#566d56");
    }
    this.rect(l.exit[0] - 8, h - 11, 26, 7, "#9e9d77");
    this.rect(l.exit[0] - 6, h - 10, 22, 1, "#d7c495");
  }
  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.06);
    this.last = now;
    if (!this.active && this.queue.length)
      this.active = { report: this.queue.shift(), phase: "out", hold: 0 };
    this.room();
    for (const p of Object.values(this.people)) {
      const job = this.active?.report.author === p.id ? this.active : null;
      const destination =
        job && job.phase !== "back" ? this.layout.drop : this.destination(p);
      const target = destination.join(",");
      if (p.target !== target) {
        p.target = target;
        p.path = this.route([p.x, p.y], destination);
      }
      const next = p.path[0];
      p.moving = Boolean(next);
      if (next) {
        const distance = Math.hypot(next[0] - p.x, next[1] - p.y),
          step = Math.min(distance, dt * 44);
        if (distance) {
          p.x += ((next[0] - p.x) / distance) * step;
          p.y += ((next[1] - p.y) / distance) * step;
        }
        if (distance <= step + 0.01) p.path.shift();
      }
      const arrived =
        !p.path.length &&
        Math.hypot(destination[0] - p.x, destination[1] - p.y) < 2;
      if (job && arrived) {
        if (job.phase === "out") job.phase = "drop";
        if (job.phase === "drop") {
          job.hold += dt;
          if (job.hold > 1) {
            job.phase = "back";
            this.canvas.dispatchEvent(
              new CustomEvent("delivered", { detail: job.report }),
            );
          }
        } else if (job.phase === "back") this.active = null;
      }
      const visible = p.state !== "offline" || Boolean(job) || p.moving;
      const actor = document.getElementById(`actor-${p.id}`);
      actor.hidden = !visible;
      actor.dataset.moving = String(p.moving || Boolean(job));
      actor.style.left = `${p.x * this.scale}px`;
      actor.style.top = `${p.y * this.scale}px`;
      actor.style.width = `${Math.max(32, 16 * this.scale)}px`;
      actor.style.height = `${Math.max(32, 24 * this.scale)}px`;
      if (!visible) continue;
      const animated = !this.reducedMotion.matches;
      const bob = p.moving && animated ? Math.floor(now / 160) % 2 : 0;
      const image = this.sprites[p.id];
      if (image.complete && image.naturalWidth)
        this.ctx.drawImage(
          image,
          Math.round(p.x - 8),
          Math.round(p.y - 24 - bob),
          16,
          24,
        );
      if (!p.moving && !job) {
        const hand = animated ? Math.floor(now / 300) % 2 : 0;
        if (["coding", "designing", "writing"].includes(p.state)) {
          this.rect(p.x + 6, p.y - 12 + hand, 4, 3, "#f0cda3");
          if (p.state === "designing")
            this.rect(p.x + 9, p.y - 13, 5, 1, "#596c49");
          if (p.state === "writing")
            this.rect(p.x + 9, p.y - 12, 6, 7, "#fff0c9");
        }
        if (p.state === "blocked") {
          this.rect(p.x + 11, p.y - 24, 3, 6, "#b55535");
          this.rect(p.x + 11, p.y - 16, 3, 2, "#b55535");
        }
      }
      if (job && job.phase !== "back") {
        const drop = job.phase === "drop" ? job.hold * 12 : 0;
        this.rect(p.x + 8 + drop, p.y - 14 - drop, 7, 9, "#fff9e8");
        this.rect(p.x + 9 + drop, p.y - 12 - drop, 4, 1, "#9d9b83");
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}
