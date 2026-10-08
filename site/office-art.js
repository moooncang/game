// 직접 설계한 픽셀 도형. 외부 게임의 이미지나 스프라이트를 사용하지 않는다.
export const palette = {
  outline: "#241e20",
  shadow: "#413733",
  wood: "#7a583d",
  woodLight: "#8c6646",
  woodDark: "#5a4b35",
  wall: "#eae9db",
  wallShade: "#dbd4bb",
  white: "#eff0ec",
  desk: "#beb5a0",
  deskShade: "#837764",
  sky: "#abd7d6",
  green: "#7abe5c",
  lime: "#d2d856",
  blue: "#515cf5",
  navy: "#476785",
  red: "#9b4a34",
  pink: "#e277dc",
};

export class OfficeArt {
  constructor(ctx) {
    this.ctx = ctx;
  }
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
  }
  line(x1, y1, x2, y2, color) {
    let x = Math.round(x1),
      y = Math.round(y1);
    const endX = Math.round(x2),
      endY = Math.round(y2);
    const dx = Math.abs(endX - x),
      dy = -Math.abs(endY - y),
      sx = x < endX ? 1 : -1,
      sy = y < endY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      this.rect(x, y, 1, 1, color);
      if (x === endX && y === endY) break;
      const e = 2 * error;
      if (e >= dy) {
        error += dy;
        x += sx;
      }
      if (e <= dx) {
        error += dx;
        y += sy;
      }
    }
  }
  box(
    x,
    y,
    w,
    h,
    top = palette.desk,
    front = "#b39578",
    side = palette.deskShade,
    depth = 5,
  ) {
    const r = this.rect.bind(this),
      o = palette.outline;
    r(x + 3, y + h - 1, w, 4, "#413733");
    r(x, y, w - 3, h, o);
    r(x + 2, y + 2, w - 2, h - 2, o);
    r(x + 1, y + 1, w - 5, depth, top);
    r(x + 2, y + 2, w - 7, 1, palette.white);
    r(x + 1, y + depth + 1, w - 5, h - depth - 2, front);
    r(x + w - 4, y + 4, 3, h - 5, side);
    r(x + 2, y + h - 3, w - 7, 1, side);
    r(x + w - 4, y + depth, 1, h - depth - 2, o);
  }
  background(l) {
    const r = this.rect.bind(this),
      w = l.width,
      h = l.height,
      p = palette;
    this.ctx.clearRect(0, 0, w, h);
    r(2, 12, w - 4, h - 12, p.outline);
    r(5, 8, w - 12, h - 16, p.shadow);
    r(8, 12, w - 16, h - 23, p.woodDark);
    for (let y = 58, row = 0; y < h - 12; y += 8, row++) {
      for (let x = 8 - (row % 2) * 16, col = 0; x < w - 8; x += 32, col++) {
        const left = Math.max(8, x),
          right = Math.min(w - 8, x + 31),
          height = Math.min(7, h - 12 - y);
        r(
          left,
          y,
          right - left,
          height,
          (row + col) % 3 === 0 ? p.woodLight : p.wood,
        );
        r(left, y, right - left, 1, "#9c7350");
        r(left, y + height - 1, right - left, 1, "#644934");
        if (x >= 8 && x + 31 < w - 8) {
          r(x + 4, y + 3, 9, 1, "#896343");
          r(x + 19, y + 5, 7, 1, "#6f4f37");
          r(x + 2, y + 2, 1, 1, "#4b3b2d");
          r(x + 28, y + 5, 1, 1, "#4b3b2d");
        }
      }
    }
    // 벽 두께와 기둥 모서리를 계단 모양 픽셀로 표현한다.
    r(6, 9, w - 16, 46, p.outline);
    r(8, 10, w - 20, 3, p.white);
    r(9, 13, w - 22, 36, p.wall);
    r(9, 42, w - 22, 7, p.wallShade);
    r(9, 48, w - 22, 2, "#c5bda6");
    r(8, 50, w - 18, 4, "#837764");
    r(8, 50, w - 18, 1, "#beb5a0");
    r(6, 10, 3, h - 21, "#b2a995");
    r(7, 13, 1, h - 26, p.white);
    r(w - 10, 13, 3, h - 24, p.shadow);
    r(w - 12, 13, 2, h - 27, p.wallShade);
    r(8, h - 13, w - 17, 3, "#b39578");
    r(8, h - 13, w - 17, 1, "#e1c8a0");
    for (const [x, y, ww, hh] of l.windows) {
      r(x - 2, y - 2, ww + 4, hh + 5, p.outline);
      r(x - 1, y - 1, ww + 1, hh + 1, "#837764");
      r(x, y, ww, hh, p.white);
      r(x + 3, y + 3, ww - 6, hh - 6, p.sky);
      r(x + 5, y + hh - 9, ww - 10, 4, "#adcccf");
      r(x + 7, y + 6, 12, 3, "#eff0ec");
      r(x + 10, y + 4, 6, 2, "#eff0ec");
      r(x + ww - 17, y + 9, 10, 2, "#eff0ec");
      r(x + ww / 2 - 1, y + 2, 3, hh - 4, p.white);
      r(x + ww / 2 + 2, y + 2, 1, hh - 4, "#837764");
      r(x - 2, y + hh, ww + 4, 3, "#dbd4bb");
      r(x - 2, y + hh + 3, ww + 4, 1, p.outline);
      r(x + 1, y + 1, 2, hh - 1, "#b39578");
      r(x + ww - 2, y + 1, 1, hh - 1, "#b39578");
    }
    const ex = l.exit[0];
    r(ex - 8, h - 13, 26, 7, p.outline);
    r(ex - 7, h - 12, 24, 5, "#849077");
    for (let x = ex - 5; x < ex + 16; x += 3) r(x, h - 11, 1, 3, "#b7b892");
  }
  desk(x, y, id) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, 52, 24, p.desk, "#b39578", p.deskShade, 9);
    r(x + 4, y + 23, 4, 9, p.outline);
    r(x + 5, y + 23, 2, 8, "#837764");
    r(x + 44, y + 23, 4, 9, p.outline);
    r(x + 45, y + 23, 2, 8, "#837764");
    r(x + 4, y + 13, 12, 8, "#837764");
    r(x + 5, y + 14, 10, 2, "#dbd4bb");
    r(x + 8, y + 16, 4, 1, p.outline);
    r(x + 30, y - 11, 4, 17, p.shadow);
    r(x + 13, y - 13, 23, 17, p.outline);
    r(x + 14, y - 12, 21, 15, "#5e595e");
    r(x + 16, y - 10, 17, 11, "#263448");
    r(x + 17, y - 9, 15, 2, p.navy);
    r(x + 18, y - 6, 8, 1, id === "gpt" ? p.pink : "#7abe5c");
    r(x + 18, y - 3, 12, 1, id === "gpt" ? "#d2d856" : "#abd7d6");
    r(x + 31, y + 2, 2, 1, p.lime);
    r(x + 23, y + 4, 4, 3, p.outline);
    r(x + 18, y + 7, 15, 2, "#5e595e");
    r(x + 16, y + 11, 21, 5, p.outline);
    r(x + 17, y + 12, 19, 3, p.white);
    for (let col = 0; col < 6; col++)
      r(x + 18 + col * 3, y + 12, 1, 1, "#837764");
    r(x + 19, y + 14, 13, 1, "#837764");
    r(x + 40, y + 11, 5, 6, "#837764");
    r(x + 41, y + 12, 3, 4, p.white);
    r(x + 42, y + 12, 1, 1, p.shadow);
    r(x + 4, y + 4, 6, 6, p.outline);
    r(x + 5, y + 3, 4, 6, id === "gpt" ? p.navy : p.red);
    r(x + 6, y + 3, 2, 2, "#dbd4bb");
    r(x + 10, y + 5, 2, 3, p.white);
    r(x + 45, y + 3, 4, 6, p.outline);
    r(x + 46, y + 4, 2, 4, "#d2d856");
    r(x + 46, y, 1, 4, p.red);
    r(x + 48, y + 1, 1, 3, p.blue);
    r(x + 18, y + 28, 16, 5, p.outline);
    r(x + 20, y + 27, 12, 5, "#5e595e");
    r(x + 22, y + 28, 8, 1, "#849077");
  }
  board([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#dbd4bb", p.white, "#837764", 2);
    r(x + 3, y + 4, w - 9, h - 8, "#eae9db");
    for (let col = 0; col < 3; col++) {
      r(x + 6 + col * 8, y + 7, 5, 4, [p.navy, p.red, "#849077"][col]);
      r(x + 6 + col * 8, y + 13, 6, 1, "#b39578");
      r(x + 6 + col * 8, y + 16, 4, 1, "#b39578");
    }
    r(x + 4, y + h - 5, w - 10, 2, p.shadow);
    r(x + 8, y + h - 6, 7, 1, p.blue);
    r(x + 20, y + h - 6, 6, 1, p.red);
  }
  inbox([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#dbd4bb", "#beb5a0", "#837764", 4);
    for (let row = 7; row < h - 5; row += 11) {
      r(x + 3, y + row, w - 10, 9, p.shadow);
      r(x + 4, y + row + 1, w - 12, 7, "#b39578");
      r(x + 5, y + row + 1, w - 14, 1, "#dbd4bb");
      r(x + w / 2 - 5, y + row + 3, 7, 3, p.outline);
      r(x + w / 2 - 4, y + row + 3, 5, 1, p.white);
    }
    this.box(x + 2, y - 5, w - 6, 6, "#476785", "#344965", "#241e20", 2);
    r(x + 5, y - 8, w - 13, 4, p.outline);
    r(x + 6, y - 8, w - 15, 3, p.white);
    r(x + 8, y - 7, w - 20, 1, "#beb5a0");
    r(x + 9, y - 11, 7, 3, "#dbd4bb");
  }
  meeting([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#beb5a0", "#837764", "#5e595e", h - 6);
    r(x + 5, y + h - 1, 3, 5, p.outline);
    r(x + w - 9, y + h - 1, 3, 5, p.outline);
    r(x + 8, y + 4, 15, 9, p.outline);
    r(x + 9, y + 4, 13, 8, p.white);
    r(x + 11, y + 6, 8, 1, p.navy);
    r(x + 11, y + 8, 6, 1, "#b39578");
    r(x + w - 16, y + 4, 6, 7, p.outline);
    r(x + w - 15, y + 4, 4, 5, p.red);
    r(x + w - 14, y + 4, 2, 1, "#eae9db");
    r(x + 27, y + 5, 8, 3, p.blue);
    r(x + 29, y + 4, 4, 1, "#adcccf");
  }
  plant(x, y) {
    const r = this.rect.bind(this),
      p = palette;
    r(x - 1, y + 8, 15, 3, p.shadow);
    r(x, y, 11, 10, p.outline);
    r(x + 2, y + 1, 7, 8, "#9b4a34");
    r(x + 3, y + 2, 2, 5, "#c26069");
    r(x - 1, y - 1, 13, 3, p.outline);
    r(x, y, 11, 1, "#b39578");
    r(x + 5, y - 16, 2, 16, p.outline);
    r(x + 6, y - 15, 1, 15, "#849077");
    for (const [dx, dy] of [
      [-4, -12],
      [5, -17],
      [-1, -22],
    ]) {
      r(x + dx, y + dy + 1, 9, 5, p.outline);
      r(x + dx + 1, y + dy, 6, 5, "#4e753d");
      r(x + dx + 1, y + dy, 5, 2, p.green);
      r(x + dx + 2, y + dy, 2, 1, p.lime);
    }
  }
  shelf([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#beb5a0", "#5a4b35", "#413733", 4);
    for (let row = 6; row < h - 6; row += 10) {
      r(x + 3, y + row, w - 9, 8, p.outline);
      for (let col = 4; col < w - 10; col += 4) {
        const color = [p.red, p.navy, "#849077", "#b39578"][
          Math.floor(col / 4 + row) % 4
        ];
        r(x + col, y + row + 1, 3, 6, color);
        r(x + col, y + row + 2, 2, 1, "#dbd4bb");
      }
      r(x + 2, y + row + 8, w - 7, 2, "#b39578");
    }
    r(x + 6, y - 6, 8, 6, p.outline);
    r(x + 7, y - 5, 6, 4, p.pink);
    r(x + 8, y - 7, 2, 2, p.pink);
    r(x + 11, y - 7, 2, 2, p.pink);
    r(x + 8, y - 4, 1, 1, p.outline);
    r(x + 11, y - 4, 1, 1, p.outline);
    r(x + w - 15, y - 3, 8, 3, p.white);
    r(x + w - 15, y - 3, 8, 1, p.navy);
  }
  vending([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#c26069", p.red, "#643638", 4);
    r(x + 3, y + 6, w - 10, h - 20, p.outline);
    r(x + 4, y + 7, w - 12, h - 22, "#adcccf");
    for (let row = 9; row < h - 15; row += 7)
      for (let col = 5; col < w - 10; col += 5) {
        r(x + col, y + row, 3, 5, [p.blue, p.red, p.lime][(col + row) % 3]);
        r(x + col, y + row + 1, 3, 1, p.white);
      }
    r(x + w - 7, y + 10, 2, 2, p.lime);
    r(x + w - 7, y + 15, 2, 4, p.outline);
    r(x + 4, y + h - 10, w - 11, 6, p.outline);
    r(x + 5, y + h - 9, w - 13, 1, "#5e595e");
  }
  cooler([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y + 9, w, h - 9, p.white, "#beb5a0", "#837764", 3);
    r(x + 2, y, w - 6, 11, p.outline);
    r(x + 3, y + 1, w - 8, 9, "#476785");
    r(x + 3, y + 2, 2, 5, "#abd7d6");
    r(x + 4, y, Math.max(1, w - 10), 1, p.white);
    r(x + 2, y + 15, w - 7, 7, p.outline);
    r(x + 3, y + 16, 2, 2, p.blue);
    r(x + w - 7, y + 16, 2, 2, p.red);
    r(x + 4, y + 20, 3, 2, p.white);
  }
  sofa([x, y, w, h]) {
    const r = this.rect.bind(this),
      p = palette;
    this.box(x, y, w, h, "#849077", "#476785", "#413733", Math.max(3, h - 8));
    r(x + 2, y + 1, w - 8, 5, p.outline);
    r(x + 3, y + 1, w - 10, 3, "#809393");
    const sw = Math.floor((w - 15) / 2);
    for (const offset of [5, sw + 7]) {
      r(x + offset, y + 6, sw, h - 10, p.outline);
      r(x + offset + 1, y + 6, sw - 2, h - 12, "#6e858d");
      r(x + offset + 2, y + 6, sw - 4, 1, "#adcccf");
    }
    r(x + 1, y + 4, 4, h - 7, "#5e595e");
    r(x + w - 7, y + 4, 4, h - 7, "#5e595e");
  }
  boxes([x, y]) {
    const p = palette;
    this.box(x, y, 15, 13, "#b39578", "#837764", "#5a4b35", 5);
    this.rect(x + 6, y + 1, 2, 10, "#dbd4bb");
    this.rect(x + 3, y + 8, 3, 2, p.outline);
  }
  items(l) {
    const items = Object.entries(l.desks).map(([id, [x, y]]) => ({
      depth: y + 31,
      draw: () => this.desk(x, y, id),
    }));
    items.push(
      { depth: l.board[1] + l.board[3], draw: () => this.board(l.board) },
      { depth: l.inbox[1] + l.inbox[3], draw: () => this.inbox(l.inbox) },
      {
        depth: l.meeting[1] + l.meeting[3],
        draw: () => this.meeting(l.meeting),
      },
    );
    for (const [x, y] of l.plants)
      items.push({ depth: y + 10, draw: () => this.plant(x, y) });
    for (const [name, rect] of Object.entries(l.props))
      items.push({ depth: rect[1] + rect[3], draw: () => this[name](rect) });
    return items;
  }
}

// 20×28px 독자 캐릭터. 방향·자세·2프레임 조합을 캐시한다.
const sprites = new Map();
export function employeeSprite(
  id,
  pose = "stand",
  direction = "south",
  frame = 0,
) {
  const key = [id, pose, direction, frame].join(":");
  if (sprites.has(key)) return sprites.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 28;
  const c = canvas.getContext("2d");
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const p = palette,
    skin = id === "claude" ? "#f0c79d" : "#dfb58f",
    shade = id === "claude" ? "#b98d6c" : "#ae806d";
  const hair = id === "claude" ? "#9b4a34" : "#343448",
    hairLight = id === "claude" ? "#ce8250" : "#686081";
  const shirt = id === "claude" ? "#dbd4bb" : "#476785",
    shirtLight = id === "claude" ? "#eff0ec" : "#82a8a6",
    shirtDark = id === "claude" ? "#a49a87" : "#344963";
  const seated = pose === "typing",
    side = direction === "east" || direction === "west";
  if (direction === "west") {
    c.translate(20, 0);
    c.scale(-1, 1);
  }
  const bob = pose === "walk" || pose === "carry" ? frame : 0;
  // 좌우 신발과 바지 위치를 다르게 그려 걷기 프레임을 만든다.
  r(4, 24 - bob, 5, 3, p.outline);
  r(11, 24 + Math.min(0, -1 + frame), 5, 3, p.outline);
  r(5, 20, 4, 5, "#413733");
  r(11, 20, 4, 5, "#413733");
  r(6, 20, 2, 4, "#5e595e");
  r(12, 20, 2, 4, "#5e595e");
  r(4, 12 - bob, 12, 10, p.outline);
  r(5, 13 - bob, 10, 8, shirt);
  r(5, 13 - bob, 3, 7, shirtLight);
  r(13, 14 - bob, 2, 7, shirtDark);
  r(3, 3 - bob, 13, 10, p.outline);
  r(5, 1 - bob, 9, 2, p.outline);
  r(4, 3 - bob, 11, 9, skin);
  r(13, 5 - bob, 2, 6, shade);
  r(6, 11 - bob, 7, 2, shade);
  r(4, 2 - bob, 10, 4, hair);
  r(3, 4 - bob, 3, 5, hair);
  r(5, 2 - bob, 6, 1, hairLight);
  r(4, 4 - bob, 2, 2, hairLight);
  if (direction === "north" || seated) {
    r(4, 3 - bob, 11, 8, hair);
    r(5, 3 - bob, 3, 5, hairLight);
    r(11, 8 - bob, 4, 3, hair);
    r(8, 11 - bob, 4, 2, shade);
  } else if (side) {
    r(13, 6 - bob, 3, 5, skin);
    r(14, 6 - bob, 1, 2, p.outline);
    r(16, 8 - bob, 1, 2, shade);
    r(4, 5 - bob, 6, 5, hair);
  } else {
    r(7, 6 - bob, 1, 2, p.outline);
    r(12, 6 - bob, 1, 2, p.outline);
    r(9, 10 - bob, 3, 1, shade);
    if (id === "claude") {
      r(5, 5 - bob, 4, 1, p.shadow);
      r(11, 5 - bob, 4, 1, p.shadow);
      r(5, 8 - bob, 4, 1, p.shadow);
      r(11, 8 - bob, 4, 1, p.shadow);
      r(9, 6 - bob, 2, 1, p.shadow);
    }
  }
  r(2, 14 + frame - bob, 3, 6, p.outline);
  r(3, 14 + frame - bob, 2, 4, shirt);
  r(3, 18 + frame - bob, 2, 2, skin);
  r(15, 14 - frame - bob, 3, 6, p.outline);
  r(15, 14 - frame - bob, 2, 4, shirtDark);
  r(15, 18 - frame - bob, 2, 2, skin);
  if (seated) {
    r(2, 12 + frame, 4, 3, skin);
    r(14, 13 - frame, 4, 3, skin);
    r(4, 20, 12, 7, p.outline);
    r(5, 20, 10, 5, "#5e595e");
    r(6, 20, 8, 1, "#849077");
    r(9, 26, 2, 2, p.outline);
  }
  if (pose === "carry") {
    r(side ? 12 : 7, 14, 7, 9, p.outline);
    r(side ? 13 : 8, 14, 5, 8, p.white);
    r(side ? 14 : 9, 16, 3, 1, p.navy);
    r(side ? 14 : 9, 18, 3, 1, "#beb5a0");
    r(side ? 11 : 6, 19, 3, 2, skin);
  }
  sprites.set(key, canvas);
  return canvas;
}
const portraits = new Map();
export function employeePortrait(id) {
  if (!portraits.has(id)) portraits.set(id, employeeSprite(id).toDataURL());
  return portraits.get(id);
}
