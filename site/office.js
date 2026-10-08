import { OfficeArt, employeeSprite, palette } from "./office-art.js";
import { config } from "./config.js";
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
      [294, 174],
    ],
    props: {
      shelf: [202, 60, 34, 32],
      vending: [222, 154, 22, 38],
      cooler: [292, 62, 12, 30],
      sofa: [26, 160, 56, 24],
      boxes: [84, 174, 15, 13],
    },
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
    plants: [
      [76, 64],
      [112, 200],
    ],
    props: {
      shelf: [12, 130, 28, 30],
      vending: [126, 170, 22, 36],
      cooler: [142, 112, 12, 30],
      sofa: [12, 165, 46, 16],
    },
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
    this.art = new OfficeArt(this.ctx);
    this.effects = [];
    this.scale = 1;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    for (const id of ["claude", "gpt"]) {
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
        if (
          this.active?.report.author === p.id &&
          this.active.phase !== "back"
        ) {
          this.active.phase = "out";
          this.active.hold = 0;
        }
      }
  }
  update(employees) {
    for (const id of ["claude", "gpt"]) {
      const source = employees[id] || { state: "offline", message: "" };
      const existing = this.people[id];
      const p = existing || { id, path: [], target: null, direction: "south" };
      const state = normalizeState(source.state);
      if (!existing || p.state !== state) p.workSince = performance.now();
      p.state = state;
      p.message = String(source.message || "");
      // 첫 피드는 목적지에 즉시 배치하고 이후 상태 변경만 걸어서 이동한다.
      if (!existing) [p.x, p.y] = this.destination(p);
      this.people[id] = p;
      const actor = document.getElementById(`actor-${id}`);
      actor.dataset.state = p.state;
      actor.title = p.message;
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
      ...Object.values(l.props),
      ...l.plants.map(([x, y]) => [x, y, 11, 10]),
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
  react(author, status) {
    const p = this.people[author];
    if (!p || !["approved", "rejected"].includes(status)) return;
    p.reaction = {
      text: status === "approved" ? "승인!" : "반려…",
      until: performance.now() + 4000,
    };
    this.canvas.dispatchEvent(
      new CustomEvent("approval-reaction", { detail: { author, status } }),
    );
  }
  deliveryEffect(report, now) {
    const el = document.createElement("span");
    el.className = "delivery-number";
    el.textContent = "▤ +1";
    el.setAttribute("aria-hidden", "true");
    document.getElementById("effects").append(el);
    this.effects.push({ el, until: now + 2200 });
    this.canvas.dispatchEvent(new CustomEvent("delivered", { detail: report }));
  }
  // 한 프레임이 늦어져도 경과 시간만큼 여러 경로 지점을 이동한다.
  // 큰 시간 점프가 있더라도 이동 예산을 버리거나 테스트 전용 속도를 쓰지 않는다.
  move(p, dt) {
    let budget = dt * 44;
    while (p.path.length && budget > 0) {
      const next = p.path[0],
        dx = next[0] - p.x,
        dy = next[1] - p.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.01)
        p.direction =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "east"
              : "west"
            : dy > 0
              ? "south"
              : "north";
      if (distance <= budget) {
        [p.x, p.y] = next;
        budget -= distance;
        p.path.shift();
      } else {
        p.x += (dx / distance) * budget;
        p.y += (dy / distance) * budget;
        budget = 0;
      }
    }
    p.moving = p.path.length > 0;
    return budget / 44;
  }
  drawPerson(p, job, now) {
    const animated = !this.reducedMotion.matches;
    const working = ["coding", "designing", "writing"].includes(p.state);
    const pose =
      job && job.phase !== "back"
        ? "carry"
        : p.moving
          ? "walk"
          : working
            ? "typing"
            : "stand";
    const frame = animated ? Math.floor(now / (p.moving ? 180 : 340)) % 2 : 0;
    const sprite = employeeSprite(p.id, pose, p.direction, frame);
    this.ctx.drawImage(sprite, Math.round(p.x - 10), Math.round(p.y - 28));
    if (p.focused) {
      const phase = animated ? Math.floor(now / 160) % 4 : 1;
      for (const [offset, index] of [
        [-13, 0],
        [13, 1],
        [-9, 2],
        [9, 3],
      ]) {
        const y = p.y - 14 - ((phase + index) % 4) * 5;
        this.art.rect(p.x + offset, y, 2, 4, palette.red);
        this.art.rect(
          p.x + offset,
          y,
          1,
          2,
          index % 2 ? palette.lime : palette.pink,
        );
        this.art.rect(p.x + offset - 1, y + 2, 4, 1, "#f1ba5f");
      }
    }
    if (p.state === "blocked" && !p.moving) {
      this.art.rect(p.x + 12, p.y - 28, 2, 6, palette.red);
      this.art.rect(p.x + 12, p.y - 20, 2, 2, palette.red);
    }
    if (job?.phase === "drop") {
      const distance = job.hold * 14;
      this.art.rect(
        p.x + 8 + distance,
        p.y - 17 - distance,
        7,
        9,
        palette.outline,
      );
      this.art.rect(
        p.x + 9 + distance,
        p.y - 17 - distance,
        5,
        8,
        palette.white,
      );
      this.art.rect(
        p.x + 10 + distance,
        p.y - 15 - distance,
        3,
        1,
        palette.navy,
      );
    }
  }
  frame(now) {
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    if (!this.active && this.queue.length)
      this.active = { report: this.queue.shift(), phase: "out", hold: 0 };
    this.art.background(this.layout);
    const drawing = this.art.items(this.layout);
    for (const p of Object.values(this.people)) {
      const job = this.active?.report.author === p.id ? this.active : null;
      const destination =
        job && job.phase !== "back" ? this.layout.drop : this.destination(p);
      const target = destination.join(",");
      if (p.target !== target) {
        p.target = target;
        p.path = this.route([p.x, p.y], destination);
      }
      const remaining = this.move(p, dt);
      const arrived =
        !p.path.length &&
        Math.hypot(destination[0] - p.x, destination[1] - p.y) < 2;
      if (job && arrived) {
        if (job.phase === "out") job.phase = "drop";
        if (job.phase === "drop") {
          job.hold += remaining;
          if (job.hold > 1) {
            job.phase = "back";
            this.deliveryEffect(job.report, now);
          }
        } else if (job.phase === "back") this.active = null;
      }
      p.focused =
        ["coding", "designing"].includes(p.state) &&
        !p.moving &&
        !job &&
        now - p.workSince >= config.focusAfterMs;
      const visible = p.state !== "offline" || Boolean(job) || p.moving;
      const actor = document.getElementById(`actor-${p.id}`);
      actor.hidden = !visible;
      actor.dataset.moving = String(p.moving || Boolean(job));
      actor.dataset.focused = String(p.focused);
      actor.dataset.pose =
        job && job.phase !== "back"
          ? "carry"
          : p.moving
            ? "walk"
            : ["coding", "designing", "writing"].includes(p.state)
              ? "typing"
              : "stand";
      actor.dataset.direction = p.direction;
      actor.style.left = `${p.x * this.scale}px`;
      actor.style.top = `${p.y * this.scale}px`;
      actor.style.width = `${Math.max(32, 20 * this.scale)}px`;
      actor.style.height = `${Math.max(32, 28 * this.scale)}px`;
      actor.style.setProperty("--work-bubble-offset", `${24 * this.scale}px`);
      const reaction = p.reaction?.until > now ? p.reaction.text : null;
      const short =
        Array.from(p.message).slice(0, 9).join("") +
        (Array.from(p.message).length > 9 ? "…" : "");
      const message = actor.querySelector(".actor-message");
      message.textContent = reaction || (p.focused ? "집중 중!" : short);
      message.hidden = !message.textContent;
      actor.dataset.reaction = String(Boolean(reaction));
      if (visible)
        drawing.push({ depth: p.y, draw: () => this.drawPerson(p, job, now) });
    }
    drawing.sort((a, b) => a.depth - b.depth).forEach((item) => item.draw());
    const [ix, iy, iw] = this.layout.inbox;
    this.effects = this.effects.filter((effect) => {
      if (now >= effect.until) {
        effect.el.remove();
        return false;
      }
      effect.el.style.left = `${(ix + iw / 2) * this.scale}px`;
      effect.el.style.top = `${(iy - 12) * this.scale}px`;
      return true;
    });
    requestAnimationFrame((t) => this.frame(t));
  }
}
