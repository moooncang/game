const palette = {
  wall: "#dddcc2",
  wood: "#b48d62",
  dark: "#465747",
  floor: "#efe8cb",
};
const homes = { claude: [69, 105], gpt: [163, 105] };
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
export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.people = {};
    this.queue = [];
    this.active = null;
    this.sprites = {};
    for (const id of ["claude", "gpt"]) {
      const img = new Image();
      img.src = `./assets/${id}.svg`;
      this.sprites[id] = img;
    }
    this.resize = new ResizeObserver(() => {
      const scale = Math.max(
        1,
        Math.floor(canvas.parentElement.clientWidth / 288),
      );
      canvas.style.width = `${288 * scale}px`;
      canvas.style.height = `${192 * scale}px`;
    });
    this.resize.observe(canvas.parentElement);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
  update(employees) {
    for (const id of ["claude", "gpt"]) {
      const source = employees[id] || { state: "offline", message: "" };
      const state = normalizeState(source.state);
      const person = (this.people[id] ||= {
        x: homes[id][0],
        y: homes[id][1],
        id,
      });
      Object.assign(person, { state, message: String(source.message || "") });
    }
  }
  deliver(report) {
    if (this.people[report.author]) this.queue.push(report);
  }
  destination(p) {
    if (p.state === "meeting") return [p.id === "claude" ? 110 : 153, 157];
    if (p.state === "reviewing")
      return homes[p.id === "claude" ? "gpt" : "claude"].map(
        (v, i) => v + (i === 0 ? 20 : 0),
      );
    if (p.state === "offline") return [26, 182];
    return homes[p.id];
  }
  rect(x, y, w, h, c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  desk(x, y) {
    this.rect(x + 2, y + 3, 55, 27, "#8f7655");
    this.rect(x, y, 55, 20, palette.wood);
    this.rect(x + 5, y + 22, 4, 10, "#725f47");
    this.rect(x + 47, y + 22, 4, 10, "#725f47");
    this.rect(x + 16, y - 13, 25, 17, palette.dark);
    this.rect(x + 19, y - 10, 19, 11, "#b7cbb1");
    this.rect(x + 25, y + 4, 8, 2, palette.dark);
    this.rect(x + 17, y + 9, 22, 5, "#e9e2cb");
    this.rect(x + 4, y + 5, 6, 7, "#eee8da");
  }
  plant(x, y) {
    this.rect(x, y, 11, 12, "#b57854");
    this.rect(x - 2, y, 15, 3, "#ce9369");
    this.rect(x + 4, y - 16, 3, 18, "#547757");
    this.rect(x - 5, y - 13, 10, 7, "#718a60");
    this.rect(x + 6, y - 20, 10, 9, "#678059");
  }
  room(t) {
    const c = this.ctx;
    c.clearRect(0, 0, 288, 192);
    this.rect(0, 0, 288, 192, "#d6dfca");
    this.rect(10, 10, 268, 175, "#61765b");
    this.rect(13, 13, 262, 169, palette.floor);
    this.rect(13, 13, 262, 48, palette.wall);
    this.rect(13, 58, 262, 5, "#a6aa89");
    for (let y = 65; y < 182; y += 12) {
      this.rect(13, y, 262, 1, "#dfd7b9");
      for (let x = 14 + (y % 24 ? 0 : 18); x < 274; x += 36)
        this.rect(x, y, 1, 12, "#e3dbbe");
    }
    for (const x of [40, 139]) {
      this.rect(x, 22, 52, 31, "#9caa91");
      this.rect(x + 3, 25, 46, 25, "#b5d2c6");
      this.rect(x + 7, 29, 15, 13, "#d5e6d5");
      this.rect(x + 25, 24, 3, 28, "#f2efd9");
      this.rect(x, 50, 54, 4, "#f8f1d7");
    }
    this.rect(215, 25, 37, 25, "#a78256");
    this.rect(218, 28, 31, 19, "#f4edce");
    this.rect(224, 32, 4, 4, "#879d73");
    this.rect(232, 32, 12, 2, "#b7b399");
    this.rect(223, 41, 22, 2, "#b7b399");
    this.desk(43, 81);
    this.desk(137, 81);
    this.plant(22, 58);
    this.plant(255, 162);
    this.rect(101, 133, 67, 27, "#7f9174");
    this.rect(104, 130, 61, 26, "#aeb995");
    this.rect(111, 138, 15, 10, "#eee9d5");
    this.rect(143, 137, 9, 7, "#f6e5c7");
    this.rect(117, 124, 14, 5, "#637459");
    this.rect(139, 162, 14, 5, "#637459");
    this.rect(224, 78, 34, 44, "#927654");
    this.rect(227, 81, 28, 13, "#c6aa79");
    this.rect(227, 97, 28, 20, "#b69b71");
    this.rect(238, 85, 8, 2, "#665b44");
    this.rect(238, 104, 8, 2, "#665b44");
    this.rect(227, 73, 27, 6, "#65705a");
    this.rect(231, 70, 20, 4, "#faf3d7");
    c.font = "6px sans-serif";
    c.fillStyle = "#526348";
    c.fillText("CLAUDE", 55, 70);
    c.fillText("GPT", 158, 70);
    c.fillText("INBOX", 229, 132);
    c.fillText("MEETING", 115, 177);
    this.rect(22, 177, 27, 6, "#a8af8a");
  }
  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.06);
    this.last = now;
    if (!this.active && this.queue.length)
      this.active = { report: this.queue.shift(), phase: "out", hold: 0 };
    this.room(now);
    for (const p of Object.values(this.people)) {
      const job = this.active?.report.author === p.id ? this.active : null;
      let target =
        job && job.phase !== "back" ? [215, 110] : this.destination(p);
      // Follow the aisle below the desks so characters do not cross furniture.
      const dx = target[0] - p.x,
        dy = target[1] - p.y;
      if (Math.abs(dx) > 2 && p.y < 116 && target[1] >= 100)
        target = [p.x, 118];
      else if (Math.abs(dx) > 2 && p.y >= 116) target = [target[0], p.y];
      const distance = Math.hypot(target[0] - p.x, target[1] - p.y);
      p.moving = distance > 1;
      if (p.moving) {
        const step = Math.min(distance, dt * 42);
        p.x += ((target[0] - p.x) / distance) * step;
        p.y += ((target[1] - p.y) / distance) * step;
      }
      if (job && !p.moving) {
        if (job.phase === "out") {
          job.phase = "drop";
        }
        if (job.phase === "drop") {
          job.hold += dt;
          if (job.hold > 1) {
            job.phase = "back";
            this.canvas.dispatchEvent(
              new CustomEvent("delivered", { detail: job.report }),
            );
          }
        } else if (job.phase === "back") {
          this.active = null;
        }
      }
      if (p.state === "offline" && !job && !p.moving) continue;
      const bob = p.moving ? Math.floor(now / 160) % 2 : 0;
      const img = this.sprites[p.id];
      if (img.complete && img.naturalWidth)
        this.ctx.drawImage(
          img,
          Math.round(p.x - 8),
          Math.round(p.y - 18 - bob),
          16,
          24,
        );
      const c = this.ctx;
      c.font = "bold 7px sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#314b3b";
      c.fillText(
        p.id === "gpt" ? "GPT" : "Claude",
        Math.round(p.x),
        Math.round(p.y - 23 - bob),
      );
      if (!p.moving && !job) {
        const symbols = {
          coding: "⌨",
          designing: "✎",
          writing: "✎",
          reviewing: "?",
          meeting: "…",
          blocked: "!",
          idle: "z",
          offline: "",
        };
        c.font = "10px sans-serif";
        c.fillText(
          symbols[p.state],
          p.x + 14,
          p.y - 10 + (Math.floor(now / 500) % 2),
        );
        if (["coding", "designing", "writing"].includes(p.state))
          this.rect(
            p.x + 7,
            p.y - 9 + (Math.floor(now / 250) % 2),
            4,
            3,
            "#f0cda3",
          );
      }
      if (job && job.phase !== "back") {
        const drop = job.phase === "drop" ? job.hold * 12 : 0;
        this.rect(p.x + 8 + drop, p.y - 13 - drop, 7, 9, "#fff9e8");
        this.rect(p.x + 9 + drop, p.y - 11 - drop, 4, 1, "#9d9b83");
      }
      if (!p.moving && !job && p.message) {
        const label =
          p.message.length > 13 ? p.message.slice(0, 12) + "…" : p.message;
        c.font = "6px sans-serif";
        const w = Math.ceil(c.measureText(label).width) + 8;
        const bx = Math.max(15, Math.min(273 - w, p.x - w / 2));
        this.rect(bx, p.y - 44, w, 11, "#fffdf0");
        this.rect(p.x - 1, p.y - 33, 3, 3, "#fffdf0");
        c.fillStyle = "#526348";
        c.textAlign = "left";
        c.fillText(label, bx + 4, p.y - 36);
      }
      c.textAlign = "left";
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}
