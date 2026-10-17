/* Home Dojo: Monster Islands. Each child decorates their own island square by square.
   Pieces come free from Dojos (an island track, plus a new themed set each month that is kept forever),
   from hatched mystery eggs, and as special pieces bought with Dojo $. Brothers sail over to visit,
   wave, high-five and leave a sticker on the welcome sign; they help build only when the owner says yes.
   The family island in the middle is built by everyone with pieces from the family's Dojos.
   Islands are saved on each child (kid.island) and the family one on the config (cfg.familyIsland):
   { g: {"x,y": ground}, o: {"x,y": thing}, sign: [{e, from, at}], seen, got: [bundle ids], extra: {piece: n} } */
(function () {
"use strict";

window.HD_ISLANDS = function (A) {
const { S, $, esc } = A;
const N = 10, C = 36, M = 26, W = N * C + 2 * M;           // grid squares, square size, sea margin, scene size
const key = (x, y) => x + "," + y;
const land = (x, y) => x >= 0 && y >= 0 && x < N && y < N && ((x + .5 - 5) / 5) ** 2 + ((y + .5 - 5) / 5) ** 2 <= 1;
const HOUSE_CELLS = ["4,1", "5,1", "4,2", "5,2"], DOCK = "5,9", SIGN = "4,9";
const reserved = (k) => HOUSE_CELLS.includes(k) || k === DOCK || k === SIGN;
const shore = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !land(x + dx, y + dy));
const baseGround = (x, y) => shore(x, y) ? "sand" : "grass";
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- pieces ---------- */
const GROUND = {
  grass: { n: "Grass", c: "#7CC95A", d: (x, y) => `<path d="M${x + 9} ${y + 26} l2 -5 l2 5 M${x + 24} ${y + 14} l2 -5 l2 5" stroke="#5DAE3F" stroke-width="1.6" fill="none"/>` },
  sand: { n: "Sand", c: "#F2DC9B", d: (x, y) => `<circle cx="${x + 10}" cy="${y + 12}" r="1.2" fill="#D9BF78"/><circle cx="${x + 25}" cy="${y + 24}" r="1.2" fill="#D9BF78"/><circle cx="${x + 20}" cy="${y + 8}" r="1" fill="#D9BF78"/>` },
  water: { n: "Pond water", c: "#4FB3E8", d: (x, y) => `<path class="isl-wave" d="M${x + 6} ${y + 14} q4 -3 8 0 t8 0 M${x + 12} ${y + 25} q4 -3 8 0 t8 0" stroke="#BFE8FF" stroke-width="1.6" fill="none"/>` },
  path: { n: "Path", c: "#D9B98A", d: (x, y) => `<ellipse cx="${x + 11}" cy="${y + 11}" rx="6" ry="4.5" fill="#E8D1A8"/><ellipse cx="${x + 25}" cy="${y + 19}" rx="6" ry="4.5" fill="#E8D1A8"/><ellipse cx="${x + 12}" cy="${y + 27}" rx="6" ry="4.5" fill="#E8D1A8"/>` },
  stones: { n: "Stepping stones", c: "#7CC95A", d: (x, y) => `<ellipse cx="${x + 11}" cy="${y + 12}" rx="7" ry="5" fill="#B9B4AA" stroke="#9A958B"/><ellipse cx="${x + 25}" cy="${y + 25}" rx="7" ry="5" fill="#B9B4AA" stroke="#9A958B"/>` },
  snow: { n: "Snow", c: "#F2F7FF", d: (x, y) => `<circle cx="${x + 10}" cy="${y + 12}" r="2" fill="#DDE8F7"/><circle cx="${x + 24}" cy="${y + 22}" r="2.4" fill="#DDE8F7"/>` },
  leaves: { n: "Autumn leaves", c: "#9BC45A", d: (x, y) => `<circle cx="${x + 9}" cy="${y + 10}" r="3" fill="#E9A23B"/><circle cx="${x + 25}" cy="${y + 14}" r="3" fill="#D9622B"/><circle cx="${x + 16}" cy="${y + 26}" r="3" fill="#F2C14E"/><circle cx="${x + 28}" cy="${y + 28}" r="2.5" fill="#E9A23B"/>` },
  flowerbed: { n: "Flower bed", c: "#9C6B48", d: (x, y) => [[9, 10, "#FF5E8A"], [25, 11, "#FFD43B"], [17, 20, "#C77DFF"], [9, 28, "#fff"], [27, 27, "#FF8A2A"]].map(([a, b, f]) => `<circle cx="${x + a}" cy="${y + b}" r="3.2" fill="${f}"/><circle cx="${x + a}" cy="${y + b}" r="1.2" fill="#FFB400"/>`).join("") }
};
const flower = (x, y, c) => `<path d="M${x} ${y} V${y - 9}" stroke="#3E8E41" stroke-width="2"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${x + Math.cos(a * Math.PI / 180) * 3.4}" cy="${y - 11 + Math.sin(a * Math.PI / 180) * 3.4}" r="3" fill="${c}"/>`).join("")}<circle cx="${x}" cy="${y - 11}" r="2.2" fill="#FFB400"/>`;
const pineArt = (o) => `<rect x="-3" y="-9" width="6" height="9" fill="#7A5A44"/><path d="M0 -44 L13 -24 H7 L16 -9 H-16 L-7 -24 H-13Z" fill="#2E8B57"/>${o || ""}`;
// Things stand on a square: drawn around (0, 0) = the middle of the square's bottom edge. "big" pieces are shop specials.
const THING = {
  tree: { n: "Tree", a: () => `<rect x="-3" y="-15" width="6" height="15" rx="2" fill="#8D6E63"/><circle cx="0" cy="-26" r="13" fill="#3FA34D"/><circle cx="-7" cy="-21" r="8" fill="#4CBF5A"/><circle cx="6" cy="-31" r="6" fill="#5CD06A"/>` },
  palm: { n: "Palm tree", a: () => `<path d="M0 0 Q-2 -18 4 -34" stroke="#A0703F" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M4 -34 Q-10 -40 -18 -30 M4 -34 Q16 -42 22 -30 M4 -34 Q-4 -46 -12 -46 M4 -34 Q12 -48 20 -44" stroke="#3FA34D" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="2" cy="-31" r="3" fill="#7A4E2D"/><circle cx="7" cy="-31" r="3" fill="#7A4E2D"/>` },
  pine: { n: "Pine tree", a: () => pineArt() },
  bush: { n: "Bush", a: () => `<ellipse cx="0" cy="-8" rx="14" ry="9" fill="#3FA34D"/><ellipse cx="-6" cy="-12" rx="8" ry="7" fill="#4CBF5A"/><ellipse cx="7" cy="-11" rx="7" ry="6" fill="#5CD06A"/><circle cx="-3" cy="-9" r="1.6" fill="#E63946"/><circle cx="6" cy="-6" r="1.6" fill="#E63946"/>` },
  flowers: { n: "Flowers", a: () => flower(-8, 0, "#FF5E8A") + flower(0, -3, "#FFD43B") + flower(8, 0, "#C77DFF") },
  sunflower: { n: "Sunflower", a: () => `<path d="M0 0 V-26" stroke="#3E8E41" stroke-width="3"/><path d="M0 -12 q-8 -2 -10 -8 q8 0 10 6" fill="#4CBF5A"/>${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<ellipse cx="${Math.cos(a) * 8}" cy="${-32 + Math.sin(a) * 8}" rx="4" ry="2.4" transform="rotate(${i * 36} ${Math.cos(a) * 8} ${-32 + Math.sin(a) * 8})" fill="#FFD43B"/>`; }).join("")}<circle cx="0" cy="-32" r="6" fill="#7A4E2D"/>` },
  rock: { n: "Rock", a: () => `<path d="M-13 0 Q-15 -10 -6 -15 Q4 -20 11 -11 Q16 -4 13 0Z" fill="#A8A49B"/><path d="M-6 -12 Q0 -16 6 -12" stroke="#CFCAC0" stroke-width="2" fill="none"/>` },
  mushroom: { n: "Mushroom", a: () => `<rect x="-4" y="-12" width="8" height="12" rx="3" fill="#FFF3DC"/><path d="M-13 -11 Q-13 -26 0 -26 Q13 -26 13 -11Z" fill="#E63946"/><circle cx="-5" cy="-18" r="2.4" fill="#fff"/><circle cx="5" cy="-20" r="2" fill="#fff"/><circle cx="1" cy="-14" r="1.6" fill="#fff"/>` },
  cactus: { n: "Cactus", a: () => `<rect x="-5" y="-30" width="10" height="30" rx="5" fill="#3FA34D"/><path d="M-5 -14 H-11 V-22" stroke="#3FA34D" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M5 -18 H11 V-26" stroke="#3FA34D" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="0" cy="-31" r="3" fill="#FF5E8A"/>` },
  campfire: { n: "Campfire", a: () => `<path d="M-12 -2 L12 -8 M-12 -8 L12 -2" stroke="#8D6E63" stroke-width="5" stroke-linecap="round"/><path class="isl-flicker" d="M0 -6 q-9 -8 -2 -22 q2 8 6 6 q4 8 -4 16z" fill="#FF8A2A"/><path class="isl-flicker" d="M0 -6 q-4 -5 0 -12 q4 6 0 12z" fill="#FFD43B"/>` },
  lamp: { n: "Lamp post", a: () => `<rect x="-2" y="-30" width="4" height="30" fill="#4A4E69"/><rect x="-6" y="-38" width="12" height="9" rx="2" fill="#FFE98A" stroke="#4A4E69" stroke-width="2"/><circle cx="0" cy="-34" r="9" fill="#FFE98A" opacity=".3"/>` },
  flag: { n: "Flag", a: (c) => `<rect x="-1.5" y="-38" width="3" height="38" fill="#8D6E63"/><path d="M1.5 -37 L20 -31 L1.5 -24Z" fill="${c}"/><circle cx="0" cy="-39" r="2.4" fill="#FFD43B"/>` },
  swing: { n: "Swing", a: () => `<path d="M-15 0 L-11 -32 L-7 0 M7 0 L11 -32 L15 0 M-11 -32 H11" stroke="#C0392B" stroke-width="3" fill="none"/><path d="M-4 -32 V-10 M4 -32 V-10" stroke="#555" stroke-width="1.2"/><rect x="-6" y="-11" width="12" height="3" rx="1" fill="#3D7BFF"/>` },
  slide: { n: "Slide", a: () => `<path d="M-12 0 V-28 M-6 0 V-28" stroke="#4A4E69" stroke-width="2.5"/><path d="M-12 -8 H-6 M-12 -16 H-6 M-12 -24 H-6" stroke="#4A4E69" stroke-width="2"/><path d="M-6 -28 Q4 -26 8 -12 Q11 -3 16 0" stroke="#FFD43B" stroke-width="6" fill="none" stroke-linecap="round"/>` },
  sandcastle: { n: "Sandcastle", a: () => `<path d="M-14 0 V-12 H-10 V-16 H-6 V-12 H6 V-16 H10 V-12 H14 V0Z" fill="#E8C877"/><rect x="-5" y="-22" width="10" height="10" fill="#E8C877"/><path d="M-5 -22 V-25 H-2 V-22 M2 -22 V-25 H5 V-22" fill="#E8C877" stroke="#E8C877"/><path d="M0 -25 V-33 L6 -30 L0 -28" fill="#E63946" stroke="#8D6E63" stroke-width="1"/><path d="M-3 0 V-5 Q0 -8 3 -5 V0" fill="#C9A85A"/>` },
  shell: { n: "Shell", a: () => `<path d="M0 -2 L-11 -12 Q0 -24 11 -12Z" fill="#FFB3C7" stroke="#E87DA0" stroke-width="1.5"/><path d="M0 -2 L-5 -18 M0 -2 L0 -20 M0 -2 L5 -18" stroke="#E87DA0" stroke-width="1.2"/>` },
  bench: { n: "Bench", a: () => `<rect x="-14" y="-12" width="28" height="4" rx="1" fill="#A0703F"/><rect x="-14" y="-20" width="28" height="4" rx="1" fill="#B5814D"/><path d="M-11 -8 V0 M11 -8 V0" stroke="#4A4E69" stroke-width="3"/>` },
  fence: { n: "Fence", a: () => `<path d="M-16 -8 H16 M-16 -16 H16" stroke="#E9D6B4" stroke-width="3.5"/>${[-12, 0, 12].map((x) => `<path d="M${x - 3} 0 V-20 L${x} -24 L${x + 3} -20 V0Z" fill="#FFF8E7" stroke="#D9C49A" stroke-width="1.2"/>`).join("")}` },
  pumpkin: { n: "Pumpkin", a: () => `<ellipse cx="-6" cy="-9" rx="8" ry="9" fill="#F28C28"/><ellipse cx="6" cy="-9" rx="8" ry="9" fill="#F28C28"/><ellipse cx="0" cy="-9" rx="7" ry="10" fill="#FF9F3A"/><path d="M0 -18 q1 -5 4 -6" stroke="#3E8E41" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-5 -10 l2 -3 l2 3z M1 -10 l2 -3 l2 3z" fill="#7A3E0E"/><path d="M-4 -5 q4 3 8 0" stroke="#7A3E0E" stroke-width="1.6" fill="none"/>` },
  xmastree: { n: "Christmas tree", a: () => pineArt(`<circle cx="-6" cy="-14" r="2.5" fill="#E63946"/><circle cx="6" cy="-20" r="2.5" fill="#FFD43B"/><circle cx="-3" cy="-28" r="2.2" fill="#3D7BFF"/><circle cx="5" cy="-12" r="2.2" fill="#C77DFF"/><path d="M0 -51 l2.4 5 5.4 .6 -4 3.6 1.2 5.3 -5 -2.8 -5 2.8 1.2 -5.3 -4 -3.6 5.4 -.6z" fill="#FFD43B"/>`) },
  presents: { n: "Presents", a: () => `<rect x="-14" y="-14" width="15" height="14" fill="#E63946"/><path d="M-6.5 -14 V0 M-14 -7 H1" stroke="#FFD43B" stroke-width="2.4"/><rect x="2" y="-10" width="12" height="10" fill="#3D7BFF"/><path d="M8 -10 V0 M2 -5 H14" stroke="#fff" stroke-width="2"/><path d="M-6.5 -14 q-5 -5 -2 -6 q2 0 2 6 q0 -6 2 -6 q3 1 -2 6" fill="#FFD43B"/>` },
  easteregg: { n: "Easter egg", a: () => `<ellipse cx="0" cy="-13" rx="10" ry="13" fill="#C77DFF"/><path d="M-10 -14 q5 -4 10 0 t10 0" stroke="#FFD43B" stroke-width="2.6" fill="none"/><path d="M-9 -7 q4.5 3 9 0 t9 0" stroke="#fff" stroke-width="2" fill="none"/><circle cx="-3" cy="-20" r="1.6" fill="#fff"/><circle cx="4" cy="-21" r="1.6" fill="#FF5E8A"/>` },
  lantern: { n: "Lantern", a: () => `<path d="M-10 0 V-34 H6" stroke="#8D6E63" stroke-width="2.5" fill="none"/><path d="M4 -34 V-30" stroke="#8D6E63" stroke-width="1.2"/><ellipse cx="4" cy="-22" rx="7" ry="8" fill="#E63946"/><rect x="1" y="-31" width="6" height="2.5" fill="#FFD43B"/><rect x="1" y="-15" width="6" height="2.5" fill="#FFD43B"/><path d="M4 -12.5 v5" stroke="#FFD43B" stroke-width="1.2"/>` },
  snowman: { n: "Snowman", a: () => `<circle cx="0" cy="-9" r="10" fill="#fff" stroke="#DDE8F7"/><circle cx="0" cy="-24" r="7" fill="#fff" stroke="#DDE8F7"/><circle cx="-2.5" cy="-25" r="1.2" fill="#17203B"/><circle cx="2.5" cy="-25" r="1.2" fill="#17203B"/><path d="M0 -23 l6 1.5 -6 1z" fill="#FF8A2A"/><path d="M-7 -18 H7" stroke="#E63946" stroke-width="3"/><rect x="-5" y="-35" width="10" height="5" fill="#17203B"/><rect x="-7" y="-31" width="14" height="2" fill="#17203B"/>` },
  beachball: { n: "Beach ball", a: () => `<circle cx="0" cy="-9" r="9" fill="#fff"/><path d="M0 -18 A9 9 0 0 1 9 -9 L0 -9Z" fill="#E63946"/><path d="M0 0 A9 9 0 0 1 -9 -9 L0 -9Z" fill="#3D7BFF"/><path d="M-9 -9 A9 9 0 0 1 0 -18 L0 -9Z" fill="#FFD43B"/><circle cx="0" cy="-9" r="9" fill="none" stroke="#D0D6E0"/>` },
  umbrella: { n: "Beach umbrella", a: () => `<path d="M0 0 V-30" stroke="#8D6E63" stroke-width="2.4"/><path d="M-17 -26 Q0 -44 17 -26Z" fill="#FF5E8A"/><path d="M-6 -26 Q0 -42 0 -40 Q0 -42 6 -26Z" fill="#fff"/><path d="M-17 -26 H17" stroke="#E04878" stroke-width="1.2"/>` },
  tent: { n: "Tent", a: () => `<path d="M-17 0 L0 -28 L17 0Z" fill="#FF8A2A"/><path d="M0 -28 L-6 0 H6Z" fill="#B85A12"/><path d="M0 -28 V-33" stroke="#555" stroke-width="1.6"/><path d="M0 -33 l6 2 -6 2" fill="#FFD43B"/>` },
  crystal: { n: "Magic crystal", a: () => `<path d="M-10 0 L-12 -16 L-6 -24 L-2 -6Z" fill="#B983FF"/><path d="M-3 0 L0 -34 L7 -22 L5 0Z" fill="#8E5CF7"/><path d="M4 0 L10 -18 L14 -10 L11 0Z" fill="#C9A0FF"/><path d="M0 -34 L2 -10" stroke="#E9DAFF" stroke-width="1.4"/>` },
  statue: { n: "Gold star statue", a: () => `<rect x="-9" y="-10" width="18" height="10" rx="1" fill="#B9B4AA"/><rect x="-11" y="-12" width="22" height="3" fill="#CFCAC0"/><path d="M0 -40 l4.5 9 10 1.2 -7.4 6.8 2 9.8 -9.1 -5 -9.1 5 2 -9.8 -7.4 -6.8 10 -1.2z" fill="#FFD43B" stroke="#E0A800" stroke-width="1.2"/>` },
  chest: { n: "Treasure chest", a: () => `<rect x="-13" y="-14" width="26" height="14" rx="2" fill="#A0703F"/><path d="M-13 -14 Q-13 -24 0 -24 Q13 -24 13 -14Z" fill="#B5814D"/><path d="M-13 -14 H13 M-6 -24 V0 M6 -24 V0" stroke="#FFD43B" stroke-width="2"/><rect x="-3" y="-17" width="6" height="6" rx="1" fill="#FFD43B"/><circle cx="-9" cy="-25" r="2" fill="#FFD43B" class="isl-twinkle"/>` },
  bigshroom: { n: "Glow mushroom", a: () => `<rect x="-5" y="-18" width="10" height="18" rx="4" fill="#E9F7FF"/><path d="M-18 -16 Q-18 -38 0 -38 Q18 -38 18 -16Z" fill="#3DD6C6"/><circle cx="-7" cy="-27" r="3" fill="#B6FFF6"/><circle cx="6" cy="-30" r="2.6" fill="#B6FFF6"/><circle cx="0" cy="-26" r="22" fill="#3DD6C6" opacity=".18" class="isl-twinkle"/>` },
  // Shop specials (bought with Dojo $), drawn bigger.
  fountain: { n: "Fountain", big: 1, a: () => `<ellipse cx="0" cy="-5" rx="18" ry="6" fill="#B9B4AA"/><ellipse cx="0" cy="-7" rx="15" ry="4.5" fill="#6FC8F2"/><rect x="-3" y="-24" width="6" height="18" fill="#CFCAC0"/><ellipse cx="0" cy="-24" rx="9" ry="3" fill="#CFCAC0"/><path class="isl-wave" d="M0 -26 q-2 -10 -8 -8 M0 -26 q2 -10 8 -8 M0 -26 V-36" stroke="#BFE8FF" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  bouncy: { n: "Bouncy castle", big: 1, a: () => `<rect x="-20" y="-20" width="40" height="20" rx="5" fill="#3D7BFF"/><rect x="-24" y="-30" width="9" height="30" rx="4.5" fill="#FF5E8A"/><rect x="15" y="-30" width="9" height="30" rx="4.5" fill="#FF5E8A"/><path d="M-14 -20 q4 -8 7 0 q4 -8 7 0 q4 -8 7 0 q4 -8 7 0" fill="#FFD43B"/><circle cx="-19.5" cy="-32" r="4" fill="#FFD43B"/><circle cx="19.5" cy="-32" r="4" fill="#FFD43B"/><path d="M-7 0 Q0 -14 7 0" fill="#1F4FBF"/>` },
  rainbow: { n: "Rainbow arch", big: 1, a: () => ["#E63946", "#FF8A2A", "#FFD43B", "#4CBF5A", "#3D7BFF", "#C77DFF"].map((c, i) => `<path d="M${-22 + i * 3} 0 A${22 - i * 3} ${30 - i * 3} 0 0 1 ${22 - i * 3} 0" stroke="${c}" stroke-width="3.2" fill="none"/>`).join("") + `<ellipse cx="-22" cy="-1" rx="6" ry="3.5" fill="#fff"/><ellipse cx="22" cy="-1" rx="6" ry="3.5" fill="#fff"/>` },
  lighthouse: { n: "Lighthouse", big: 1, a: () => `<path d="M-10 0 L-6 -44 H6 L10 0Z" fill="#fff" stroke="#D0D6E0"/><path d="M-9.1 -10 H9.1 L8.2 -20 H-8.2Z M-7.4 -30 H7.4 L6.7 -38 H-6.7Z" fill="#E63946"/><rect x="-7" y="-54" width="14" height="10" rx="2" fill="#FFE98A" stroke="#4A4E69" stroke-width="2"/><path d="M-9 -54 L0 -62 L9 -54Z" fill="#E63946"/><path class="isl-twinkle" d="M7 -50 L30 -58 V-42Z" fill="#FFE98A" opacity=".55"/>` },
  treehouse: { n: "Treehouse", big: 1, a: () => `<rect x="-5" y="-30" width="10" height="30" fill="#8D6E63"/><circle cx="0" cy="-46" r="20" fill="#3FA34D"/><circle cx="-14" cy="-38" r="10" fill="#4CBF5A"/><circle cx="14" cy="-40" r="10" fill="#4CBF5A"/><rect x="-14" y="-40" width="28" height="16" fill="#B5814D"/><path d="M-17 -40 L0 -52 L17 -40Z" fill="#C0392B"/><rect x="-4" y="-35" width="8" height="11" fill="#7A4E2D"/><path d="M10 -24 V0 M16 -24 V0 M10 -18 H16 M10 -12 H16 M10 -6 H16" stroke="#A0703F" stroke-width="1.6"/>` },
  ship: { n: "Pirate ship", big: 1, a: () => `<path d="M-24 -12 H24 L16 0 H-16Z" fill="#7A4E2D"/><path d="M-24 -12 H24" stroke="#5B3A20" stroke-width="2"/><rect x="-1.5" y="-50" width="3" height="38" fill="#5B3A20"/><path d="M1.5 -48 Q16 -38 1.5 -26Z" fill="#fff"/><path d="M-1.5 -46 Q-16 -36 -1.5 -24Z" fill="#F4F0E6"/><path d="M1.5 -52 L12 -49 L1.5 -46Z" fill="#17203B"/><circle cx="-12" cy="-6" r="2" fill="#FFD43B"/><circle cx="0" cy="-6" r="2" fill="#FFD43B"/><circle cx="12" cy="-6" r="2" fill="#FFD43B"/>` },
  volcano: { n: "Volcano", big: 1, a: () => `<path d="M-26 0 L-8 -36 H8 L26 0Z" fill="#8D6E63"/><path d="M-8 -36 H8 L5 -30 Q0 -26 -5 -30Z" fill="#FF5A1F"/><path d="M-3 -32 Q-6 -20 -10 -12 M3 -32 Q5 -22 9 -16" stroke="#FF8A2A" stroke-width="3" fill="none" stroke-linecap="round"/><g class="isl-smoke"><circle cx="0" cy="-44" r="6" fill="#D0D6E0"/><circle cx="6" cy="-52" r="5" fill="#E4E8EF"/><circle cx="-4" cy="-56" r="4" fill="#EEF1F5"/></g>` },
  rocket: { n: "Rocket", big: 1, a: () => `<path d="M0 -60 Q12 -46 10 -12 H-10 Q-12 -46 0 -60Z" fill="#fff" stroke="#D0D6E0"/><path d="M0 -60 Q7 -52 8.6 -44 H-8.6 Q-7 -52 0 -60Z" fill="#E63946"/><circle cx="0" cy="-32" r="5" fill="#6FC8F2" stroke="#4A4E69" stroke-width="2"/><path d="M-10 -24 L-18 -6 H-10Z M10 -24 L18 -6 H10Z" fill="#E63946"/><path class="isl-flicker" d="M-6 -12 Q0 6 6 -12Z" fill="#FFB400"/><path d="M-10 0 H10" stroke="#4A4E69" stroke-width="3"/>` }
};
const pieceName = (p) => (GROUND[p] || THING[p] || { n: p }).n;
const SHOP = [["isl_fountain", "fountain", 25], ["isl_bouncy", "bouncy", 35], ["isl_lighthouse", "lighthouse", 40], ["isl_rainbow", "rainbow", 50], ["isl_treehouse", "treehouse", 60], ["isl_ship", "ship", 80], ["isl_volcano", "volcano", 100], ["isl_rocket", "rocket", 120]]
  .map(([id, piece, cost]) => ({ id, piece, cost, name: THING[piece].n }));
const RARE = ["crystal", "statue", "chest", "bigshroom"];

/* ---------- earning pieces ---------- */
const STARTER = { id: "start", name: "Starter pack", icon: "🎒", p: { tree: 2, flowers: 3, rock: 1, sand: 4, path: 4 } };
const CORE = [
  [5, "Garden bundle", "🌷", { flowers: 3, bush: 2, sunflower: 1 }],
  [10, "Beach bundle", "🏖️", { sand: 6, palm: 2, shell: 3, beachball: 1 }],
  [20, "Pond bundle", "💧", { water: 6, rock: 2, stones: 4 }],
  [30, "Camping bundle", "🏕️", { tent: 1, campfire: 1, lamp: 2, bench: 1 }],
  [45, "Playground bundle", "🛝", { swing: 1, slide: 1, flag: 1, sandcastle: 1 }],
  [60, "Forest bundle", "🌲", { tree: 3, pine: 3, mushroom: 3 }],
  [80, "Path bundle", "🧱", { path: 10, fence: 6, lamp: 2 }],
  [100, "Desert bundle", "🌵", { cactus: 3, sand: 8, rock: 2 }],
  [125, "Big garden bundle", "🌻", { flowers: 6, sunflower: 3, bush: 3, flowerbed: 6 }],
  [150, "Party bundle", "🎉", { flag: 2, beachball: 1, lamp: 2, bench: 2 }]
].map(([at, name, icon, p]) => ({ id: "c" + at, at, name, icon, p }));
const BONUS_EVERY = 50;
// A new themed set each month (Australian seasons). Earning 5, 15 and 30 Dojos in the month unlocks its 3 bundles.
const MONTH_AT = [5, 15, 30];
const THEMES = {
  summer: ["Summer", "☀️", [{ umbrella: 1, beachball: 1, sand: 4 }, { sandcastle: 2, shell: 2, palm: 1 }, { water: 6, umbrella: 1, campfire: 1 }]],
  lunar: ["Lunar New Year", "🏮", [{ lantern: 2, flowers: 2 }, { lantern: 2, flowerbed: 4 }, { lantern: 3, tree: 2 }]],
  autumn: ["Autumn", "🍂", [{ leaves: 6, mushroom: 1 }, { tree: 2, leaves: 6, bench: 1 }, { pumpkin: 2, mushroom: 2, leaves: 6 }]],
  easter: ["Easter", "🐣", [{ easteregg: 2, flowers: 2 }, { easteregg: 2, flowerbed: 4 }, { easteregg: 3, bush: 2 }]],
  winter: ["Winter", "❄️", [{ snow: 6, pine: 1 }, { snowman: 1, snow: 6, lamp: 1 }, { snowman: 1, campfire: 1, pine: 2 }]],
  spring: ["Spring", "🌸", [{ flowers: 3, flowerbed: 4 }, { sunflower: 2, bush: 2 }, { tree: 2, flowers: 3, swing: 1 }]],
  spooky: ["Spooky", "🎃", [{ pumpkin: 2, mushroom: 1 }, { pumpkin: 2, lantern: 2 }, { pumpkin: 2, campfire: 1, leaves: 6 }]],
  christmas: ["Christmas", "🎄", [{ xmastree: 1, presents: 1 }, { presents: 2, lamp: 2, snow: 6 }, { xmastree: 1, snowman: 1, presents: 1 }]]
};
const MONTH_THEME = ["summer", "lunar", "autumn", "easter", "autumn", "winter", "winter", "winter", "spring", "spooky", "spring", "christmas"];
const FAMILY_START = { id: "fstart", name: "Family starter", icon: "🏡", p: { tree: 3, flowers: 4, bench: 2, path: 8, flag: 1 } };
const FAMILY_BUNDLES = [
  ["Picnic", "🧺", { bench: 1, tree: 2, flowers: 3 }], ["Splash", "💦", { water: 6, rock: 2, stones: 3 }], ["Play park", "🛝", { slide: 1, swing: 1, beachball: 1 }],
  ["Camp", "🏕️", { tent: 1, campfire: 1, lamp: 2 }], ["Beach", "🏖️", { sand: 6, palm: 2, umbrella: 1 }], ["Garden", "🌻", { sunflower: 2, flowerbed: 6, bush: 2 }],
  ["Treasure", "💎", { chest: 1, crystal: 1, statue: 1 }]
];
const FAMILY_EVERY = 10;
const monthKey = (t) => { const d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1); };

function bundlesFor(owner) {
  const out = [];
  if (owner === "family") {
    out.push(FAMILY_START);
    const total = S.awards.filter((a) => a.kind === "earn" && a.bid !== "admin").reduce((n, a) => n + (a.pts || 0), 0);
    for (let i = 1; i * FAMILY_EVERY <= total; i++) { const [name, icon, p] = FAMILY_BUNDLES[(i - 1) % FAMILY_BUNDLES.length]; out.push({ id: "f" + i, at: i * FAMILY_EVERY, name: name + " bundle", icon, p }); }
    return out;
  }
  const kid = A.kidById(owner); if (!kid) return out;
  const st = A.stats(owner), isl = kid.island || {};
  out.push(STARTER);
  CORE.forEach((b) => { if (st.earned >= b.at) out.push(b); });
  for (let at = CORE[CORE.length - 1].at + BONUS_EVERY, i = 0; at <= st.earned; at += BONUS_EVERY, i++) { const b = CORE[i % CORE.length]; out.push({ id: "b" + at, at, name: "Bonus " + b.name.toLowerCase(), icon: "🎁", p: b.p }); }
  const months = {};
  S.awards.forEach((a) => { if (a.kid === owner && a.kind === "earn") months[monthKey(a.at)] = (months[monthKey(a.at)] || 0) + (a.pts || 0); });
  Object.keys(months).sort((a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return ya - yb || ma - mb; }).forEach((mk) => {
    const th = THEMES[MONTH_THEME[+mk.split("-")[1] - 1]];
    MONTH_AT.forEach((at, i) => { if (months[mk] >= at) out.push({ id: "m" + mk + "-" + i, at, name: `${th[0]} bundle ${i + 1}`, icon: th[1], p: th[2][i] }); });
  });
  for (let n = 0; n < (kid.eggs || 0); n++) { const p = RARE[hash(owner + ":isl:" + n) % RARE.length]; out.push({ id: "e" + n, name: "Mystery egg prize", icon: "🥚", p: { [p]: 1 } }); }
  SHOP.forEach((s) => { if (st.owned.has(s.id)) out.push({ id: "s" + s.id, name: s.name, icon: "🛍️", p: { [s.piece]: 1 } }); });
  const ex = isl.extra || {};
  if (Object.keys(ex).some((p) => ex[p])) out.push({ id: "x", name: "From a grown-up", icon: "🎁", p: ex, hidden: true });
  return out;
}
function inventory(owner) {
  const inv = { grass: Infinity };
  bundlesFor(owner).forEach((b) => Object.entries(b.p).forEach(([p, n]) => { inv[p] = Math.max(0, (inv[p] || 0) + n); }));
  return inv;
}
// The next thing to earn: the island track and this month's set.
function nextUp(owner) {
  if (owner === "family") {
    const total = S.awards.filter((a) => a.kind === "earn" && a.bid !== "admin").reduce((n, a) => n + (a.pts || 0), 0), i = Math.floor(total / FAMILY_EVERY) + 1, [name, icon] = FAMILY_BUNDLES[(i - 1) % FAMILY_BUNDLES.length];
    return { track: { name: name + " bundle", icon, need: i * FAMILY_EVERY - total, pct: (total % FAMILY_EVERY) / FAMILY_EVERY } };
  }
  const st = A.stats(owner), nb = CORE.find((b) => st.earned < b.at);
  const lastAt = nb ? (CORE[CORE.indexOf(nb) - 1] || { at: 0 }).at : CORE[CORE.length - 1].at + Math.floor((st.earned - CORE[CORE.length - 1].at) / BONUS_EVERY) * BONUS_EVERY;
  const at = nb ? nb.at : lastAt + BONUS_EVERY;
  const track = { name: nb ? nb.name : "Bonus bundle", icon: nb ? nb.icon : "🎁", need: at - st.earned, pct: (st.earned - lastAt) / (at - lastAt) };
  const now = monthKey(Date.now()), th = THEMES[MONTH_THEME[new Date().getMonth()]];
  const mPts = S.awards.filter((a) => a.kid === owner && a.kind === "earn" && monthKey(a.at) === now).reduce((n, a) => n + (a.pts || 0), 0);
  const mi = MONTH_AT.findIndex((x) => mPts < x);
  return { track, month: { theme: th[0], icon: th[1], got: mi < 0 ? 3 : mi, need: mi < 0 ? 0 : MONTH_AT[mi] - mPts, pct: mi < 0 ? 1 : mPts / MONTH_AT[mi] } };
}

/* ---------- island data ---------- */
function islandOf(owner) {
  const src = owner === "family" ? (S.cfg && S.cfg.familyIsland) : (A.kidById(owner) || {}).island;
  return Object.assign({ g: {}, o: {}, sign: [], seen: 0, got: [], extra: {} }, JSON.parse(JSON.stringify(src || {})));
}
function save(owner, isl) {
  if (owner === "family") A.saveFamilyIsland(JSON.parse(JSON.stringify(isl)));
  else { const kid = A.kidById(owner); if (kid) A.setMonster(kid, { island: JSON.parse(JSON.stringify(isl)) }); }
}
function groundAt(isl, x, y) { return isl.g[key(x, y)] || baseGround(x, y); }
function placed(isl) {
  const n = {};
  Object.entries(isl.g).forEach(([k, p]) => { const [x, y] = k.split(",").map(Number); if (land(x, y) && !reserved(k) && p !== baseGround(x, y)) n[p] = (n[p] || 0) + 1; });
  Object.entries(isl.o).forEach(([k, p]) => { const [x, y] = k.split(",").map(Number); if (land(x, y) && !reserved(k)) n[p] = (n[p] || 0) + 1; });
  return n;
}
function left(owner, isl, p) { return (inventory(owner)[p] || 0) - (placed(isl)[p] || 0); }
const walkable = (isl, x, y) => land(x, y) && !HOUSE_CELLS.includes(key(x, y)) && key(x, y) !== SIGN && !isl.o[key(x, y)] && groundAt(isl, x, y) !== "water";

/* ---------- drawing ---------- */
const ownerColor = (owner) => owner === "family" ? "#FFB400" : ((A.kidById(owner) || {}).look || {}).color || "#2BB3A3";
const ownerName = (owner) => owner === "family" ? "Family" : (A.kidById(owner) || {}).name || "";
function signArt(isl, owner) {
  const st = (isl.sign || []).slice(-3);
  return `<g transform="translate(${4 * C + C / 2} ${10 * C - 4})"><rect x="-1.5" y="-24" width="3" height="24" fill="#8D6E63"/><rect x="-17" y="-34" width="34" height="18" rx="3" fill="#FFF8E7" stroke="#8D6E63" stroke-width="2"/>${st.length ? st.map((s, i) => `<text x="${-10 + i * 10}" y="-21" text-anchor="middle" font-size="10">${esc(s.e)}</text>`).join("") : `<text x="0" y="-22" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="8" fill="#5B4636">Welcome</text>`}</g>`;
}
function islandSvg(owner, isl, opt) {
  opt = opt || {};
  const color = ownerColor(owner), parts = [];
  let s = `<svg viewBox="0 0 ${W} ${W}" ${opt.mini ? "" : `class="isl-svg"`} aria-hidden="true"><defs><radialGradient id="islSea${opt.mini ? owner : ""}" cx=".5" cy=".5" r=".7"><stop offset=".55" stop-color="#5CC3F0"/><stop offset="1" stop-color="#2E8FD6"/></radialGradient></defs>
    <rect width="${W}" height="${W}" fill="url(#islSea${opt.mini ? owner : ""})"/>
    ${opt.mini ? "" : [[30, 40], [330, 70], [60, 360], [350, 330], [200, 20]].map(([x, y]) => `<path class="isl-wave" d="M${x} ${y} q6 -4 12 0 t12 0" stroke="#BFE8FF" stroke-width="2" fill="none" opacity=".8"/>`).join("")}
    <g transform="translate(${M} ${M})">`;
  // a soft shoreline under the squares
  s += `<ellipse cx="${N * C / 2}" cy="${N * C / 2 + 6}" rx="${N * C / 2 + 4}" ry="${N * C / 2 + 4}" fill="#E8C877" opacity=".55"/>`;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!land(x, y)) continue;
    const g = GROUND[groundAt(isl, x, y)] || GROUND.grass, px = x * C, py = y * C;
    s += `<rect x="${px}" y="${py}" width="${C + .5}" height="${C + .5}" fill="${g.c}"/>${g.d(px, py)}`;
  }
  if (opt.grid) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (land(x, y) && !reserved(key(x, y))) s += `<rect x="${x * C + .5}" y="${y * C + .5}" width="${C - 1}" height="${C - 1}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>`;
  // dock and boat (bottom), house (top), welcome sign, then things back to front
  s += `<g><rect x="${5 * C + 8}" y="${9 * C + 6}" width="${C - 16}" height="${C + 24}" fill="#B5814D"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${5 * C + 8} ${9 * C + 12 + i * 11} H${6 * C - 8}" stroke="#8D6E63" stroke-width="1.4"/>`).join("")}</g>`;
  if (!opt.noBoat) s += `<g transform="translate(${6 * C + 12} ${10 * C + 18})"><path d="M-16 -6 H16 L10 4 H-10Z" fill="#E63946"/><path d="M0 -6 V-26" stroke="#5B3A20" stroke-width="2"/><path d="M1 -25 L14 -9 H1Z" fill="#fff"/></g>`;
  const items = [];
  const tier = owner === "family" ? 3 : A.houseTier(A.stats(owner).owned);
  items.push([2.99, `<g transform="translate(${4 * C - 2} ${3 * C - 2 - 110 * .63}) scale(.63)">${A.houseOutsideSvg(tier, owner === "family" ? "#FFB400" : color)}</g>`]);
  items.push([9.5, signArt(isl, owner)]);
  Object.entries(isl.o).forEach(([k, p]) => {
    const [x, y] = k.split(",").map(Number), t = THING[p];
    if (!t || !land(x, y) || reserved(k)) return;
    items.push([y, `<g class="isl-thing" transform="translate(${x * C + C / 2} ${y * C + C - 3})${t.big ? " scale(1.25)" : ""}">${t.a(color)}</g>`]);
  });
  items.sort((a, b) => a[0] - b[0]).forEach((i) => { s += i[1]; });
  s += `</g></svg>`;
  return s;
}
function trayIcon(p) {
  if (GROUND[p]) { const g = GROUND[p]; return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="8" fill="${g.c}"/>${g.d(0, 0)}</svg>`; }
  const t = THING[p]; return `<svg viewBox="${t.big ? "-32 -66 64 70" : "-22 -48 44 52"}" aria-hidden="true">${t.a("#3D7BFF")}</svg>`;
}

/* ---------- walkers: monsters and pets on the island ---------- */
const WALK = { st: {}, raf: 0, last: 0, root: null, owner: null };
function actorsFor(owner, visitor) {
  const out = [], add = (k, arriving) => {
    const st = A.stats(k.id); out.push({ id: "k:" + k.id, kid: k, type: "monster", level: st.level, arriving });
    A.PET_IDS.filter((p) => st.owned.has(p) && p !== (A.wornBy(k)).pet).slice(0, 3).forEach((p) => out.push({ id: "p:" + k.id + ":" + p, kid: k, type: "pet", pet: p }));
  };
  if (owner === "family") (S.cfg.kids || []).forEach((k) => add(k));
  else { const k = A.kidById(owner); if (k) add(k); const v = visitor && visitor !== owner && A.kidById(visitor); if (v) add(v, true); }
  return out;
}
function cellPos(x, y) { return { left: (M + x * C) / W * 100, top: (M + y * C) / W * 100 }; }
function placeW(st) {
  const p = cellPos(st.x, st.y), el = st.el; if (!el) return;
  el.style.left = p.left + "%"; el.style.top = p.top + "%"; el.style.zIndex = String(10 + Math.round(st.y * 10));
  el.classList.toggle("walking", st.walking);
  el.querySelector(".face").style.transform = st.dir < 0 ? "scaleX(-1)" : "";
}
function randomSpot(isl) {
  const spots = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (walkable(isl, x, y)) spots.push([x, y]);
  const s = spots[Math.floor(Math.random() * spots.length)] || [5, 8]; return { x: s[0] + .5, y: s[1] + .8 };
}
function mountWalkers(owner, visitor, isl) {
  const root = $("#islLayer"); if (!root) return;
  if (WALK.owner !== owner + "|" + visitor) { WALK.st = {}; WALK.owner = owner + "|" + visitor; }
  WALK.root = root; WALK.isl = isl;
  const actors = actorsFor(owner, visitor);
  root.innerHTML = actors.map((a) => {
    const art = a.type === "monster" ? A.monsterSvg(a.kid.look, A.dressedFor(a.kid), a.level) : `<svg viewBox="-30 -34 60 60" aria-hidden="true">${A.petSvg(a.pet)}</svg>`;
    return `<button class="walker ${a.type}" data-iw="${esc(a.id)}" style="--kid:${esc(a.kid.look.color)}" aria-label="${esc(a.type === "monster" ? (a.kid.monsterName || a.kid.name + "'s monster") : a.pet)}"><span class="shadow"></span><span class="act"><span class="face"><span class="bob">${art}</span></span></span>${a.type === "monster" ? `<span class="tag">${esc(a.kid.monsterName || a.kid.name)}</span>` : ""}</button>`;
  }).join("");
  actors.forEach((a) => {
    if (!WALK.st[a.id]) {
      const start = a.arriving ? { x: 5.5, y: 9.9 } : a.type === "pet" && WALK.st["k:" + a.kid.id] ? { x: WALK.st["k:" + a.kid.id].x + .8, y: WALK.st["k:" + a.kid.id].y } : randomSpot(isl);
      WALK.st[a.id] = Object.assign(start, { tx: start.x, ty: start.y, wait: a.arriving ? 0 : Math.random() * 2, walking: false, dir: 1 });
      if (a.arriving) { const t = { x: 5.5, y: 7.8 }; WALK.st[a.id].tx = t.x; WALK.st[a.id].ty = t.y; WALK.st[a.id].cmd = true; }
    }
    const st = WALK.st[a.id]; st.actor = a; st.el = root.querySelector(`[data-iw="${CSS.escape(a.id)}"]`);
    st.el.onclick = (e) => { e.stopPropagation(); tapWalker(st); };
    placeW(st);
  });
  if (!WALK.raf && !A.reduced()) { WALK.last = performance.now(); WALK.raf = requestAnimationFrame(tick); }
}
function tick(t) {
  if (!WALK.root || !document.body.contains(WALK.root)) { WALK.raf = 0; return; }
  const dt = Math.min(.05, (t - WALK.last) / 1000); WALK.last = t;
  Object.values(WALK.st).forEach((st) => {
    if (!st.el) return;
    if (st.busy > 0) { st.busy -= dt; st.walking = false; }
    else if (st.wait > 0) { st.wait -= dt; st.walking = false; if (st.wait <= 0) { const own = st.actor.type === "pet" && WALK.st["k:" + st.actor.kid.id]; const r = own && Math.random() < .6 ? { x: own.x + (Math.random() - .5) * 2, y: own.y + (Math.random() - .5) } : randomSpot(WALK.isl); st.tx = Math.max(.5, Math.min(N - .5, r.x)); st.ty = Math.max(.8, Math.min(N - .2, r.y)); } }
    else {
      const dx = st.tx - st.x, dy = st.ty - st.y, d = Math.hypot(dx, dy), sp = (st.cmd ? 2.6 : st.actor.type === "pet" ? 1.9 : 1.2) * dt;
      if (d < .05) { st.walking = false; st.wait = st.cmd ? 5 : 1 + Math.random() * 3; st.cmd = false; if (st.then) { const f = st.then; st.then = null; f(); } }
      else { st.walking = true; st.x += dx / d * Math.min(sp, d); st.y += dy / d * Math.min(sp, d); if (Math.abs(dx) > .02) st.dir = dx < 0 ? -1 : 1; }
    }
    placeW(st);
  });
  WALK.raf = requestAnimationFrame(tick);
}
const JUMP = [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(4%) scale(1.15, .85)", offset: .15 }, { transform: "translateY(-55%) scale(.9, 1.1)", offset: .45 }, { transform: "translateY(0) scale(1.12, .88)", offset: .8 }, { transform: "translateY(0) scale(1)" }];
function sayOn(st, text) {
  const el = st.el; if (!el) return;
  const old = el.querySelector(".bubble"); if (old) old.remove();
  const b = document.createElement("span"); b.className = "bubble"; b.textContent = text; el.appendChild(b); setTimeout(() => b.remove(), 1600);
}
function jump(st) { st.busy = 1.2; if (!A.reduced() && st.el) st.el.querySelector(".act").animate(JUMP, { duration: 800, easing: "ease-in-out" }); }
function floaties(st, icons) {
  const stage = $("#islStage"); if (!stage || A.reduced() || !st.el) return;
  const r = st.el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  icons.forEach((ic, i) => setTimeout(() => {
    const f = document.createElement("span"); f.className = "floaty"; f.textContent = ic;
    f.style.left = (r.left - sr.left + r.width / 2 + (Math.random() - .5) * 40) + "px"; f.style.top = (r.top - sr.top + r.height * .3) + "px";
    stage.appendChild(f);
    f.animate([{ transform: "translate(-50%, 0) scale(.5)", opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 60}px), -70px) scale(1.2)`, opacity: 0 }], { duration: 1000, easing: "ease-out" }).onfinish = () => f.remove();
  }, i * 90));
}
const SAYS = ["I love my island!", "Wheee!", "Yay!", "Look at this!", "Let's play!", "Hee hee!"];
function tapWalker(st) {
  const a = st.actor;
  jump(st); A.beep([[523, .15, 0, "pluck"], [784, .15, .08, "pluck"], [1175, .3, .16, "pluck"]], .45);
  const say = a.type === "pet" ? "Hi!" : SAYS[Math.floor(Math.random() * SAYS.length)];
  sayOn(st, say); A.speak(say, a.type === "pet" ? "pet" : a.kid); floaties(st, ["💖", "⭐", "✨"]);
}

/* ---------- views ---------- */
const route = () => S.route;
function canEdit(r) { return r.kid === "family" || r.as === r.kid || r.help || A.adminPlay(); }
function sailor() { const kids = S.cfg.kids || []; const id = route().as || lgetSailor(); return kids.some((k) => k.id === id) ? id : (kids[0] || {}).id; }
function lgetSailor() { try { return JSON.parse(localStorage.getItem("hd.sailor") || "null"); } catch (e) { return null; } }
function lsetSailor(id) { try { localStorage.setItem("hd.sailor", JSON.stringify(id)); } catch (e) {} }
const TOD_PIECES = ["flowers", "tree", "sunflower", "mushroom", "beachball", "rock", "bush", "palm", "pumpkin", "snowman", "easteregg", "presents"];
const toddlerHere = (r) => r.kid !== "family" && r.as === r.kid && A.isToddler(A.kidById(r.kid) || {}) && !r.full;
const UI = { hold: null, trayX: 0, sweep: false };

function trayPieces(owner, isl, r) {
  const inv = inventory(owner), pl = placed(isl);
  let list = Object.keys(GROUND).concat(Object.keys(THING)).filter((p) => p === "grass" || (inv[p] || 0) > 0 || (pl[p] || 0) > 0);
  if (toddlerHere(r)) list = TOD_PIECES.filter((p) => (inv[p] || 0) - (pl[p] || 0) > 0).slice(0, 6);
  return list.map((p) => ({ p, left: p === "grass" ? Infinity : (inv[p] || 0) - (pl[p] || 0) }));
}
function progressHtml(owner) {
  const nx = nextUp(owner), bar = (pct) => `<div class="bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%"></i></div>`;
  const d = (n) => `${n} more Dojo${n === 1 ? "" : "s"}`;
  if (owner === "family") return `<div class="isl-prog"><div><b>${nx.track.icon} Next family bundle: ${esc(nx.track.name)}</b>${bar(nx.track.pct)}<span class="meta">${d(nx.track.need)} from anyone in the family</span></div></div>`;
  return `<div class="isl-prog"><div><b>${nx.track.icon} Island track: ${esc(nx.track.name)}</b>${bar(nx.track.pct)}<span class="meta">${d(nx.track.need)} to unlock it</span></div>
    <div><b>${nx.month.icon} ${esc(nx.month.theme)} set this month: ${nx.month.got} of 3</b>${bar(nx.month.pct)}<span class="meta">${nx.month.need ? `${d(nx.month.need)} this month for the next one. Pieces you win stay forever.` : "All 3 won this month! New pieces next month."}</span></div></div>`;
}
function shopHtml(kid, st) {
  st = st || A.stats(kid.id);
  return `<div class="sect"><h3>🏝️ Island specials</h3><p>Big pieces for ${esc(kid.name)}'s island</p></div><div class="grid">${SHOP.map((s) => {
    const has = st.owned.has(s.id);
    return `<div class="item${has ? " on" : ""}"><div class="m isl-shopart">${trayIcon(s.piece)}</div><div class="n">${esc(s.name)}</div>${has ? `<span class="pill given">On the island ✓</span>` : `<button class="btn small kid" data-isbuy="${s.id}" data-iskid="${esc(kid.id)}" ${st.balance < s.cost ? "disabled" : ""}>${A.coin(s.cost)}</button>`}${!has && st.balance < s.cost ? `<div class="meta">${s.cost - st.balance} more Dojo $</div>` : ""}</div>`;
  }).join("")}</div>`;
}
function newBundles(owner, isl) { const got = new Set(isl.got || []); return bundlesFor(owner).filter((b) => !got.has(b.id) && !b.hidden); }
function hasNew(owner) {
  const isl = islandOf(owner);
  if (!isl.got || !isl.got.length) return true;                     // never opened: the starter pack is waiting
  return newBundles(owner, isl).length > 0 || (isl.sign || []).some((s) => s.at > (isl.seen || 0));
}
function viewIsland(r) {
  const owner = r.kid, kid = owner === "family" ? null : A.kidById(owner);
  if (owner !== "family" && !kid) { S.route = { name: "islands" }; return viewMap(); }
  const isl = islandOf(owner), edit = canEdit(r), tod = toddlerHere(r), visitor = r.as && r.as !== owner && owner !== "family" ? A.kidById(r.as) : null;
  const color = ownerColor(owner), title = owner === "family" ? "The family island" : `${esc(kid.name)}'s island`;
  const tray = edit ? trayPieces(owner, isl, r) : [];
  const hold = UI.hold && tray.some((t) => t.p === UI.hold) ? UI.hold : null; UI.hold = hold;
  const hint = !edit ? `You're visiting ${esc(kid.name)}! Say hi, leave a sticker on the sign, or ask to help build.`
    : tod ? "Tap a picture, then tap the island to put it there!"
    : hold ? `Tap the island to put down the ${esc(pieceName(hold).toLowerCase())}. Tap it in the tray again to stop.`
    : UI.sweep ? "Tap things on the island to put them back in the tray." : "Pick something from the tray, then tap the island to put it there. Tap something on the island to pick it up and move it.";
  return `<div class="isl-page" style="--kid:${esc(color)}">
    <div class="row" style="margin-bottom:10px;justify-content:space-between"><button class="iconbtn" id="islBack" aria-label="Back">← ${r.from === "kid" ? "Back" : "All monsters"}</button><button class="btn small ghost" id="islMap">🗺️ Island map</button></div>
    <h1 class="isl-title">${title}${r.help ? ` <span class="pill ready">Helping</span>` : ""}</h1>
    ${visitor ? `<p class="meta" style="margin:0 0 8px">${esc(visitor.name)} sailed over to visit.</p>` : ""}
    <section class="isl-stage${hold || UI.sweep ? " holding" : ""}" id="islStage" aria-label="${title}">${islandSvg(owner, isl, { grid: edit && !tod })}<div class="isl-layer" id="islLayer"></div></section>
    <p class="meta isl-hint">${hint}</p>
    ${edit ? `<div class="isl-tray${tod ? " tod" : ""}" id="islTray" role="toolbar" aria-label="Island pieces">
      ${tod ? `<button class="isl-pc tool${UI.sweep ? " on" : ""}" data-islsweep aria-pressed="${UI.sweep}" aria-label="Tidy up"><span class="ic">🧹</span><small>Tidy</small></button>` : ""}
      ${tray.map((t) => `<button class="isl-pc${hold === t.p ? " on" : ""}${t.left <= 0 ? " empty" : ""}" data-islpc="${t.p}" aria-pressed="${hold === t.p}" aria-label="${esc(pieceName(t.p))}${t.left === Infinity ? "" : `, ${t.left} left`}"><span class="ic">${trayIcon(t.p)}</span><small>${tod ? "" : esc(pieceName(t.p))}</small>${t.left === Infinity ? "" : `<b class="cnt">${t.left}</b>`}</button>`).join("")}
    </div>` : `<div class="isl-actions">
      <button class="btn kid" id="islWave">👋 Wave</button><button class="btn kid" id="islFive">🙌 High five</button><button class="btn kid" id="islStick">🪧 Leave a sticker</button><button class="btn ghost" id="islHelp">🧱 Can I help build?</button></div>`}
    ${edit || owner === "family" ? progressHtml(owner) : ""}
    ${kid && edit && !tod && r.as === owner ? shopHtml(kid) : ""}
  </div>`;
}
function viewMap() {
  const kids = S.cfg.kids || [], me = sailor();
  const card = (owner, big) => {
    const name = owner === "family" ? "Family island" : ownerName(owner) + "'s island", dot = hasNew(owner) && (owner === me || owner === "family");
    return `<button class="isl-card${big ? " big" : ""}" data-islgo="${esc(owner)}" style="--kid:${esc(ownerColor(owner))}" aria-label="${esc(name)}">${islandSvg(owner, islandOf(owner), { mini: true, noBoat: true })}<span class="nm">${esc(name)}${owner === me ? " (mine)" : ""}</span>${dot ? `<span class="isl-new" aria-label="Something new">🎁</span>` : ""}</button>`;
  };
  return `<div class="isl-page">
    <div class="row" style="margin-bottom:10px;justify-content:space-between"><button class="iconbtn" id="islHome" aria-label="Back to all monsters">← All monsters</button></div>
    <h1 class="isl-title">Monster Islands</h1>
    <div class="isl-who"><span class="meta">Who's sailing?</span>${kids.map((k) => `<button class="chip${k.id === me ? " on" : ""}" data-islwho="${esc(k.id)}" style="--kid:${esc(k.look.color)}" aria-pressed="${k.id === me}"><span class="mini">${A.monsterSvg(k.look, A.dressedFor(k), A.stats(k.id).level)}</span>${esc(k.name)}</button>`).join("")}</div>
    <section class="isl-sea">${card("family", true)}${kids.map((k) => card(k.id)).join("")}</section>
    <p class="meta isl-hint">Tap your own island to build, a brother's island to visit, or the family island to build together.</p></div>`;
}
function kidCard(kid) {
  return `<div class="card isl-preview" style="--kid:${esc(kid.look.color)}"><button class="isl-card big" data-islgo="${esc(kid.id)}" data-islas="${esc(kid.id)}" data-islfrom="kid" aria-label="Sail to ${esc(kid.name)}'s island">${islandSvg(kid.id, islandOf(kid.id), { mini: true, noBoat: true })}${hasNew(kid.id) ? `<span class="isl-new">🎁</span>` : ""}</button>
    <button class="btn kid" data-islgo="${esc(kid.id)}" data-islas="${esc(kid.id)}" data-islfrom="kid">⛵ Sail to my island</button>${progressHtml(kid.id)}</div>`;
}
function adminHtml(kid) {
  const inv = inventory(kid.id), ex = (kid.island || {}).extra || {}, open = S.admOpen && S.admOpen.has("isl");
  const pcs = Object.keys(GROUND).filter((p) => p !== "grass").concat(Object.keys(THING).filter((p) => !THING[p].big));
  return `<details class="card admgrp" data-grp="isl"${open ? " open" : ""}><summary><b>🏝️ Island pieces</b> <span class="meta">give or take single pieces</span></summary>
    <p class="meta" style="margin:0">Bundles come from Dojos by themselves. These buttons add or remove extra pieces on top.</p>
    ${pcs.map((p) => `<div class="admrow"><span class="t"><b>${esc(pieceName(p))}</b><small>Has ${inv[p] || 0}${ex[p] ? ` (${ex[p] > 0 ? "+" : ""}${ex[p]} from a grown-up)` : ""}</small></span><button class="btn small ghost" data-isladm="${p}" data-v="-1" data-iskid="${esc(kid.id)}" aria-label="Take one ${esc(pieceName(p))}">−</button><button class="btn small kid" data-isladm="${p}" data-v="1" data-iskid="${esc(kid.id)}" aria-label="Give one ${esc(pieceName(p))}">+</button></div>`).join("")}
    <div class="row"><button class="btn small ghost" data-islclear="${esc(kid.id)}">Clear the whole island</button></div></details>`;
}

/* ---------- interactions ---------- */
function stageCell(e) {
  const r = $("#islStage").getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W - M, sy = (e.clientY - r.top) / r.height * W - M;
  return [Math.floor(sx / C), Math.floor(sy / C)];
}
function pop(x, y, icon) {
  const stage = $("#islStage"); if (!stage || A.reduced()) return;
  const p = cellPos(x + .5, y + .3), f = document.createElement("span"); f.className = "floaty"; f.textContent = icon || "✨";
  f.style.left = p.left + "%"; f.style.top = p.top + "%"; stage.appendChild(f);
  f.animate([{ transform: "translate(-50%, 0) scale(.5)", opacity: 1 }, { transform: "translate(-50%, -50px) scale(1.2)", opacity: 0 }], { duration: 800, easing: "ease-out" }).onfinish = () => f.remove();
}
function myMonster(r) { return WALK.st["k:" + (r.kid === "family" ? sailor() : r.as || r.kid)] || WALK.st["k:" + r.kid]; }
function walkTo(st, x, y, then) { if (!st) return; st.tx = x; st.ty = y; st.wait = 0; st.busy = 0; st.cmd = true; st.then = then || null; if (A.reduced()) { st.x = x; st.y = y; placeW(st); if (then) then(); st.then = null; } }
function tapCell(r, x, y) {
  const owner = r.kid, k = key(x, y);
  if (!land(x, y)) return;
  const isl = islandOf(owner);
  if (k === SIGN) return openSign(owner, isl);
  if (HOUSE_CELLS.includes(k)) { if (owner !== "family") A.go({ name: "kid", kid: owner, tab: "monster", sub: "house" }); return; }
  if (!canEdit(r) || k === DOCK) return walkTo(myMonster(r), x + .5, y + .8);
  const tod = toddlerHere(r);
  if (UI.hold) {
    const p = UI.hold;
    if (left(owner, isl, p) <= 0 && !(GROUND[p] && groundAt(isl, x, y) === p) && !(THING[p] && isl.o[k] === p)) { A.toast(`No ${pieceName(p).toLowerCase()} left. Earn Dojos to unlock more!`); return bump(); }
    if (GROUND[p]) {
      if (groundAt(isl, x, y) === p) return;
      if (p === "water" && isl.o[k]) { A.toast("Move the thing on that square first."); return bump(); }
      if (p === baseGround(x, y)) delete isl.g[k]; else isl.g[k] = p;
      A.beep([[392, .08, 0, "pluck"], [523, .1, .05, "pluck"]], .35);
    } else {
      if (groundAt(isl, x, y) === "water") { A.toast("That would sink! Put it on dry land."); return bump(); }
      if (isl.o[k] === p) return;
      isl.o[k] = p;
      A.beep([[523, .1, 0, "pluck"], [784, .12, .07, "pluck"], [1047, .2, .14, "pluck"]], .45); pop(x, y, tod ? "⭐" : "✨");
      if (left(owner, isl, p) <= 0 && !tod) UI.hold = null;
    }
    return save(owner, isl);
  }
  if (isl.o[k]) {
    if (tod && !UI.sweep) { jiggle(x, y); A.beep([[660, .1, 0, "pluck"], [880, .12, .08, "pluck"]], .4); return; }
    const p = isl.o[k]; delete isl.o[k];
    if (!tod) UI.hold = p;
    A.beep([[784, .08, 0, "pluck"], [523, .1, .06, "pluck"]], .35);
    return save(owner, isl);
  }
  if (tod && UI.sweep && isl.g[k]) { delete isl.g[k]; return save(owner, isl); }
  walkTo(myMonster(r), x + .5, y + .8);
}
function bump() { const s = $("#islStage"); if (s && !A.reduced()) s.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 }); A.beep([[196, .12, 0]], .3); }
function jiggle(x, y) { const el = [...document.querySelectorAll("#islStage .isl-thing")].find((g) => g.getAttribute("transform").startsWith(`translate(${x * C + C / 2} ${y * C + C - 3})`)); if (el && !A.reduced()) el.animate([{ transform: el.getAttribute("transform") + " rotate(0)" }, { transform: el.getAttribute("transform") + " rotate(-10)" }, { transform: el.getAttribute("transform") + " rotate(10)" }, { transform: el.getAttribute("transform") + " rotate(0)" }], { duration: 400 }); pop(x, y, "💖"); }
const STICKERS = ["😀", "❤️", "⭐", "🦖", "🚀", "🌈", "🐶", "🍕", "⚽", "🦄", "👍", "🎉"];
function openSign(owner, isl) {
  const list = (isl.sign || []).slice().reverse();
  A.modal(`<h2>🪧 ${esc(owner === "family" ? "Family" : ownerName(owner))}'s welcome sign</h2>${list.length ? `<div class="isl-signlist">${list.map((s) => `<div class="logrow"><span style="font-size:28px">${esc(s.e)}</span><div class="t">From ${esc(ownerName(s.from) || "a visitor")}<div class="when">${new Date(s.at).toLocaleDateString([], { day: "numeric", month: "short" })}</div></div></div>`).join("")}</div>` : `<p class="meta">No stickers yet. Visitors can leave one here!</p>`}<button class="btn primary" id="sgOk" data-autofocus>OK</button>`, () => { $("#sgOk").onclick = A.closeModal; });
}
function leaveSticker(r) {
  const owner = r.kid, visitor = A.kidById(r.as);
  A.modal(`<h2>Leave a sticker for ${esc(ownerName(owner))}</h2><div class="isl-stickers">${STICKERS.map((e) => `<button class="isl-stk" data-stk="${e}" aria-label="Sticker ${e}">${e}</button>`).join("")}</div><button class="btn ghost" id="stNo">Not now</button>`, () => {
    $("#stNo").onclick = A.closeModal;
    document.querySelectorAll("[data-stk]").forEach((b) => b.onclick = () => {
      const isl = islandOf(owner); isl.sign = (isl.sign || []).concat([{ e: b.dataset.stk, from: visitor ? visitor.id : "", at: Date.now() }]).slice(-8);
      A.closeModal(); save(owner, isl); A.SND.earn(); A.toast(`Sticker left for ${ownerName(owner)}!`);
      const st = myMonster(r); if (st) { walkTo(st, 4.5, 9.7, () => { jump(st); floaties(st, [b.dataset.stk, "✨", b.dataset.stk]); }); }
    });
  });
}
function askHelp(r) {
  const owner = A.kidById(r.kid), visitor = A.kidById(r.as); if (!owner || !visitor) return;
  A.modal(`<div class="isl-ask"><span class="mini">${A.monsterSvg(visitor.look, A.dressedFor(visitor), A.stats(visitor.id).level)}</span><h2>${esc(owner.name)}, can ${esc(visitor.name)} help build your island?</h2><p class="meta">${esc(owner.name)} gets to choose.</p></div><div class="row" style="justify-content:center"><button class="btn ghost" id="hpNo">Not now</button><button class="btn kid" style="--kid:${esc(owner.look.color)}" id="hpYes" data-autofocus>Yes, let's build!</button></div>`, () => {
    $("#hpNo").onclick = () => { A.closeModal(); A.toast(`Maybe next time, ${visitor.name}!`); };
    $("#hpYes").onclick = () => { A.closeModal(); S.route.help = true; A.SND.earn(); A.rerender(); A.toast(`${visitor.name} is helping ${owner.name} build!`); };
  });
}
function wave(r) {
  Object.values(WALK.st).filter((st) => st.actor.type === "monster").forEach((st, i) => setTimeout(() => { jump(st); sayOn(st, "Hi!"); }, i * 250));
  A.beep([[660, .12, 0, "pluck"], [880, .12, .1, "pluck"], [660, .12, .3, "pluck"], [880, .2, .4, "pluck"]], .45);
  A.speak("Hi!", A.kidById(r.as) || A.kidById(r.kid), true);
}
function highFive(r) {
  const me = WALK.st["k:" + r.as], them = WALK.st["k:" + r.kid]; if (!me || !them) return;
  walkTo(me, Math.max(.6, them.x - .9), them.y, () => {
    me.dir = 1; them.dir = -1; jump(me); jump(them); sayOn(me, "High five!"); sayOn(them, "High five!");
    A.beep([[1568, .15, 0, "pluck"], [2093, .4, .06, "pluck"]], .5); floaties(me, ["✋", "⭐", "💥", "✨"]); A.speak("High five!", A.kidById(r.as), true);
  });
}
function celebrateNew(owner, isl) {
  const fresh = newBundles(owner, isl), unseen = (isl.sign || []).filter((s) => s.at > (isl.seen || 0) && s.from !== owner);
  if (!fresh.length && !unseen.length) return;
  isl.got = bundlesFor(owner).map((b) => b.id).slice(-300); isl.seen = Date.now();
  save(owner, isl);
  if (fresh.length) {
    const sum = {}; fresh.forEach((b) => Object.entries(b.p).forEach(([p, n]) => { sum[p] = (sum[p] || 0) + n; }));
    setTimeout(() => {
      A.modal(`<div class="isl-gift"><div class="big">🎁</div><h2>New island pieces!</h2><p class="meta">${fresh.map((b) => `${b.icon} ${esc(b.name)}`).join("<br>")}</p><div class="isl-giftlist">${Object.entries(sum).map(([p, n]) => `<span class="isl-pc"><span class="ic">${trayIcon(p)}</span><small>${n} × ${esc(pieceName(p))}</small></span>`).join("")}</div></div><button class="btn kid" style="--kid:${esc(ownerColor(owner))}" id="gfOk" data-autofocus>Let's build!</button>`, () => { $("#gfOk").onclick = A.closeModal; });
      A.SND.earn(); A.confetti(innerWidth / 2, innerHeight * .35, [ownerColor(owner), "#FFD43B", "#FF5E8A", "#4CBF5A"], 60);
    }, 350);
  }
  unseen.forEach((s, i) => setTimeout(() => A.toast(`${ownerName(s.from) || "Someone"} left you a ${s.e} on your sign!`), 900 + i * 2200));
}
function buyPiece(kid, s) {
  const st = A.stats(kid.id); if (!s || st.owned.has(s.id)) return;
  A.modal(`<div class="isl-shopart big">${trayIcon(s.piece)}</div><h2>Buy the ${esc(s.name)}?</h2><p class="meta">Costs <b>${A.coin(s.cost)} Dojo $</b>. ${esc(kid.name)} will have ${st.balance - s.cost} Dojo $ left. Their Dojos stay the same.</p><div class="row" style="justify-content:center"><button class="btn ghost" id="no">Not now</button><button class="btn kid" style="--kid:${esc(kid.look.color)}" id="yes" data-autofocus>Buy it</button></div>`, () => {
    $("#no").onclick = A.closeModal;
    $("#yes").onclick = () => {
      A.closeModal(); if (A.stats(kid.id).balance < s.cost) return A.toast("Not enough Dojo $ yet.");
      A.addRecord({ kid: kid.id, kind: "buy", item: s.id, label: s.name, icon: "🏝️", pts: s.cost, at: Date.now() });
      A.SND.earn(); A.toast(`The ${s.name} is ready to put on the island!`);
      A.confetti(innerWidth / 2, innerHeight * .4, [kid.look.color, "#FFD43B", "#4CBF5A"], 50);
      const isl = islandOf(kid.id); isl.got = (isl.got || []).concat(["s" + s.id]); save(kid.id, isl);
      if (S.route.name === "island") { UI.hold = s.piece; A.rerender(); }
    };
  });
}

function wireAll() {
  const v = $("#view"), r = route();
  v.querySelectorAll("[data-islgo]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const owner = b.dataset.islgo, as = b.dataset.islas || sailor();
    UI.hold = null; UI.sweep = false;
    A.go({ name: "island", kid: owner, as, from: b.dataset.islfrom || (S.route.name === "islands" ? "map" : "home") });
  });
  v.querySelectorAll("[data-isbuy]").forEach((b) => b.onclick = () => buyPiece(A.kidById(b.dataset.iskid), SHOP.find((s) => s.id === b.dataset.isbuy)));
  v.querySelectorAll("[data-isladm]").forEach((b) => b.onclick = () => {
    if (!A.adminPlay()) return;
    const kid = A.kidById(b.dataset.iskid), p = b.dataset.isladm, d = +b.dataset.v, isl = islandOf(kid.id), have = inventory(kid.id)[p] || 0;
    if (d < 0 && have <= 0) return A.toast(`${kid.name} has no ${pieceName(p).toLowerCase()} to take.`);
    isl.extra = Object.assign({}, isl.extra); isl.extra[p] = (isl.extra[p] || 0) + d; if (!isl.extra[p]) delete isl.extra[p];
    // Taking a piece that's on the island lifts the last one off.
    if (d < 0 && (placed(isl)[p] || 0) > have - 1) { const ks = Object.keys(THING[p] ? isl.o : isl.g).filter((k) => (THING[p] ? isl.o : isl.g)[k] === p); if (ks.length) delete (THING[p] ? isl.o : isl.g)[ks[ks.length - 1]]; }
    save(kid.id, isl); A.toast(`${d > 0 ? "Gave" : "Took"} one ${pieceName(p).toLowerCase()} ${d > 0 ? "to" : "from"} ${kid.name}.`); A.rerender();
  });
  v.querySelectorAll("[data-islclear]").forEach((b) => b.onclick = () => {
    const kid = A.kidById(b.dataset.islclear);
    A.confirmBox(`Clear ${kid.name}'s island?`, "Every piece goes back in the tray. Nothing is lost.", "Clear it", () => { const isl = islandOf(kid.id); isl.g = {}; isl.o = {}; save(kid.id, isl); A.toast("Island cleared."); });
  });
  if (r.name === "islands") {
    const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
    on("#islHome", () => A.go({ name: "home" }));
    v.querySelectorAll("[data-islwho]").forEach((b) => b.onclick = () => { lsetSailor(b.dataset.islwho); S.route.as = b.dataset.islwho; A.beep([[880, .1, 0, "pluck"]], .35); A.rerender(); });
  }
  if (r.name !== "island") return;
  const owner = r.kid, isl = islandOf(owner), on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on("#islBack", () => { UI.hold = null; A.go(r.from === "kid" ? { name: "kid", kid: r.as, tab: "monster", sub: "island" } : r.from === "map" ? { name: "islands", as: r.as } : { name: "home" }); });
  on("#islMap", () => { UI.hold = null; A.go({ name: "islands", as: r.as }); });
  on("#islWave", () => wave(r)); on("#islFive", () => highFive(r)); on("#islStick", () => leaveSticker(r)); on("#islHelp", () => askHelp(r));
  const tray = $("#islTray");
  if (tray) {
    tray.scrollLeft = UI.trayX; tray.onscroll = () => { UI.trayX = tray.scrollLeft; };
    tray.querySelectorAll("[data-islpc]").forEach((b) => b.onclick = () => {
      const p = b.dataset.islpc; UI.sweep = false;
      if (UI.hold === p) UI.hold = null; else if (b.classList.contains("empty")) { A.toast(`No ${pieceName(p).toLowerCase()} left. Earn Dojos to unlock more!`); return; } else UI.hold = p;
      A.beep([[880, .06, 0, "pluck"]], .3); A.rerender();
    });
    const sw = tray.querySelector("[data-islsweep]"); if (sw) sw.onclick = () => { UI.sweep = !UI.sweep; UI.hold = null; A.rerender(); };
  }
  const stage = $("#islStage");
  stage.onclick = (e) => { const [x, y] = stageCell(e); tapCell(r, x, y); };
  mountWalkers(owner, r.as, isl);
  // After this render finishes: saving inside wiring would re-render mid-wire.
  if (canEdit(r) && (owner === "family" || r.as === owner)) setTimeout(() => { if (S.route === r) celebrateNew(owner, islandOf(owner)); }, 0);
}

return { view: (r) => r.name === "islands" ? viewMap() : viewIsland(r), wireAll, kidCard, shopHtml, adminHtml, hasNew, SHOP, inventory, bundlesFor };
};
})();
