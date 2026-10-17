/* Home Dojo: behaviour menu, monster shop catalogue and monster drawing. Shared by app.js. */
(function () {
"use strict";
/* ---------- catalogue: behaviours (from the behaviour menu) ---------- */
const LIB = [
  // big kid (about 4+)
  { id: "calm", for: "big", icon: "🌬️", label: "Calm body", group: "Feelings and calming", lens: ["Psych", "OT"], star: true, why: "Used a calm-down strategy when upset: big breaths, squeeze, calm corner, asked for a hug." },
  { id: "words", for: "big", icon: "💬", label: "Used my words", group: "Feelings and calming", lens: ["Psych"], why: "Said how he felt or what he needed instead of hitting or screaming." },
  { id: "break", for: "big", icon: "🛋️", label: "Asked for a break", group: "Feelings and calming", lens: ["OT"], why: "Noticed he was overloaded and asked to step away." },
  { id: "timer", for: "big", icon: "⏰", label: "Stopped when the timer went", group: "Changes and transitions", lens: ["Psych"], star: true, why: "Stopped a screen or game at the timer (after 5 and 1 minute warnings)." },
  { id: "change", for: "big", icon: "🔀", label: "Coped with a change", group: "Changes and transitions", lens: ["Psych"], why: "Plans changed and he stayed flexible or bounced back." },
  { id: "new", for: "big", icon: "🧭", label: "Tried something new", group: "Changes and transitions", lens: ["Psych", "OT"], why: "A new place, activity or game." },
  { id: "food", for: "both", icon: "🥦", label: "Brave with food", group: "Body and self-care", lens: ["OT"], why: "Touched, smelled, licked or tasted a new food. Every step counts." },
  { id: "dressed", for: "big", icon: "👕", label: "Got dressed myself", group: "Body and self-care", lens: ["OT"], why: "Dressed independently. A picture checklist helps." },
  { id: "teethhair", for: "big", icon: "🪥", label: "Teeth and hair", group: "Body and self-care", lens: ["OT", "Parent"], why: "Let you brush teeth or wash hair calmly." },
  { id: "listen", for: "big", icon: "👂", label: "Good listening", group: "Listening and focus", lens: ["Teacher", "Psych"], star: true, why: "Did it the first time. Get his attention first: name, close by, short instruction." },
  { id: "finish", for: "big", icon: "🏁", label: "Finished it", group: "Listening and focus", lens: ["Teacher", "Psych"], why: "Finished one task before moving to the next." },
  { id: "wait", for: "big", icon: "✋", label: "Waited my turn", group: "Listening and focus", lens: ["Teacher"], why: "Waited without interrupting or grabbing." },
  { id: "reading", for: "big", icon: "📖", label: "Reading time", group: "Listening and focus", lens: ["Teacher"], why: "Did school reading or homework." },
  { id: "kindsib", for: "big", icon: "🤝", label: "Kind to my brother", group: "Kindness", lens: ["Parent", "Teacher"], star: true, why: "Shared, was gentle, helped or played nicely with his brother." },
  { id: "kindwords", for: "big", icon: "💛", label: "Kind words", group: "Kindness", lens: ["Teacher"], why: "Please, thank you, sorry or something nice." },
  { id: "sport", for: "big", icon: "🎲", label: "Good sport", group: "Kindness", lens: ["Psych", "Teacher"], why: "Lost a game or didn't get his way and stayed OK." },
  { id: "tidy", for: "big", icon: "🧺", label: "Tidy-up helper", group: "Helping out", lens: ["Parent"], why: "Put toys away when asked." },
  { id: "morning", for: "big", icon: "🌅", label: "Morning routine", group: "Helping out", lens: ["Parent", "OT"], why: "Morning picture checklist done." },
  { id: "bedtime", for: "big", icon: "🌙", label: "Bedtime routine", group: "Helping out", lens: ["Parent", "OT"], why: "Bedtime steps done." },
  // added 2026-10-14
  { id: "help", for: "big", icon: "🙋", label: "Asked for help", group: "Feelings and calming", lens: ["Psych", "Teacher"], fresh: true, why: "Got stuck and asked for help instead of melting down or giving up." },
  { id: "takeno", for: "big", icon: "🙆", label: "Took a no well", group: "Feelings and calming", lens: ["Psych"], fresh: true, why: "Heard no or not now and stayed OK, maybe with a grumble." },
  { id: "feeling", for: "big", icon: "🌡️", label: "Named my feeling", group: "Feelings and calming", lens: ["Psych"], fresh: true, why: "Said or pointed to how he felt: angry, worried, sad, excited." },
  { id: "ready", for: "big", icon: "🎒", label: "Ready on time", group: "Changes and transitions", lens: ["Parent", "OT"], fresh: true, why: "Shoes on and bag ready when it was time to go out." },
  { id: "bravedr", for: "big", icon: "💈", label: "Brave appointment", group: "Changes and transitions", lens: ["OT", "Parent"], fresh: true, why: "Got through a haircut, doctor, dentist or busy shop." },
  { id: "trying", for: "big", icon: "💪", label: "Kept trying", group: "Listening and focus", lens: ["Teacher", "Psych"], fresh: true, why: "Something was hard (writing, bike, a puzzle) and he had another go." },
  { id: "meal", for: "big", icon: "🍽️", label: "Sat for dinner", group: "Listening and focus", lens: ["Parent"], fresh: true, why: "Stayed at the table until the family meal was done." },
  { id: "unasked", for: "big", icon: "🦸", label: "Helped without asking", group: "Kindness", lens: ["Parent"], fresh: true, why: "Saw a job or someone who needed help and just did it." },
  { id: "fixit", for: "big", icon: "🩹", label: "Said sorry and fixed it", group: "Kindness", lens: ["Psych", "Parent"], fresh: true, why: "After a mistake, said sorry and helped put it right." },
  { id: "friend", for: "big", icon: "🧑‍🤝‍🧑", label: "Played well with a friend", group: "Kindness", lens: ["Teacher", "Psych"], fresh: true, why: "Took turns, shared ideas or included someone in a game." },
  { id: "table2", for: "big", icon: "🍴", label: "Set the table", group: "Helping out", lens: ["Parent", "OT"], fresh: true, why: "Put out plates, cups or cutlery for a meal." },
  { id: "pets", for: "big", icon: "🪴", label: "Looked after something", group: "Helping out", lens: ["Parent"], fresh: true, why: "Fed a pet, watered a plant or cared for a toy or baby brother." },
  { id: "handwash", for: "both", icon: "🧼", label: "Washed hands", group: "Body and self-care", lens: ["OT", "Parent"], fresh: true, why: "Washed hands after the toilet or before food without a fuss." },
  { id: "active", for: "big", icon: "⚽", label: "Active play", group: "Body and self-care", lens: ["OT"], fresh: true, why: "Ran, climbed, biked or played outside instead of a screen." },
  { id: "sleep", for: "big", icon: "🛏️", label: "Stayed in bed", group: "Body and self-care", lens: ["Parent", "OT"], fresh: true, why: "Stayed in his own bed until morning (or the wake-up light)." },
  // little one (under 4)
  { id: "gentle", for: "little", icon: "🫶", label: "Gentle hands", group: "Little one", lens: ["Psych", "Parent"], star: true, why: "Gentle with people and pets; stroked instead of hit." },
  { id: "ltidy", for: "little", icon: "🧸", label: "Tidy helper", group: "Little one", lens: ["Parent", "OT"], star: true, why: "Put a toy in the box. Even one counts." },
  { id: "lwords", for: "little", icon: "🗣️", label: "Used words", group: "Little one", lens: ["Psych"], why: "Said or signed help, more or mine instead of grabbing or crying." },
  { id: "table", for: "little", icon: "🍽️", label: "Sat for dinner", group: "Little one", lens: ["Parent"], why: "Stayed at the table for a short meal." },
  { id: "teeth", for: "little", icon: "🪥", label: "Teeth time", group: "Little one", lens: ["OT", "Parent"], why: "Let you brush his teeth." },
  { id: "share", for: "little", icon: "🎁", label: "Shared", group: "Little one", lens: ["Teacher"], why: "Gave a toy to someone." },
  { id: "come", for: "little", icon: "🏃", label: "Came when called", group: "Little one", lens: ["Parent"], fresh: true, why: "Came over when you called his name. Great for safety outside." },
  { id: "manners", for: "little", icon: "🙏", label: "Please and thank you", group: "Little one", lens: ["Teacher"], fresh: true, why: "Said or signed please or thank you, even a try counts." },
  { id: "carseat", for: "little", icon: "🚗", label: "Car seat star", group: "Little one", lens: ["Parent"], fresh: true, why: "Got into the car seat or buggy without a struggle." },
  { id: "dresshelp", for: "little", icon: "🧦", label: "Dressing helper", group: "Little one", lens: ["OT"], fresh: true, why: "Pushed an arm through a sleeve or pulled off his socks." },
  { id: "wave", for: "little", icon: "👋", label: "Hello and bye-bye", group: "Little one", lens: ["Psych"], fresh: true, why: "Waved or said hello or bye-bye to someone." },
];
const BONUS = { id: "bonus", icon: "🌟", label: "Wow! Bonus" };

/* ---------- catalogue: monster shop ---------- */
// Price tiers (Dojo $): quick 3-8 (about a day), save a bit 10-20, save up 22-45 (a week or more), mega 60+.
const SHOP = [
  { id: "beanie", slot: "hat", name: "Beanie", cost: 4 },
  { id: "party", slot: "hat", name: "Party hat", cost: 5 },
  { id: "flower", slot: "hat", name: "Flower", cost: 6 },
  { id: "cap", slot: "hat", name: "Cap", cost: 10 },
  { id: "pirate", slot: "hat", name: "Pirate hat", cost: 15 },
  { id: "wizard", slot: "hat", name: "Wizard hat", cost: 20 },
  { id: "crown", slot: "hat", name: "Crown", cost: 30 },
  { id: "diamond", slot: "hat", name: "Diamond crown", cost: 90 },
  { id: "bandana", slot: "acc", name: "Bandana", cost: 4 },
  { id: "shades", slot: "acc", name: "Cool shades", cost: 5 },
  { id: "bowtie", slot: "acc", name: "Bow tie", cost: 6 },
  { id: "glasses", slot: "acc", name: "Glasses", cost: 8 },
  { id: "scarf", slot: "acc", name: "Scarf", cost: 10 },
  { id: "cape", slot: "acc", name: "Super cape", cost: 20 },
  { id: "jetpack", slot: "acc", name: "Jetpack", cost: 60 },
  { id: "spots", slot: "skin", name: "Spots", cost: 5 },
  { id: "stripes", slot: "skin", name: "Stripes", cost: 10 },
  { id: "stars", slot: "skin", name: "Star skin", cost: 15 },
  { id: "rainbow", slot: "skin", name: "Rainbow", cost: 30 },
  { id: "gold", slot: "skin", name: "Gold", cost: 45 },
  { id: "galaxy", slot: "skin", name: "Galaxy", cost: 75 },
  { id: "meadow", slot: "bg", name: "Meadow", cost: 6 },
  { id: "ocean", slot: "bg", name: "Ocean", cost: 12 },
  { id: "space", slot: "bg", name: "Space", cost: 20 },
  { id: "volcano", slot: "bg", name: "Volcano", cost: 25 },
  { id: "rock", slot: "pet", name: "Pet rock", cost: 3 },
  { id: "snail", slot: "pet", name: "Speedy snail", cost: 6 },
  { id: "hamster", slot: "pet", name: "Hamster", cost: 8 },
  { id: "bunny", slot: "pet", name: "Bunny", cost: 12 },
  { id: "slime", slot: "pet", name: "Slime blob", cost: 12 },
  { id: "cat", slot: "pet", name: "Cat", cost: 18 },
  { id: "puppy", slot: "pet", name: "Puppy", cost: 18 },
  { id: "owl", slot: "pet", name: "Owl", cost: 22 },
  { id: "octopus", slot: "pet", name: "Octopus", cost: 25 },
  { id: "trex", slot: "pet", name: "Baby T-rex", cost: 30 },
  { id: "robodog", slot: "pet", name: "Robo-dog", cost: 30 },
  { id: "unicorn", slot: "pet", name: "Unicorn", cost: 35 },
  { id: "babydragon", slot: "pet", name: "Baby dragon", cost: 40 },
  { id: "alien", slot: "pet", name: "Alien in a UFO", cost: 45 }
];
const PRICE_TIERS = [[8, "quick", "Quick"], [20, "bit", "Save a bit"], [45, "up", "Save up"], [Infinity, "mega", "Mega"]];
function priceTier(cost) { return PRICE_TIERS.find(([max]) => cost <= max); }
const SLOTS = [["pet", "Pets"], ["hat", "Hats"], ["acc", "Accessories"], ["skin", "Skins"], ["bg", "Backgrounds"]];
const LEVELS = [0, 25, 75, 150, 300, 500];
const COLORS = ["#2BB3A3", "#FF6F59", "#7B61FF", "#F5B700", "#4CBF5A", "#3FA7F5", "#FF7EB6", "#FF8A2A", "#E63946", "#8AC926", "#C77DFF", "#6D7A8C", "#5ED3C6", "#FF9AA2", "#9D8CFF", "#FFC75F"];
const SHAPES = [["round", "Round"], ["tall", "Tall"], ["wide", "Wide"]];
const TOPS = [["horns", "Horns"], ["ears", "Ears"], ["antenna", "Antennae"], ["unicorn", "Unicorn horn"], ["bunny", "Bunny ears"], ["mohawk", "Spiky hair"], ["tuft", "Hair tuft"], ["sprout", "Leaf sprout"], ["none", "None"]];
const SPECIES = [["monster", "Monster"], ["dragon", "Dragon"], ["robot", "Robot"]];
const MOUTHS = [["smile", "Smile"], ["grin", "Big grin"], ["tongue", "Cheeky"], ["fangs", "Fangs"], ["o", "Wow!"], ["buck", "Buck teeth"], ["wavy", "Silly"], ["smirk", "Smirk"]];
// More free face and body choices for the Make tab. The first of each list is the default.
const EYESTYLES = [["round", "Round"], ["sparkle", "Sparkly"], ["happy", "Happy"], ["sleepy", "Sleepy"], ["wink", "Wink"], ["lashes", "Lashes"]];
const BROWS = [["none", "None"], ["happy", "Happy"], ["cross", "Grumpy"], ["wow", "Surprised"]];
const NOSES = [["none", "None"], ["button", "Button"], ["snout", "Snout"], ["heart", "Heart"], ["pointy", "Pointy"]];
const CHEEKS = [["blush", "Blush"], ["freckles", "Freckles"], ["none", "None"]];
const ARMS = [["nubs", "Little arms"], ["wave", "Waving"], ["mitts", "Big hands"], ["claws", "Claws"], ["wings", "Wings"]];
const BELLIES = [["patch", "Patch"], ["heart", "Heart"], ["none", "None"]];
const LOOK_DEFAULTS = { species: "monster", shape: "round", eyes: 2, top: "none", mouth: "smile", eyeStyle: "round", brows: "none", nose: "none", cheeks: "blush", arms: "nubs", belly: "patch" };

/* ---------- monster drawing ---------- */
let svgN = 0;
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return "#" + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}
function star(cx, cy, r, fill, op) {
  let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); }
  return `<path d="${p}Z" fill="${fill}" opacity="${op == null ? 1 : op}"/>`;
}
const GEO = {
  round: { body: (f) => `<ellipse cx="100" cy="120" rx="64" ry="60" fill="${f}"/>`, top: 60, bot: 180, rx: 64, eye: 104, mouth: 132, neck: 156 },
  tall: { body: (f) => `<rect x="52" y="48" width="96" height="134" rx="46" fill="${f}"/>`, top: 48, bot: 182, rx: 48, eye: 92, mouth: 124, neck: 150 },
  wide: { body: (f) => `<ellipse cx="100" cy="132" rx="80" ry="48" fill="${f}"/>`, top: 84, bot: 180, rx: 80, eye: 118, mouth: 144, neck: 166 },
  robot: { body: (f) => `<rect x="50" y="58" width="100" height="120" rx="18" fill="${f}"/>`, top: 58, bot: 178, rx: 50, eye: 98, mouth: 128, neck: 150 }
};
function eyePos(n, y) {
  if (n === 1) return [[100, y, 17]];
  if (n === 3) return [[73, y + 4, 10.5], [100, y - 8, 10.5], [127, y + 4, 10.5]];
  return [[81, y, 13], [119, y, 13]];
}
// Generated pictures live in scenery/ (the artifact build inlines them as window.HD_SCENERY).
const artUrl = (n) => (window.HD_SCENERY && window.HD_SCENERY[n]) || `scenery/${n}.webp`;
const shopArt = (id) => artUrl("shop-" + id);
function bgSvg(id, gid) {
  if (SHOP.some((i) => i.slot === "bg" && i.id === id)) return `<clipPath id="${gid}bc"><rect width="200" height="200" rx="26"/></clipPath><image href="${shopArt(id)}" width="200" height="200" clip-path="url(#${gid}bc)" preserveAspectRatio="xMidYMid slice"/>`;
  switch (id) {
    case "meadow": return `<defs><linearGradient id="${gid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8FF"/><stop offset="1" stop-color="#DDF3FF"/></linearGradient></defs><rect width="200" height="200" rx="26" fill="url(#${gid}s)"/><circle cx="160" cy="38" r="16" fill="#FFD44D"/><path d="M0 160 Q60 130 120 158 T200 150 V200 H0Z" fill="#7BCB63"/><rect x="0" y="174" width="200" height="26" fill="#5DB24A"/>`;
    case "ocean": return `<rect width="200" height="200" rx="26" fill="#2E8BD6"/><path d="M0 40 Q25 30 50 40 T100 40 T150 40 T200 40 V0 H0Z" fill="#7CC7FF"/><circle cx="30" cy="80" r="6" fill="none" stroke="#BFE6FF" stroke-width="2"/><circle cx="170" cy="60" r="9" fill="none" stroke="#BFE6FF" stroke-width="2"/><circle cx="160" cy="100" r="4" fill="none" stroke="#BFE6FF" stroke-width="2"/><path d="M0 182 Q50 170 100 182 T200 180 V200 H0Z" fill="#F2D98D"/>`;
    case "space": return `<rect width="200" height="200" rx="26" fill="#1B1640"/>${star(30, 34, 5, "#fff")}${star(170, 50, 4, "#fff")}${star(150, 160, 3, "#fff")}${star(24, 140, 3, "#fff")}<circle cx="166" cy="128" r="14" fill="#FF8A5B"/><ellipse cx="166" cy="128" rx="24" ry="5" fill="none" stroke="#FFD27F" stroke-width="2.5"/>`;
    case "volcano": return `<rect width="200" height="200" rx="26" fill="#FFB27A"/><path d="M10 200 L70 112 H96 L160 200Z" fill="#6B4B3E"/><path d="M70 112 Q83 96 96 112 L90 128 Q83 118 76 128Z" fill="#FF4E1A"/><circle cx="76" cy="80" r="8" fill="#9C8A86" opacity=".7"/><circle cx="92" cy="64" r="11" fill="#9C8A86" opacity=".6"/>`;
    default: return "";
  }
}
function hatPart(id, t) {
  let s = "";
  if (id === "party") s += `<path d="M84 ${t + 6} L100 ${t - 40} L116 ${t + 6}Z" fill="#FF5E8A"/><path d="M90 ${t - 10} L110 ${t - 10} M87 ${t - 2} L113 ${t - 2}" stroke="#FFE14D" stroke-width="4"/><circle cx="100" cy="${t - 42}" r="7" fill="#FFE14D"/>`;
  if (id === "flower") s += `<g transform="translate(130 ${t + 12})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(11 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(11 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="9" fill="#FF8FC7"/>`).join("")}<circle r="7" fill="#FFD43B"/></g>`;
  if (id === "cap") s += `<path d="M66 ${t + 10} Q66 ${t - 26} 100 ${t - 26} Q134 ${t - 26} 134 ${t + 10}Z" fill="#2F6BFF"/><path d="M120 ${t + 6} Q150 ${t + 2} 160 ${t + 10} L124 ${t + 12}Z" fill="#1F4FCC"/><circle cx="100" cy="${t - 26}" r="4" fill="#1F4FCC"/>`;
  if (id === "pirate") s += `<path d="M58 ${t + 8} Q100 ${t - 46} 142 ${t + 8} Q100 ${t - 6} 58 ${t + 8}Z" fill="#222"/><circle cx="100" cy="${t - 14}" r="7" fill="#fff"/><path d="M95 ${t - 4} L105 ${t - 4}" stroke="#fff" stroke-width="3"/>`;
  if (id === "wizard") s += `<ellipse cx="100" cy="${t + 4}" rx="44" ry="9" fill="#4B3BCB"/><path d="M76 ${t + 2} L104 ${t - 62} L124 ${t + 2}Z" fill="#5B4BEB"/>${star(102, t - 22, 7, "#FFE14D")}${star(92, t - 4, 4, "#FFE14D")}`;
  if (id === "beanie") s += `<path d="M68 ${t + 8} Q68 ${t - 30} 100 ${t - 30} Q132 ${t - 30} 132 ${t + 8}Z" fill="#FF8A2A"/><path d="M80 ${t - 20} V${t + 4} M92 ${t - 26} V${t + 4} M108 ${t - 26} V${t + 4} M120 ${t - 20} V${t + 4}" stroke="#E8701A" stroke-width="3"/><rect x="64" y="${t - 2}" width="72" height="13" rx="6" fill="#E8701A"/><circle cx="100" cy="${t - 33}" r="8" fill="#fff"/>`;
  if (id === "diamond") s += `<path d="M64 ${t + 8} L64 ${t - 26} L82 ${t - 8} L100 ${t - 40} L118 ${t - 8} L136 ${t - 26} L136 ${t + 8}Z" fill="#BDF3FF" stroke="#2B9FE0" stroke-width="3" stroke-linejoin="round"/><path d="M100 ${t - 40} L100 ${t + 8} M82 ${t - 8} L88 ${t + 8} M118 ${t - 8} L112 ${t + 8}" stroke="#fff" stroke-width="2" opacity=".8"/><path d="M92 ${t - 4} L100 ${t - 14} L108 ${t - 4} L100 ${t + 4}Z" fill="#3FA7F5"/><circle cx="76" cy="${t}" r="4" fill="#C77DFF"/><circle cx="124" cy="${t}" r="4" fill="#C77DFF"/>${star(64, t - 30, 6, "#FFFFFF")}${star(138, t - 30, 5, "#FFFFFF")}${star(100, t - 48, 5, "#FFF59D")}`;
  if (id === "crown") s += `<path d="M70 ${t + 8} L70 ${t - 22} L85 ${t - 8} L100 ${t - 30} L115 ${t - 8} L130 ${t - 22} L130 ${t + 8}Z" fill="#F7C531" stroke="#C9930A" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="${t - 4}" r="5" fill="#E23B4E"/><circle cx="82" cy="${t}" r="3.5" fill="#3D7BFF"/><circle cx="118" cy="${t}" r="3.5" fill="#3D7BFF"/>`;
  return s;
}
// Face and body parts (used by monsterSvg). Each draws in the 200 x 200 monster box.
function eyesSvg(style, eyes, dark, ink, col) {
  return eyes.map(([x, y, r], i) => {
    const ball = `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${dark}" stroke-width="2"/>`;
    const arc = `<path d="M${x - r * .8} ${y + r * .25} Q${x} ${y - r * .9} ${x + r * .8} ${y + r * .25}" stroke="${ink}" stroke-width="${Math.max(3, r * .32)}" fill="none" stroke-linecap="round"/>`;
    const plain = ball + `<circle cx="${x + r * 0.12}" cy="${y - r * 0.08}" r="${r * 0.55}" fill="${ink}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.32}" r="${r * 0.18}" fill="#fff"/>`;
    if (style === "happy" || (style === "wink" && (eyes.length === 1 || i === eyes.length - 1))) return arc;
    if (style === "sparkle") return ball + `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${ink}"/><circle cx="${x + r * 0.25}" cy="${y - r * 0.28}" r="${r * 0.26}" fill="#fff"/><circle cx="${x - r * 0.28}" cy="${y + r * 0.3}" r="${r * 0.12}" fill="#fff"/>` + star(x - r * 0.2, y - r * 0.4, r * 0.14, "#fff");
    if (style === "sleepy") return ball + `<circle cx="${x}" cy="${y + r * 0.3}" r="${r * 0.48}" fill="${ink}"/><path d="M${x - r - 1} ${y + 1} A${r + 1} ${r + 1} 0 0 1 ${x + r + 1} ${y + 1}Z" fill="${col}" stroke="${dark}" stroke-width="2"/>`;
    if (style === "lashes") return plain + [-0.6, 0, 0.6].map((a) => `<path d="M${x + Math.sin(a) * r} ${y - Math.cos(a) * r} l${Math.sin(a) * r * .45} ${-Math.cos(a) * r * .45}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`).join("");
    return plain;
  }).join("");
}
function browsSvg(style, eyes, ink) {
  if (style === "none") return "";
  return eyes.map(([x, y, r]) => {
    const by = y - r * 1.45, w = r * .85, line = (d) => `<path d="${d}" stroke="${ink}" stroke-width="3.8" fill="none" stroke-linecap="round"/>`;
    if (style === "happy") return line(`M${x - w} ${by} Q${x} ${by - r * .5} ${x + w} ${by}`);
    if (style === "wow") return line(`M${x - w} ${by - r * .35} Q${x} ${by - r} ${x + w} ${by - r * .35}`);
    // grumpy: the end nearest the middle of the face dips down
    const dip = r * .4, inL = x > 100, inR = x < 100;
    return line(`M${x - w} ${by + (inL ? dip : -dip * .3)} L${x + w} ${by + (inR ? dip : -dip * .3)}`);
  }).join("");
}
function noseSvg(style, y, dark, light) {
  if (style === "button") return `<ellipse cx="100" cy="${y}" rx="4.5" ry="3.5" fill="${dark}"/>`;
  if (style === "snout") return `<ellipse cx="100" cy="${y}" rx="11" ry="7" fill="${light}" stroke="${dark}" stroke-width="2"/><ellipse cx="96" cy="${y}" rx="2" ry="2.6" fill="${dark}"/><ellipse cx="104" cy="${y}" rx="2" ry="2.6" fill="${dark}"/>`;
  if (style === "heart") return `<path d="M100 ${y + 5} C93 ${y} 93 ${y - 5} 97 ${y - 5} C99 ${y - 5} 100 ${y - 3} 100 ${y - 2} C100 ${y - 3} 101 ${y - 5} 103 ${y - 5} C107 ${y - 5} 107 ${y} 100 ${y + 5}Z" fill="#FF5E8A"/>`;
  if (style === "pointy") return `<path d="M96 ${y - 4} L104 ${y - 4} L100 ${y + 4}Z" fill="${dark}" stroke-linejoin="round"/>`;
  return "";
}
function armsSvg(style, G, col, dark, light) {
  const lx = 100 - G.rx + 2, rx = 100 + G.rx - 2, ay = G.eye + 42;
  const arm = (x, a) => `<ellipse cx="${x}" cy="${ay}" rx="12" ry="18" fill="${dark}" transform="rotate(${a} ${x} ${ay})"/>`;
  if (style === "wings") return [-1, 1].map((sd) => { const x = 100 + sd * G.rx * .55, y = G.top + 26; return `<path d="M${x} ${y + 10} Q${x + sd * 40} ${y - 30} ${x + sd * 36} ${y + 8} Q${x + sd * 28} ${y + 2} ${x + sd * 24} ${y + 14} Q${x + sd * 16} ${y + 6} ${x + sd * 8} ${y + 20}Z" fill="${light}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`; }).join("") + arm(lx, 25) + arm(rx, -25);
  if (style === "wave") return arm(lx, 25) + `<ellipse cx="${rx + 10}" cy="${ay - 30}" rx="11" ry="20" fill="${dark}" transform="rotate(30 ${rx + 10} ${ay - 30})"/><circle cx="${rx + 20}" cy="${ay - 48}" r="9" fill="${dark}"/>`;
  let s = arm(lx, 25) + arm(rx, -25);
  const tip = (x, sd) => ({ x: x - sd * 6, y: ay + 15 });
  if (style === "mitts") [[lx, -1], [rx, 1]].forEach(([x, sd]) => { const t = tip(x, sd); s += `<circle cx="${t.x}" cy="${t.y}" r="11" fill="${light}" stroke="${dark}" stroke-width="2"/><path d="M${t.x + sd * 5} ${t.y - 6} q${sd * 6} 2 ${sd * 4} 8" stroke="${dark}" stroke-width="2" fill="none"/>`; });
  if (style === "claws") [[lx, -1], [rx, 1]].forEach(([x, sd]) => { const t = tip(x, sd); s += [-5, 0, 5].map((d) => `<path d="M${t.x + d - 2} ${t.y + 1} L${t.x + d} ${t.y + 9} L${t.x + d + 2} ${t.y + 1}Z" fill="#fff" stroke="${dark}" stroke-width="1"/>`).join(""); });
  return s;
}
function monsterSvg(look, equip, level) {
  look = look || {}; equip = equip || {};
  const sp = look.species || "monster", gid = "m" + (++svgN), G = sp === "robot" ? GEO.robot : (GEO[look.shape] || GEO.round), col = look.color || COLORS[0];
  const dark = shade(col, -0.28), light = shade(col, 0.45), ink = "#1C1830";
  const eyes = eyePos(look.eyes || 2, G.eye), mid = (G.top + G.bot) / 2;
  let s = `<svg viewBox="0 0 200 200" role="img" aria-hidden="true"><defs><clipPath id="${gid}c">${G.body("#000")}</clipPath>`;
  s += `<radialGradient id="${gid}a"><stop offset="0" stop-color="${light}" stop-opacity=".9"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>`;
  // Soft shading: lit from the top left, a touch darker round the bottom edge.
  s += `<radialGradient id="${gid}b" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${shade(col, .28)}"/><stop offset=".5" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, -.14)}"/></radialGradient>`;
  s += `<linearGradient id="${gid}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(col, -.12)}"/><stop offset="1" stop-color="${shade(col, -.34)}"/></linearGradient>`;
  s += `<linearGradient id="${gid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE680"/><stop offset=".5" stop-color="#F2B705"/><stop offset="1" stop-color="#FFD84D"/></linearGradient>`;
  s += `<linearGradient id="${gid}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5E5E"/><stop offset=".25" stop-color="#FFB13B"/><stop offset=".5" stop-color="#FFE14D"/><stop offset=".75" stop-color="#58D36B"/><stop offset="1" stop-color="#4DA6FF"/></linearGradient></defs>`;
  if (equip.bg) s += bgSvg(equip.bg, gid);
  if (level >= 5) s += `<circle cx="100" cy="${mid}" r="98" fill="url(#${gid}a)"/>`;
  if (level >= 4) s += `<path d="M${100 - G.rx + 10} ${mid - 10} Q${100 - G.rx - 40} ${mid - 50} ${100 - G.rx - 30} ${mid + 10} Q${100 - G.rx - 14} ${mid} ${100 - G.rx + 10} ${mid + 14}Z" fill="${light}" opacity=".9"/><path d="M${100 + G.rx - 10} ${mid - 10} Q${100 + G.rx + 40} ${mid - 50} ${100 + G.rx + 30} ${mid + 10} Q${100 + G.rx + 14} ${mid} ${100 + G.rx - 10} ${mid + 14}Z" fill="${light}" opacity=".9"/>`;
  if (equip.acc === "jetpack") { for (const x of [100 - G.rx - 12, 100 + G.rx - 10]) s += `<path d="M${x + 2} ${G.neck + 18} q9 28 18 0 q-4 14 -9 22 q-5 -8 -9 -22z" fill="#FF8A2A"/><path d="M${x + 6} ${G.neck + 18} q5 14 10 0z" fill="#FFE14D"/><rect x="${x}" y="${G.neck - 46}" width="22" height="64" rx="10" fill="#B8C4D0" stroke="#6D7A8C" stroke-width="3"/><rect x="${x}" y="${G.neck - 30}" width="22" height="8" fill="#E63946"/><rect x="${x + 4}" y="${G.neck + 14}" width="14" height="6" rx="2" fill="#6D7A8C"/>`; }
  if (equip.acc === "cape") s += `<path d="M${100 - G.rx * 0.7} ${G.neck - 10} Q100 ${G.neck} ${100 + G.rx * 0.7} ${G.neck - 10} L${100 + G.rx + 8} ${G.bot + 2} Q100 ${G.bot + 12} ${100 - G.rx - 8} ${G.bot + 2}Z" fill="#E23B4E"/>`;
  // top features (behind body)
  if (sp === "dragon") {
    s += `<path d="M${100 + G.rx - 12} ${G.bot - 18} Q${100 + G.rx + 34} ${G.bot - 6} ${100 + G.rx + 30} ${G.bot - 46} L${100 + G.rx + 42} ${G.bot - 52} L${100 + G.rx + 26} ${G.bot - 60} Q${100 + G.rx + 18} ${G.bot - 24} ${100 + G.rx - 16} ${G.bot - 34}Z" fill="${col}" stroke="${dark}" stroke-width="2"/>`;
    for (let i = -2; i <= 2; i++) { const x = 100 + i * 18, y = G.top + 6 + Math.abs(i) * 6; s += `<path d="M${x - 9} ${y + 8} L${x} ${y - 14} L${x + 9} ${y + 8}Z" fill="${dark}"/>`; }
  }
  if (sp === "robot") {
    s += `<path d="M100 ${G.top + 2} L100 ${G.top - 22}" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="${G.top - 26}" r="8" fill="#FF5E5E"/><circle cx="97" cy="${G.top - 29}" r="2.5" fill="#fff"/>`;
    s += `<rect x="38" y="${G.eye - 8}" width="14" height="22" rx="4" fill="${dark}"/><rect x="148" y="${G.eye - 8}" width="14" height="22" rx="4" fill="${dark}"/>`;
  }
  if (sp !== "robot" && look.top === "horns") s += `<path d="M72 ${G.top + 14} Q60 ${G.top - 16} 76 ${G.top - 24} Q74 ${G.top - 6} 88 ${G.top + 6}Z" fill="#FFF1C9" stroke="${dark}" stroke-width="2"/><path d="M128 ${G.top + 14} Q140 ${G.top - 16} 124 ${G.top - 24} Q126 ${G.top - 6} 112 ${G.top + 6}Z" fill="#FFF1C9" stroke="${dark}" stroke-width="2"/>`;
  if (sp !== "robot" && look.top === "ears") s += `<circle cx="66" cy="${G.top + 12}" r="16" fill="${col}"/><circle cx="66" cy="${G.top + 12}" r="8" fill="${light}"/><circle cx="134" cy="${G.top + 12}" r="16" fill="${col}"/><circle cx="134" cy="${G.top + 12}" r="8" fill="${light}"/>`;
  if (sp !== "robot" && look.top === "unicorn") s += `<path d="M91 ${G.top + 8} L100 ${G.top - 36} L109 ${G.top + 8}Z" fill="#FFE680" stroke="#E0A800" stroke-width="2" stroke-linejoin="round"/><path d="M94 ${G.top - 2} L106 ${G.top - 8} M96 ${G.top - 14} L104 ${G.top - 19}" stroke="#E0A800" stroke-width="2"/>`;
  if (sp !== "robot" && look.top === "bunny") s += `<ellipse cx="82" cy="${G.top - 14}" rx="10" ry="28" fill="${col}" transform="rotate(-10 82 ${G.top - 14})"/><ellipse cx="82" cy="${G.top - 12}" rx="5" ry="19" fill="#FFB7CF" transform="rotate(-10 82 ${G.top - 12})"/><ellipse cx="118" cy="${G.top - 14}" rx="10" ry="28" fill="${col}" transform="rotate(10 118 ${G.top - 14})"/><ellipse cx="118" cy="${G.top - 12}" rx="5" ry="19" fill="#FFB7CF" transform="rotate(10 118 ${G.top - 12})"/>`;
  if (sp !== "robot" && look.top === "mohawk") s += `<path d="M78 ${G.top + 10} L82 ${G.top - 14} L90 ${G.top + 2} L96 ${G.top - 22} L102 ${G.top} L108 ${G.top - 20} L114 ${G.top + 2} L120 ${G.top - 12} L124 ${G.top + 10}Z" fill="${dark}"/>`;
  if (sp !== "robot" && look.top === "tuft") s += `<path d="M92 ${G.top + 6} Q86 ${G.top - 18} 96 ${G.top - 22} M100 ${G.top + 4} Q100 ${G.top - 26} 110 ${G.top - 26} M106 ${G.top + 6} Q114 ${G.top - 12} 120 ${G.top - 10}" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  if (sp !== "robot" && look.top === "sprout") s += `<path d="M100 ${G.top + 6} V${G.top - 16}" stroke="#3E8E41" stroke-width="4" stroke-linecap="round"/><path d="M100 ${G.top - 14} Q84 ${G.top - 30} 78 ${G.top - 16} Q90 ${G.top - 8} 100 ${G.top - 14}Z" fill="#5CC260"/><path d="M100 ${G.top - 16} Q116 ${G.top - 34} 124 ${G.top - 20} Q112 ${G.top - 10} 100 ${G.top - 16}Z" fill="#7DDA6A"/>`;
  if (sp !== "robot" && look.top === "antenna") s += `<path d="M88 ${G.top + 6} L78 ${G.top - 22}M112 ${G.top + 6} L122 ${G.top - 22}" stroke="${dark}" stroke-width="4" stroke-linecap="round"/><circle cx="78" cy="${G.top - 24}" r="7" fill="${light}"/><circle cx="122" cy="${G.top - 24}" r="7" fill="${light}"/>`;
  // arms and feet
  if (sp === "robot") s += `<rect x="30" y="${G.eye + 30}" width="22" height="12" rx="6" fill="${dark}"/><rect x="148" y="${G.eye + 30}" width="22" height="12" rx="6" fill="${dark}"/><rect x="66" y="${G.bot - 4}" width="26" height="12" rx="4" fill="${dark}"/><rect x="108" y="${G.bot - 4}" width="26" height="12" rx="4" fill="${dark}"/>`;
  else s += armsSvg(look.arms || "nubs", G, col, dark, light);
  if (sp !== "robot") s += `<ellipse cx="78" cy="${G.bot}" rx="16" ry="9" fill="url(#${gid}l)"/><ellipse cx="122" cy="${G.bot}" rx="16" ry="9" fill="url(#${gid}l)"/><ellipse cx="74" cy="${G.bot - 3}" rx="6" ry="2.5" fill="#fff" opacity=".25"/><ellipse cx="118" cy="${G.bot - 3}" rx="6" ry="2.5" fill="#fff" opacity=".25"/>`;
  // body + skin
  s += G.body(equip.skin === "gold" ? `url(#${gid}g)` : `url(#${gid}b)`);
  s += `<g clip-path="url(#${gid}c)">`;
  if (sp === "robot") s += `<rect x="72" y="${G.mouth + 18}" width="56" height="24" rx="6" fill="#fff" opacity=".35"/><circle cx="84" cy="${G.mouth + 30}" r="5" fill="#FF5E5E"/><circle cx="100" cy="${G.mouth + 30}" r="5" fill="#FFD43B"/><circle cx="116" cy="${G.mouth + 30}" r="5" fill="#4CBF5A"/>`;
  else if ((look.belly || "patch") === "patch") s += `<ellipse cx="100" cy="${G.mouth + 34}" rx="${G.rx * 0.6}" ry="30" fill="#fff" opacity=".28"/>`;
  else if (look.belly === "heart") { const hy = G.mouth + 30; s += `<path d="M100 ${hy + 18} C80 ${hy + 4} 80 ${hy - 12} 92 ${hy - 12} C97 ${hy - 12} 100 ${hy - 8} 100 ${hy - 4} C100 ${hy - 8} 103 ${hy - 12} 108 ${hy - 12} C120 ${hy - 12} 120 ${hy + 4} 100 ${hy + 18}Z" fill="#fff" opacity=".35"/>`; }
  if (sp === "dragon") for (let y = G.mouth + 14; y < G.bot; y += 10) s += `<path d="M${100 - G.rx * 0.45} ${y} Q100 ${y + 5} ${100 + G.rx * 0.45} ${y}" stroke="${dark}" stroke-width="2" fill="none" opacity=".35"/>`;
  if (level >= 2) s += `<circle cx="${100 - G.rx * 0.6}" cy="${G.top + 30}" r="7" fill="${dark}" opacity=".3"/><circle cx="${100 + G.rx * 0.62}" cy="${G.top + 40}" r="5" fill="${dark}" opacity=".3"/><circle cx="${100 + G.rx * 0.5}" cy="${G.bot - 30}" r="6" fill="${dark}" opacity=".3"/>`;
  if (equip.skin === "stripes") for (let y = G.top + 8; y < G.bot; y += 20) s += `<rect x="0" y="${y}" width="200" height="8" fill="${dark}" opacity=".3"/>`;
  if (equip.skin === "stars") s += star(70, G.top + 28, 7, "#fff", .6) + star(132, G.top + 36, 6, "#fff", .6) + star(60, G.bot - 30, 5, "#fff", .6) + star(140, G.bot - 26, 7, "#fff", .6);
  if (equip.skin === "rainbow") s += `<rect x="0" y="${G.top}" width="200" height="${G.bot - G.top}" fill="url(#${gid}r)" opacity=".55"/>`;
  if (equip.skin === "spots") s += [[72, 22, 9], [128, 30, 7], [58, 58, 6], [142, 64, 9], [86, 76, 6], [118, 88, 8], [70, 98, 7]].map(([x, dy, r]) => `<circle cx="${x}" cy="${G.top + dy}" r="${r}" fill="${dark}" opacity=".35"/>`).join("");
  if (equip.skin === "galaxy") s += `<rect x="0" y="${G.top - 10}" width="200" height="${G.bot - G.top + 20}" fill="#2A1A6E" opacity=".78"/><ellipse cx="100" cy="${mid}" rx="${G.rx}" ry="16" fill="#C77DFF" opacity=".35" transform="rotate(-20 100 ${mid})"/>` + [[66, 20, 4], [130, 28, 5], [84, 56, 3], [148, 70, 3.5], [60, 82, 4.5], [118, 96, 3], [96, 34, 2.5]].map(([x, dy, r]) => star(x, G.top + dy, r, "#FFFFFF", .9)).join("") + `<circle cx="138" cy="${G.top + 48}" r="6" fill="#FF8A5B" opacity=".9"/>`;
  if (equip.skin === "gold") s += star(68, G.top + 30, 6, "#fff", .8) + star(134, G.bot - 34, 5, "#fff", .8);
  // a soft shine on the top left, and a gentle outline
  s += `<ellipse cx="${100 - G.rx * .42}" cy="${G.top + 24}" rx="${G.rx * .2}" ry="10" fill="#fff" opacity=".28" transform="rotate(-30 ${100 - G.rx * .42} ${G.top + 24})"/>`;
  s += `</g>`;
  s += G.body("none").replace('fill="none"', `fill="none" stroke="${equip.skin === "gold" ? "#C99A06" : equip.skin === "galaxy" ? "#1B1046" : shade(col, -.32)}" stroke-width="2.5"`);
  // face
  const ck = look.cheeks || "blush";
  if (ck === "blush") s += `<ellipse cx="70" cy="${G.mouth - 4}" rx="9" ry="6" fill="#FF7FA0" opacity=".45"/><ellipse cx="130" cy="${G.mouth - 4}" rx="9" ry="6" fill="#FF7FA0" opacity=".45"/>`;
  if (ck === "freckles") for (const cx of [70, 130]) s += [[-5, -2], [0, 2], [5, -2]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${G.mouth - 4 + dy}" r="1.8" fill="${dark}" opacity=".7"/>`).join("");
  s += `<g class="blink">${eyesSvg(look.eyeStyle || "round", eyes, dark, ink, col)}</g>`;
  s += browsSvg(look.brows || "none", eyes, ink);
  s += noseSvg(look.nose || "none", G.mouth - 7, dark, light);
  const m = G.mouth, mo = look.mouth || "smile";
  if (mo === "grin") s += `<path d="M76 ${m - 2} Q100 ${m + 28} 124 ${m - 2} Z" fill="${ink}"/><path d="M80 ${m} H120 L118 ${m + 6} H82Z" fill="#fff"/>`;
  else if (mo === "o") s += `<ellipse cx="100" cy="${m + 6}" rx="9" ry="11" fill="${ink}"/><ellipse cx="100" cy="${m + 11}" rx="5" ry="4" fill="#FF7FA0"/>`;
  else if (mo === "buck") s += `<path d="M82 ${m} Q100 ${m + 18} 118 ${m} Z" fill="${ink}"/><rect x="93" y="${m}" width="7" height="10" rx="1.5" fill="#fff"/><rect x="100.5" y="${m}" width="7" height="10" rx="1.5" fill="#fff"/>`;
  else if (mo === "wavy") s += `<path d="M80 ${m + 4} Q86 ${m - 2} 92 ${m + 4} T104 ${m + 4} T116 ${m + 4} T122 ${m + 2}" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M104 ${m + 5} Q108 ${m + 16} 113 ${m + 5}Z" fill="#FF7FA0"/>`;
  else if (mo === "smirk") s += `<path d="M86 ${m + 6} Q104 ${m + 12} 118 ${m - 2}" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  else {
    s += `<path d="M84 ${m} Q100 ${m + 20} 116 ${m} Z" fill="${ink}"/>`;
    if (mo === "tongue") s += `<path d="M95 ${m + 8} Q100 ${m + 22} 108 ${m + 8} Z" fill="#FF7FA0"/>`;
    if (mo === "fangs") s += `<path d="M87 ${m + 1} L91 ${m + 9} L95 ${m + 1}Z M105 ${m + 1} L109 ${m + 9} L113 ${m + 1}Z" fill="#fff"/>`;
    else s += `<rect x="92" y="${m + 1}" width="7" height="6" rx="1.5" fill="#fff"/>`;
  }
  // accessories
  if (equip.acc === "glasses") { for (const [x, y, r] of eyes) s += `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="none" stroke="${ink}" stroke-width="3.5"/>`; for (let i = 0; i < eyes.length - 1; i++) s += `<path d="M${eyes[i][0] + eyes[i][2] + 5} ${eyes[i][1]} L${eyes[i + 1][0] - eyes[i + 1][2] - 5} ${eyes[i + 1][1]}" stroke="${ink}" stroke-width="3.5"/>`; }
  if (equip.acc === "shades") { for (const [x, y, r] of eyes) s += `<rect x="${x - r - 6}" y="${y - r * 0.8}" width="${2 * r + 12}" height="${r * 1.6 + 2}" rx="${r * 0.7}" fill="${ink}"/><path d="M${x - r} ${y - r * 0.3} l${r * 0.6} -${r * 0.3}" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`; s += `<path d="M${eyes[0][0] - eyes[0][2] - 6} ${eyes[0][1] - 3} H${eyes[eyes.length - 1][0] + eyes[eyes.length - 1][2] + 6}" stroke="${ink}" stroke-width="4"/>`; }
  if (equip.acc === "bandana") s += `<path d="M${100 - G.rx * 0.62} ${G.neck - 8} H${100 + G.rx * 0.62} L100 ${G.neck + 22}Z" fill="#E63946" stroke="#B5203A" stroke-width="2" stroke-linejoin="round"/><circle cx="88" cy="${G.neck - 1}" r="2.2" fill="#fff"/><circle cx="104" cy="${G.neck + 4}" r="2.2" fill="#fff"/><circle cx="112" cy="${G.neck - 3}" r="2.2" fill="#fff"/><circle cx="98" cy="${G.neck + 12}" r="2.2" fill="#fff"/>`;
  if (equip.acc === "bowtie") s += `<path d="M100 ${G.neck} L82 ${G.neck - 10} L82 ${G.neck + 10}Z M100 ${G.neck} L118 ${G.neck - 10} L118 ${G.neck + 10}Z" fill="#E23B4E"/><circle cx="100" cy="${G.neck}" r="5" fill="#B5203A"/>`;
  if (equip.acc === "scarf") s += `<rect x="${100 - G.rx * 0.78}" y="${G.neck - 8}" width="${G.rx * 1.56}" height="15" rx="7" fill="#3D7BFF"/><rect x="${100 + G.rx * 0.25}" y="${G.neck}" width="14" height="32" rx="5" fill="#3D7BFF"/><path d="M${100 - G.rx * 0.5} ${G.neck - 8} v15 M100 ${G.neck - 8} v15 M${100 + G.rx * 0.5} ${G.neck - 8} v15" stroke="#fff" stroke-width="3" opacity=".7"/>`;
  s += hatPart(equip.hat, G.top);
  if (equip.pet) s += `<g transform="translate(166 172) scale(.95)">${petSvg(equip.pet)}</g>`;
  if (level >= 3) s += star(100 + G.rx + 12, G.top + 4, 8, "#FFD43B") + star(100 - G.rx - 10, G.top + 30, 6, "#FFD43B");
  return s + `</svg>`;
}

/* ---------- trophies, medals and badges ---------- */
const TIER = { bronze: ["#E0975A", "#A8652E"], silver: ["#DDE3EA", "#9AA6B4"], gold: ["#FFD23F", "#C99A06"], ruby: ["#FF6B8A", "#C2264B"], locked: ["#C9D1DB", "#9AA6B4"] };
function trophySvg(tier, locked, icon) {
  const [f, d] = TIER[locked ? "locked" : tier] || TIER.gold;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 18 H70 V40 Q70 62 50 64 Q30 62 30 40Z" fill="${f}" stroke="${d}" stroke-width="3"/>
    <path d="M30 24 Q14 24 16 38 Q18 50 32 50" fill="none" stroke="${d}" stroke-width="5"/><path d="M70 24 Q86 24 84 38 Q82 50 68 50" fill="none" stroke="${d}" stroke-width="5"/>
    <rect x="45" y="63" width="10" height="12" fill="${d}"/><rect x="32" y="74" width="36" height="10" rx="3" fill="${d}"/><rect x="28" y="83" width="44" height="8" rx="3" fill="${f}" stroke="${d}" stroke-width="2"/>
    ${locked ? `<text x="50" y="47" text-anchor="middle" font-size="22" font-family="system-ui" font-weight="700" fill="#fff">?</text>` : `<path d="M35 24 Q34 36 37 46" stroke="#fff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>${icon ? `<text x="52" y="47" text-anchor="middle" font-size="20">${icon}</text>` : ""}`}</svg>`;
}
function medalSvg(n, tier, locked) {
  const [f, d] = TIER[locked ? "locked" : tier] || TIER.gold;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M34 8 L46 40 H54 L66 8Z" fill="${locked ? "#B8C1CC" : "#3D7BFF"}"/><path d="M40 8 L50 34 L60 8" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
    <circle cx="50" cy="62" r="28" fill="${f}" stroke="${d}" stroke-width="4"/><circle cx="50" cy="62" r="20" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
    <text x="50" y="71" text-anchor="middle" font-size="24" font-family="system-ui" font-weight="800" fill="${locked ? "#fff" : d}">${locked ? "?" : n}</text></svg>`;
}
function badgeSvg(icon, tier, locked) {
  const [f, d] = TIER[locked ? "locked" : tier] || TIER.gold;
  let p = ""; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4; p += (i ? "L" : "M") + (50 + 40 * Math.cos(a)).toFixed(1) + " " + (52 + 40 * Math.sin(a)).toFixed(1); }
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${p}Z" fill="${f}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="52" r="26" fill="#fff" opacity="${locked ? .35 : .85}"/>
    <text x="50" y="62" text-anchor="middle" font-size="28">${locked ? "" : icon}</text>${locked ? `<text x="50" y="62" text-anchor="middle" font-size="26" font-family="system-ui" font-weight="800" fill="#fff">?</text>` : ""}</svg>`;
}

/* ---------- the monster's house ---------- */
// Upgrades are bought in order; furniture and pets are bought once and always on show.
const HOUSE = [
  { id: "h0", name: "Cosy den", cost: 0 },
  { id: "h1", name: "Cottage", cost: 30 },
  { id: "h2", name: "Big house", cost: 70 },
  { id: "h3", name: "Castle", cost: 150 }
];
const FURNI = [
  { id: "f_poster", name: "Race car poster", cost: 3 },
  { id: "f_ball", name: "Football", cost: 3 },
  { id: "f_stars", name: "Glow-in-the-dark stars", cost: 4 },
  { id: "f_beanbag", name: "Bean bag", cost: 5 },
  { id: "f_light", name: "Star night light", cost: 5 },
  { id: "f_rug", name: "Race track rug", cost: 6 },
  { id: "f_plant", name: "Dino buddy", cost: 8 },
  { id: "f_lamp", name: "Lava lamp", cost: 8 },
  { id: "f_toybox", name: "Treasure chest", cost: 10 },
  { id: "f_books", name: "Gaming station", cost: 15 },
  { id: "f_bed", name: "Race car bed", cost: 18 },
  { id: "f_fish", name: "Shark tank", cost: 20 },
  { id: "f_drums", name: "Drum kit", cost: 22 },
  { id: "f_rocket", name: "Rocket ship", cost: 30 },
  { id: "f_disco", name: "Disco ball", cost: 35 },
  { id: "f_throne", name: "Golden throne", cost: 60 }
];
// Each piece of furniture draws itself in house coordinates (360x240). box = where it sits, for shop close-ups.
const FURNI_ART = {
  f_stars: { box: [140, 0, 90, 26], draw: () => [[122, 9, 6], [152, 16, 4.5], [182, 7, 6], [214, 14, 4.5], [240, 6, 5], [100, 16, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="#FFF59D" opacity=".35"/>` + star(x, y, r * 1.3, "#F2B705") + star(x, y, r, "#FFF59D")).join("") },
  f_disco: { box: [208, 0, 54, 50], draw: () => `<path d="M236 0 V16" stroke="#9AA3B2" stroke-width="1.5"/><circle cx="236" cy="28" r="12" fill="#C9D1DB" stroke="#9AA3B2"/><path d="M224 24 H248 M224 32 H248 M230 17 V39 M236 16 V40 M242 17 V39" stroke="#9AA3B2" stroke-width="1"/><rect x="229" y="21" width="5" height="5" fill="#fff"/><rect x="239" y="29" width="4" height="4" fill="#9ED8FF"/><rect x="231" y="33" width="4" height="4" fill="#FF8FC7"/>` + star(218, 14, 4, "#FFE14D") + star(256, 40, 4, "#FF8FC7") + star(214, 44, 3, "#9ED8FF") },
  f_poster: { box: [242, 38, 56, 38], draw: () => `<rect x="246" y="42" width="48" height="30" rx="2" fill="#fff" stroke="#2E3650" stroke-width="2"/><rect x="249" y="45" width="42" height="24" fill="#FFE14D"/><path d="M253 64 h32 l-3 -7 h-8 l-4 -5 h-9 l-3 5 h-5z" fill="#E63946"/><circle cx="259" cy="65" r="3.5" fill="#1C1830"/><circle cx="280" cy="65" r="3.5" fill="#1C1830"/><path d="M286 52 h4 M284 56 h6" stroke="#fff" stroke-width="1.5"/>` },
  f_light: { box: [232, 130, 40, 44], draw: () => `<circle cx="252" cy="150" r="17" fill="#FFF59D" opacity=".3"/><rect x="247" y="158" width="10" height="12" rx="2" fill="#E8EDF3" stroke="#9AA3B2"/>` + star(252, 150, 9, "#FFE14D") },
  f_rocket: { box: [258, 78, 60, 136], draw: () => `<g><path d="M276 196 L262 214 H278Z M300 196 L314 214 H298Z" fill="#E63946"/><path d="M270 200 Q270 120 288 84 Q306 120 306 200Z" fill="#F1F3F6" stroke="#9AA3B2" stroke-width="3"/><path d="M276 104 Q288 78 300 104Z" fill="#E63946"/><circle cx="288" cy="132" r="10" fill="#9ED8FF" stroke="#6D7A8C" stroke-width="3"/><rect x="278" y="164" width="20" height="30" rx="8" fill="#3D7BFF"/><path d="M276 200 h24 l-4 10 h-16z" fill="#6D7A8C"/></g>` },
  f_books: { box: [292, 110, 68, 72], draw: () => `<rect x="296" y="160" width="60" height="18" rx="3" fill="#2E3650"/><rect x="300" y="116" width="54" height="40" rx="4" fill="#1C2433"/><rect x="303" y="119" width="48" height="34" rx="2" fill="#2B7BFF"/><path d="M310 146 L318 128 L326 140 L332 132 L344 146Z" fill="#4CBF5A"/><circle cx="342" cy="126" r="4" fill="#FFD43B"/><path d="M325 156 v4" stroke="#1C2433" stroke-width="4"/><rect x="304" y="164" width="16" height="10" rx="5" fill="#E8EDF3"/><circle cx="308" cy="169" r="1.6" fill="#E63946"/><circle cx="316" cy="169" r="1.6" fill="#3D7BFF"/><rect x="330" y="164" width="16" height="10" rx="5" fill="#E8EDF3"/><circle cx="342" cy="169" r="1.6" fill="#4CBF5A"/><path d="M320 170 q5 4 10 0" stroke="#9AA3B2" stroke-width="1.5" fill="none"/>` },
  f_bed: { box: [4, 128, 116, 82], draw: () => `<path d="M10 192 V160 Q12 146 30 146 H70 L86 132 H104 Q114 132 114 150 V192Z" fill="#E63946"/><path d="M74 146 L88 136 H102 V146Z" fill="#9ED8FF"/><rect x="18" y="150" width="54" height="16" rx="5" fill="#fff"/><rect x="20" y="152" width="20" height="12" rx="5" fill="#F5F5F5" stroke="#DDD"/><rect x="40" y="154" width="32" height="12" rx="3" fill="#3D7BFF"/><circle cx="62" cy="176" r="9" fill="#fff"/><text x="62" y="180" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11" fill="#E63946">1</text><path d="M10 180 H114" stroke="#B5203A" stroke-width="2"/><circle cx="30" cy="194" r="11" fill="#1C1830"/><circle cx="30" cy="194" r="5" fill="#9AA3B2"/><circle cx="96" cy="194" r="11" fill="#1C1830"/><circle cx="96" cy="194" r="5" fill="#9AA3B2"/><rect x="104" y="162" width="10" height="6" rx="2" fill="#FFD43B"/>` },
  f_fish: { box: [20, 136, 72, 42], draw: (owned) => { const fy = owned.has("f_bed") ? 104 : 140; return `<rect x="24" y="${fy}" width="64" height="34" rx="5" fill="#5BC0F8" stroke="#2E3650" stroke-width="3"/><path d="M28 ${fy + 30} q8 -6 14 0 q8 -6 14 0 q8 -6 14 0 q8 -6 14 0" fill="#E8D3A8"/><path d="M38 ${fy + 17} q14 -10 28 0 q-14 8 -28 0z" fill="#8E9AAB"/><path d="M50 ${fy + 11} l4 -7 l4 7z" fill="#8E9AAB"/><path d="M38 ${fy + 17} l-7 -5 v10z" fill="#8E9AAB"/><circle cx="60" cy="${fy + 15}" r="1.6" fill="#111"/><path d="M58 ${fy + 19} l2 -2 l2 2 l2 -2" stroke="#fff" stroke-width="1" fill="none"/><circle cx="78" cy="${fy + 9}" r="2" fill="#fff" opacity=".8"/><circle cx="82" cy="${fy + 15}" r="1.4" fill="#fff" opacity=".8"/>`; } },
  f_lamp: { box: [82, 82, 38, 48], draw: () => `<rect x="94" y="118" width="14" height="6" rx="2" fill="#7B61FF"/><path d="M95 118 L98 92 H104 L107 118Z" fill="#FF6F59" opacity=".9"/><circle cx="101" cy="111" r="3" fill="#FFD43B"/><circle cx="100" cy="102" r="2.2" fill="#FFD43B"/><rect x="97" y="86" width="8" height="6" rx="2" fill="#7B61FF"/><circle cx="101" cy="104" r="16" fill="#FF8A2A" opacity=".18"/>` },
  f_rug: { box: [120, 198, 160, 40], draw: () => `<ellipse cx="200" cy="218" rx="78" ry="17" fill="#4A4E5A"/><ellipse cx="200" cy="218" rx="60" ry="10" fill="#7CC95A"/><ellipse cx="200" cy="218" rx="69" ry="13.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 5"/><rect x="246" y="222" width="12" height="7" rx="3" fill="#E63946"/><rect x="140" y="206" width="12" height="7" rx="3" fill="#3D7BFF"/><path d="M196 201 h8 v6 h-8z" fill="#fff"/><path d="M196 201 h4 v3 h-4z M200 204 h4 v3 h-4z" fill="#1C1830"/>` },
  f_throne: { box: [150, 82, 110, 140], draw: () => `<path d="M168 214 V122 L176 96 L190 112 L205 88 L220 112 L234 96 L242 122 V214Z" fill="#F7C531" stroke="#C9930A" stroke-width="3" stroke-linejoin="round"/><path d="M178 210 V126 Q178 112 205 110 Q232 112 232 126 V210Z" fill="#C2264B"/><circle cx="205" cy="100" r="4" fill="#3FA7F5"/><circle cx="176" cy="104" r="3" fill="#E63946"/><circle cx="234" cy="104" r="3" fill="#E63946"/><rect x="156" y="174" width="22" height="42" rx="7" fill="#F7C531" stroke="#C9930A" stroke-width="3"/><rect x="232" y="174" width="22" height="42" rx="7" fill="#F7C531" stroke="#C9930A" stroke-width="3"/><circle cx="167" cy="184" r="3" fill="#3FA7F5"/><circle cx="243" cy="184" r="3" fill="#3FA7F5"/>` },
  f_beanbag: { box: [158, 182, 94, 52], draw: () => `<path d="M166 224 Q162 192 204 186 Q248 190 244 224 Q205 236 166 224Z" fill="#3D7BFF"/><path d="M176 204 q28 -12 58 0" stroke="#2F6BFF" stroke-width="3" fill="none"/><path d="M180 196 q6 -6 14 -6" stroke="#9EC1FF" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  f_plant: { box: [0, 176, 56, 62], draw: () => `<path d="M12 214 Q4 206 2 196 Q10 204 16 206Z" fill="#4CAF50"/><ellipse cx="26" cy="214" rx="15" ry="13" fill="#5CC260"/><rect x="16" y="222" width="7" height="12" rx="2" fill="#4CAF50"/><rect x="29" y="222" width="7" height="12" rx="2" fill="#4CAF50"/><rect x="26" y="180" width="24" height="18" rx="8" fill="#5CC260"/><path d="M28 198 q-2 8 4 12" stroke="#5CC260" stroke-width="10" fill="none"/><path d="M32 194 H49" stroke="#2E7D32" stroke-width="1.5"/><path d="M36 194 l1.5 3 l1.5 -3 M42 194 l1.5 3 l1.5 -3" fill="#fff"/><circle cx="36" cy="186" r="2.5" fill="#222"/><path d="M16 202 l4 -5 l2 6 M12 210 l4 -4 l1 6" fill="#2E7D32"/>` },
  f_toybox: { box: [296, 178, 58, 54], draw: () => `<rect x="302" y="198" width="46" height="30" rx="3" fill="#A0522D" stroke="#6D3A1E" stroke-width="2"/><path d="M302 198 Q325 178 348 198Z" fill="#B8662F" stroke="#6D3A1E" stroke-width="2"/><path d="M302 208 H348 M312 186 V228 M338 186 V228" stroke="#FFD43B" stroke-width="3"/><rect x="320" y="202" width="10" height="10" rx="2" fill="#FFD43B"/>${star(322, 190, 4, "#FFF59D")}${star(334, 186, 3, "#FFF59D")}` },
  f_drums: { box: [62, 180, 70, 58], draw: () => `<path d="M84 196 L76 232 M108 196 L116 232" stroke="#9AA3B2" stroke-width="2"/><ellipse cx="72" cy="196" rx="12" ry="3" fill="#FFD43B"/><path d="M72 196 V232" stroke="#9AA3B2" stroke-width="2"/><rect x="82" y="208" width="30" height="26" rx="4" fill="#E63946"/><ellipse cx="97" cy="221" rx="10" ry="10" fill="#fff" stroke="#B5203A" stroke-width="2"/>${star(97, 221, 5, "#E63946")}<rect x="112" y="200" width="16" height="12" rx="3" fill="#3D7BFF"/><ellipse cx="120" cy="200" rx="8" ry="2.5" fill="#E8EDF3"/><path d="M118 186 l8 10 M124 184 l2 13" stroke="#C49A6C" stroke-width="2.5" stroke-linecap="round"/>` },
  f_ball: { box: [244, 212, 28, 28], draw: () => `<circle cx="258" cy="226" r="10" fill="#fff" stroke="#1C1830" stroke-width="1.5"/><path d="M258 221 l4 3 l-1.5 5 h-5 l-1.5 -5z" fill="#1C1830"/><path d="M258 221 v-5 M262 224 l5 -2 M260.5 229 l3 4 M255.5 229 l-3 4 M254 224 l-5 -2" stroke="#1C1830" stroke-width="1.2"/>` }
};
// A big, clear picture of one piece of furniture against the room's wall and floor, for the shop.
// Furniture uses its picture, fitted into the spot where its drawing used to sit.
function furniPic(id) {
  const [x, y, w, h] = FURNI_ART[id].box, ceil = y < 10;
  return `<image href="${shopArt(id)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMid${ceil ? "YMin" : "YMax"} meet"/>`;
}
function furniCloseup(id, tier) {
  if (!FURNI_ART[id]) return "";
  const wall = ["#F3E2C7", "#CFE8F7", "#E6DDF6", "#C9CED6"][tier || 0], floor = ["#B98A5B", "#A8744A", "#7FB7A4", "#8E8A86"][tier || 0];
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${wall}"/><rect y="74" width="100" height="26" fill="${floor}"/><rect y="72" width="100" height="3" fill="${shade(wall, -0.25)}"/><image href="${shopArt(id)}" x="8" y="6" width="84" height="84" preserveAspectRatio="xMidYMax meet"/></svg>`;
}
const PET_IDS = ["rock", "snail", "hamster", "bunny", "cat", "puppy", "owl", "slime", "octopus", "trex", "robodog", "unicorn", "babydragon", "alien"];
// Each pet is drawn around (0,0) with its feet at about y=24.
function petSvg(id) {
  if (PET_IDS.includes(id)) return `<image href="${shopArt(id)}" x="-27" y="-29" width="54" height="54" preserveAspectRatio="xMidYMax meet"/>`;
  return petDrawn(id);
}
function petDrawn(id) {
  const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="2" fill="#222"/><circle cx="${x + .6}" cy="${y - .7}" r=".7" fill="#fff"/>`;
  switch (id) {
    case "rock": return `<path d="M-17 22 Q-20 8 -10 2 Q0 -4 10 1 Q20 6 18 22Z" fill="#9AA3B2" stroke="#6D7A8C" stroke-width="2"/><path d="M-8 8 q4 -2 7 0 M6 16 q3 -2 6 0" stroke="#6D7A8C" stroke-width="1.5" fill="none"/><circle cx="-5" cy="11" r="4.5" fill="#fff" stroke="#222" stroke-width="1"/><circle cx="6" cy="10" r="4.5" fill="#fff" stroke="#222" stroke-width="1"/><circle cx="-4" cy="12" r="2" fill="#222"/><circle cx="7" cy="11" r="2" fill="#222"/>`;
    case "snail": return `<path d="M-20 22 Q-22 16 -14 16 H14 Q22 16 22 22Z" fill="#B7E36A"/><circle cx="2" cy="8" r="12" fill="#E8A13A" stroke="#A86A1E" stroke-width="2"/><path d="M2 8 m-6 0 a6 6 0 1 1 6 6 a3 3 0 1 1 -3 -3" stroke="#A86A1E" stroke-width="2" fill="none"/><path d="M-15 16 q-2 -8 -4 -12 M-12 16 q0 -8 2 -12" stroke="#8CC63F" stroke-width="2.5" stroke-linecap="round" fill="none"/>${eye(-19, 3)}${eye(-10, 3)}<path d="M18 18 l8 -2 M18 22 l9 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
    case "hamster": return `<ellipse cx="0" cy="12" rx="17" ry="13" fill="#E8B07A"/><ellipse cx="0" cy="16" rx="10" ry="8" fill="#FBE3C6"/><circle cx="-11" cy="0" r="5" fill="#E8B07A"/><circle cx="11" cy="0" r="5" fill="#E8B07A"/><circle cx="-11" cy="0" r="2.5" fill="#F7B6B6"/><circle cx="11" cy="0" r="2.5" fill="#F7B6B6"/>${eye(-6, 7)}${eye(6, 7)}<circle cx="0" cy="11" r="1.6" fill="#D9776E"/>`;
    case "bunny": return `<ellipse cx="-6" cy="-12" rx="4.5" ry="13" fill="#F4F4F4" stroke="#DADADA"/><ellipse cx="6" cy="-12" rx="4.5" ry="13" fill="#F4F4F4" stroke="#DADADA"/><ellipse cx="-6" cy="-12" rx="2" ry="9" fill="#F7B6B6"/><ellipse cx="6" cy="-12" rx="2" ry="9" fill="#F7B6B6"/><ellipse cx="0" cy="14" rx="15" ry="11" fill="#F4F4F4" stroke="#DADADA"/><circle cx="0" cy="3" r="10" fill="#F4F4F4" stroke="#DADADA"/>${eye(-4, 2)}${eye(4, 2)}<path d="M-1.5 6 h3 l-1.5 2z" fill="#D9776E"/>`;
    case "cat": return `<ellipse cx="2" cy="14" rx="15" ry="10" fill="#F2A65A"/><circle cx="-6" cy="0" r="10" fill="#F2A65A"/><path d="M-15 -4 L-13 -15 L-7 -8Z M-3 -8 L1 -15 L3 -4Z" fill="#F2A65A"/>${eye(-10, 0)}${eye(-3, 0)}<path d="M-7.5 4 h2 l-1 1.5z" fill="#D9776E"/><path d="M16 12 q10 -2 8 -14" stroke="#F2A65A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-2 10 q4 4 0 8 M4 10 q4 4 0 8" stroke="#D98A3D" stroke-width="2" fill="none"/>`;
    case "puppy": return `<ellipse cx="-2" cy="14" rx="15" ry="10" fill="#C8A27C"/><circle cx="7" cy="0" r="10" fill="#C8A27C"/><ellipse cx="0" cy="1" rx="4" ry="8" fill="#8D6E63"/><ellipse cx="15" cy="1" rx="4" ry="8" fill="#8D6E63"/>${eye(5, -1)}${eye(10, -1)}<circle cx="8" cy="4" r="2" fill="#222"/><path d="M-16 10 q-8 -6 -6 -12" stroke="#C8A27C" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case "owl": return `<ellipse cx="0" cy="8" rx="14" ry="17" fill="#8D6E63"/><ellipse cx="0" cy="13" rx="9" ry="11" fill="#D7C2A8"/><path d="M-12 -6 L-9 -14 L-5 -8Z M12 -6 L9 -14 L5 -8Z" fill="#8D6E63"/><circle cx="-5" cy="-1" r="5.5" fill="#fff"/><circle cx="5" cy="-1" r="5.5" fill="#fff"/>${eye(-5, -1)}${eye(5, -1)}<path d="M-2 4 L2 4 L0 8Z" fill="#F2B705"/><path d="M-5 25 v-2 M5 25 v-2" stroke="#F2B705" stroke-width="3"/>`;
    case "babydragon": return `<path d="M12 16 q14 0 12 -14 l4 -2 l-3 -4 q-2 14 -14 12z" fill="#4CBF5A"/><path d="M-8 2 q-14 -10 -16 4 q8 -2 12 4z" fill="#A6E3A1"/><ellipse cx="0" cy="14" rx="13" ry="11" fill="#4CBF5A"/><ellipse cx="0" cy="17" rx="7" ry="7" fill="#C9F2C4"/><circle cx="0" cy="-1" r="10" fill="#4CBF5A"/><path d="M-6 -9 L-4 -16 L-1 -10Z M6 -9 L4 -16 L1 -10Z" fill="#FFF1C9"/>${eye(-4, -2)}${eye(4, -2)}<path d="M-3 4 q3 2 6 0" stroke="#2E7D32" stroke-width="1.5" fill="none"/>`;
    case "slime": return `<path d="M-19 24 Q-22 2 -6 -6 Q0 -9 6 -6 Q22 2 19 24Z" fill="#7CF05A" stroke="#3FAE2A" stroke-width="2"/><path d="M-12 24 v5 a2.5 2.5 0 0 0 5 0 v-5 M8 24 v8 a2.5 2.5 0 0 0 5 0 v-8" fill="#7CF05A" stroke="#3FAE2A" stroke-width="2"/><ellipse cx="-9" cy="2" rx="4" ry="6" fill="#fff" opacity=".5"/><circle cx="-6" cy="8" r="5" fill="#fff"/><circle cx="7" cy="8" r="5" fill="#fff"/><circle cx="-5" cy="9" r="2.5" fill="#222"/><circle cx="8" cy="9" r="2.5" fill="#222"/><path d="M-5 16 q6 5 12 0" stroke="#2A7A1A" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "octopus": return `${[-15, -9, -3, 3, 9, 15].map((x, i) => `<path d="M${x * .7} 10 q${x * .5} 8 ${x * .9} 12 q${i % 2 ? 4 : -4} 3 0 ${i % 2 ? -2 : 2}" stroke="#B45FE0" stroke-width="5" fill="none" stroke-linecap="round"/>`).join("")}<ellipse cx="0" cy="-2" rx="15" ry="14" fill="#C77DFF"/><circle cx="-6" cy="-2" r="4.5" fill="#fff"/><circle cx="6" cy="-2" r="4.5" fill="#fff"/><circle cx="-5" cy="-1" r="2.2" fill="#222"/><circle cx="7" cy="-1" r="2.2" fill="#222"/><path d="M-3 6 q3 3 6 0" stroke="#7A2FA8" stroke-width="2" fill="none"/><circle cx="8" cy="-10" r="2" fill="#E9C4FF"/><circle cx="-9" cy="-9" r="1.5" fill="#E9C4FF"/>`;
    case "trex": return `<path d="M-6 10 Q-22 12 -28 2 Q-18 4 -10 4Z" fill="#4CAF50"/><ellipse cx="-2" cy="10" rx="12" ry="11" fill="#5CC260"/><rect x="-8" y="18" width="6" height="7" rx="2" fill="#4CAF50"/><rect x="2" y="18" width="6" height="7" rx="2" fill="#4CAF50"/><path d="M4 2 q4 3 6 6" stroke="#4CAF50" stroke-width="3" stroke-linecap="round"/><path d="M-6 4 Q-4 -10 6 -10 L12 -6 Q6 2 6 10Z" fill="#5CC260"/><rect x="0" y="-18" width="22" height="16" rx="7" fill="#5CC260"/><path d="M4 -4 H21" stroke="#2E7D32" stroke-width="1.5"/><path d="M8 -4 l1.5 3 l1.5 -3 M13 -4 l1.5 3 l1.5 -3 M18 -4 l1.5 3 l1.5 -3" fill="#fff"/>${eye(8, -12)}<path d="M-8 -2 l4 -4 l2 5 M-12 4 l4 -3 l1 5" fill="#2E7D32"/>`;
    case "robodog": return `<rect x="-16" y="2" width="26" height="14" rx="4" fill="#B8C4D0" stroke="#6D7A8C" stroke-width="2"/><rect x="-14" y="16" width="5" height="8" fill="#6D7A8C"/><rect x="2" y="16" width="5" height="8" fill="#6D7A8C"/><path d="M-16 6 l-8 -6" stroke="#6D7A8C" stroke-width="3" stroke-linecap="round"/><rect x="4" y="-14" width="20" height="16" rx="4" fill="#D5DEE7" stroke="#6D7A8C" stroke-width="2"/><rect x="7" y="-11" width="14" height="8" rx="2" fill="#1C2433"/><circle cx="11" cy="-7" r="2" fill="#3FF0FF"/><circle cx="17" cy="-7" r="2" fill="#3FF0FF"/><path d="M8 -14 V-20" stroke="#6D7A8C" stroke-width="2"/><circle cx="8" cy="-21" r="2.5" fill="#FF5E5E"/><rect x="-10" y="6" width="10" height="5" rx="2" fill="#3FF0FF" opacity=".7"/>`;
    case "unicorn": return `<path d="M-14 6 q-12 2 -12 14 q6 -6 12 -6z" fill="#FF7EB6"/><ellipse cx="-2" cy="12" rx="15" ry="10" fill="#FFFFFF" stroke="#E5D9F2" stroke-width="2"/><rect x="-12" y="18" width="5" height="7" rx="2" fill="#fff" stroke="#E5D9F2"/><rect x="4" y="18" width="5" height="7" rx="2" fill="#fff" stroke="#E5D9F2"/><ellipse cx="11" cy="-2" rx="9" ry="8" fill="#FFFFFF" stroke="#E5D9F2" stroke-width="2"/><path d="M10 -9 L14 -26 L16 -8Z" fill="#FFD43B" stroke="#E0A800" stroke-width="1"/><path d="M4 -10 q-8 4 -6 14 q4 -6 6 -4 q-2 -6 4 -8z" fill="#7B61FF"/><path d="M6 -10 q-4 6 -2 12" stroke="#3FA7F5" stroke-width="3" fill="none"/>${eye(13, -3)}<circle cx="17" cy="1" r="1.2" fill="#E8A0BF"/>`;
    case "alien": return `<ellipse cx="0" cy="-2" rx="11" ry="12" fill="#BDF3FF" opacity=".75" stroke="#7FD8EA" stroke-width="2"/><ellipse cx="0" cy="0" rx="6" ry="7" fill="#8AE04A"/><path d="M-3 -6 l-3 -6 M3 -6 l3 -6" stroke="#8AE04A" stroke-width="2"/><circle cx="-6" cy="-12" r="2" fill="#8AE04A"/><circle cx="6" cy="-12" r="2" fill="#8AE04A"/><ellipse cx="-2.5" cy="-1" rx="2" ry="2.8" fill="#111"/><ellipse cx="2.5" cy="-1" rx="2" ry="2.8" fill="#111"/><ellipse cx="0" cy="10" rx="26" ry="8" fill="#9AA3B2" stroke="#6D7A8C" stroke-width="2"/><ellipse cx="0" cy="8" rx="18" ry="3" fill="#C9D1DC"/>${[-18, -9, 0, 9, 18].map((x, i) => `<circle cx="${x}" cy="12" r="2" fill="${["#FFD43B", "#FF5E8A", "#3FF0FF"][i % 3]}"/>`).join("")}<path d="M-8 18 L-14 26 H14 L8 18Z" fill="#FFF59D" opacity=".45"/>`;
    default: return "";
  }
}
// The outside of a child's house, for the lawn. Drawn in a 120x110 box, sitting on y=110.
function houseOutsideSvg(tier, color) {
  const c = color || "#2BB3A3", cd = shade(c, -0.25), ink = "#1C1830";
  const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#BFE6FF" stroke="${ink}" stroke-opacity=".35" stroke-width="2"/><path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#fff" stroke-width="2"/>`;
  switch (tier) {
    case 1: return `<rect x="22" y="52" width="76" height="58" fill="#FFF3DC" stroke="#E2CBA2" stroke-width="2"/><rect x="76" y="20" width="10" height="24" fill="#B5654A"/>
      <path d="M12 56 L60 16 L108 56Z" fill="${c}" stroke="${cd}" stroke-width="3" stroke-linejoin="round"/>${win(30, 64, 20, 18)}
      <rect x="62" y="74" width="20" height="36" rx="10" fill="${cd}"/><circle cx="77" cy="93" r="2" fill="#FFD43B"/>
      <path d="M24 110 q6 -10 12 0 q6 -10 12 0" fill="#4CBF5A"/>`;
    case 2: return `<rect x="10" y="40" width="100" height="70" fill="#FDE8D7" stroke="#E6C7AE" stroke-width="2"/>
      <path d="M2 44 L60 6 L118 44Z" fill="${c}" stroke="${cd}" stroke-width="3" stroke-linejoin="round"/>${win(18, 50, 20, 16)}${win(82, 50, 20, 16)}${win(18, 80, 20, 16)}${win(82, 80, 20, 16)}
      <circle cx="60" cy="30" r="7" fill="#BFE6FF" stroke="${ink}" stroke-opacity=".35" stroke-width="2"/>
      <rect x="48" y="72" width="24" height="38" rx="4" fill="${cd}"/><circle cx="67" cy="92" r="2" fill="#FFD43B"/><path d="M44 72 H76" stroke="#fff" stroke-width="3"/>`;
    case 3: {
      const bat = (x, w, y) => Array.from({ length: Math.floor(w / 8) }, (_, i) => `<rect x="${x + i * 8}" y="${y - 6}" width="5" height="7" fill="#9AA3B2"/>`).join("");
      return `<rect x="22" y="42" width="76" height="68" fill="#AEB6C4"/>${bat(22, 78, 42)}
        <rect x="2" y="24" width="26" height="86" fill="#9AA3B2"/>${bat(2, 28, 24)}<rect x="92" y="24" width="26" height="86" fill="#9AA3B2"/>${bat(92, 28, 24)}
        <path d="M15 24 V2" stroke="${ink}" stroke-width="2"/><path d="M15 2 L30 7 L15 12Z" fill="${c}"/><path d="M105 24 V2" stroke="${ink}" stroke-width="2"/><path d="M105 2 L120 7 L105 12Z" fill="${c}"/>
        <rect x="9" y="44" width="10" height="16" rx="5" fill="#2E3650"/><rect x="101" y="44" width="10" height="16" rx="5" fill="#2E3650"/>
        <path d="M44 110 V82 a16 16 0 0 1 32 0 V110Z" fill="${cd}"/><path d="M48 90 H72 M48 98 H72" stroke="${ink}" stroke-opacity=".3" stroke-width="2"/>
        <rect x="52" y="54" width="16" height="14" rx="3" fill="${c}"/>`;
    }
    default: return `<path d="M8 110 Q8 40 60 36 Q112 40 112 110Z" fill="#7BC67E" stroke="#4E9A52" stroke-width="3"/>
      <path d="M20 70 q8 -6 14 0 M80 56 q8 -6 14 0 M90 86 q6 -5 12 0" stroke="#4E9A52" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M40 110 V84 a20 20 0 0 1 40 0 V110Z" fill="${c}" stroke="${cd}" stroke-width="3"/><circle cx="72" cy="94" r="2.5" fill="#FFD43B"/>
      <circle cx="60" cy="58" r="8" fill="#BFE6FF" stroke="${ink}" stroke-opacity=".35" stroke-width="2"/>`;
  }
}
function houseTier(owned) { let t = 0; HOUSE.forEach((h, i) => { if (i && owned.has(h.id)) t = i; }); return t; }
function accIcon(id) {
  switch (id) {
    case "glasses": return `<circle cx="-9" cy="0" r="7" fill="none" stroke="#1C1830" stroke-width="3"/><circle cx="9" cy="0" r="7" fill="none" stroke="#1C1830" stroke-width="3"/><path d="M-2 0 H2" stroke="#1C1830" stroke-width="3"/>`;
    case "bowtie": return `<path d="M0 0 L-14 -9 L-14 9Z M0 0 L14 -9 L14 9Z" fill="#E23B4E"/><circle r="4" fill="#B5203A"/>`;
    case "scarf": return `<rect x="-16" y="-6" width="32" height="11" rx="5" fill="#3D7BFF"/><rect x="4" y="0" width="9" height="20" rx="3" fill="#3D7BFF"/>`;
    case "shades": return `<rect x="-17" y="-6" width="14" height="11" rx="5" fill="#1C1830"/><rect x="3" y="-6" width="14" height="11" rx="5" fill="#1C1830"/><path d="M-3 -2 H3" stroke="#1C1830" stroke-width="3"/>`;
    case "bandana": return `<path d="M-14 -8 H14 L0 12Z" fill="#E63946"/><circle cx="-4" cy="-3" r="1.6" fill="#fff"/><circle cx="4" cy="1" r="1.6" fill="#fff"/>`;
    case "jetpack": return `<rect x="-14" y="-14" width="11" height="24" rx="5" fill="#B8C4D0" stroke="#6D7A8C" stroke-width="2"/><rect x="3" y="-14" width="11" height="24" rx="5" fill="#B8C4D0" stroke="#6D7A8C" stroke-width="2"/><path d="M-12 11 q3 9 6 0 M5 11 q3 9 6 0" fill="#FF8A2A"/>`;
    case "cape": return `<path d="M-10 -12 Q0 -8 10 -12 L16 16 Q0 21 -16 16Z" fill="#E23B4E"/>`;
    default: return "";
  }
}
// Draws the room. o = { tier, owned:Set, look, equip, level, shelf:[{svg}], monster:true }
function houseSvg(o) {
  const tier = o.tier || 0, owned = o.owned || new Set(), gid = "h" + (++svgN);
  const wall = ["#F3E2C7", "#CFE8F7", "#E6DDF6", "#C9CED6"][tier], wall2 = ["#E8D2AF", "#B9DCF1", "#D6C9EF", "#B4BAC4"][tier];
  const floor = ["#B98A5B", "#A8744A", "#7FB7A4", "#8E8A86"][tier], floor2 = shade(floor, -0.15);
  let s = `<svg viewBox="0 0 360 240" role="img" aria-label="${HOUSE[tier].name}"><defs><clipPath id="${gid}w"><rect width="360" height="240" rx="22"/></clipPath></defs><g clip-path="url(#${gid}w)">`;
  // wall
  s += `<rect width="360" height="176" fill="${wall}"/>`;
  if (tier === 1) for (let x = 0; x < 360; x += 24) s += `<rect x="${x}" y="0" width="12" height="176" fill="${wall2}" opacity=".5"/>`;
  if (tier === 2) for (let y = 14; y < 176; y += 28) for (let x = (y / 28 % 2) * 14; x < 360; x += 28) s += `<circle cx="${x}" cy="${y}" r="3" fill="${wall2}"/>`;
  if (tier === 3) for (let y = 0; y < 176; y += 22) for (let x = ((y / 22) % 2) * 22 - 22; x < 360; x += 44) s += `<rect x="${x + 1}" y="${y + 1}" width="42" height="20" rx="3" fill="${wall2}" opacity=".6"/>`;
  // window (bigger with each upgrade)
  const ww = [52, 70, 84, 70][tier], wh = [46, 60, 70, 84][tier], wx = 26, wy = 24;
  if (tier === 3) s += `<path d="M${wx} ${wy + wh} V${wy + 30} Q${wx + ww / 2} ${wy - 12} ${wx + ww} ${wy + 30} V${wy + wh}Z" fill="#9ED8FF" stroke="#6B6560" stroke-width="5"/>`;
  else s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="6" fill="#9ED8FF" stroke="#FFFFFF" stroke-width="5"/><path d="M${wx + ww / 2} ${wy} V${wy + wh} M${wx} ${wy + wh / 2} H${wx + ww}" stroke="#FFFFFF" stroke-width="4"/>`;
  s += `<circle cx="${wx + ww - 14}" cy="${wy + 14}" r="7" fill="#FFD44D"/>`;
  if (tier >= 1) s += `<path d="M${wx - 8} ${wy - 6} Q${wx + 8} ${wy + wh / 2} ${wx - 4} ${wy + wh + 6} L${wx - 12} ${wy + wh + 6} V${wy - 6}Z M${wx + ww + 8} ${wy - 6} Q${wx + ww - 8} ${wy + wh / 2} ${wx + ww + 4} ${wy + wh + 6} L${wx + ww + 12} ${wy + wh + 6} V${wy - 6}Z" fill="${["", "#FF8A80", "#9B7BEA", "#C2264B"][tier]}"/>`;
  if (tier === 3) s += `<path d="M240 0 V44 L247 38 L254 44 V0Z" fill="#C2264B"/>`;
  if (tier >= 2) s += `<path d="M176 0 V8" stroke="#555" stroke-width="2"/><path d="M166 8 H186 L181 17 H171Z" fill="#FFD44D"/>`;
  // floor
  s += `<rect y="176" width="360" height="64" fill="${floor}"/>`;
  if (tier === 0 || tier === 1) for (let x = 0; x < 360; x += 40) s += `<path d="M${x} 176 V240" stroke="${floor2}" stroke-width="2"/>`;
  if (tier === 3) for (let x = 0; x < 360; x += 36) for (let y = 176; y < 240; y += 18) s += `<rect x="${x + ((y - 176) / 18 % 2) * 18}" y="${y}" width="34" height="16" fill="${floor2}" opacity=".4"/>`;
  s += `<rect y="172" width="360" height="6" fill="${shade(wall, -0.25)}"/>`;
  // posters: backgrounds owned (top right)
  const posters = ["meadow", "ocean", "space", "volcano"].filter((b) => owned.has(b));
  posters.forEach((b, i) => { const x = 256 + i * 25, y = 12; s += `<g data-wear="${b}" style="cursor:pointer"><rect x="${x - 2}" y="${y - 2}" width="24" height="24" rx="3" fill="#6B4B3E"/><svg x="${x}" y="${y}" width="20" height="20" viewBox="0 0 200 200">${bgSvg(b, gid + b)}</svg></g>`; });
  // trophy shelf (top middle)
  if (o.shelf && o.shelf.length) {
    s += `<rect x="116" y="56" width="120" height="6" rx="2" fill="#8D6E63"/>`;
    o.shelf.slice(0, 3).forEach((t, i) => { s += `<svg x="${120 + i * 38}" y="22" width="34" height="34" style="width:34px;height:34px" viewBox="0 0 100 100">${t}</svg>`; });
  }
  // hat shelf
  const hats = SHOP.filter((i) => i.slot === "hat" && owned.has(i.id)).map((i) => i.id);
  if (hats.length) {
    s += `<rect x="116" y="96" width="${Math.max(60, hats.length * (hats.length > 6 ? 22 : 30) + 14)}" height="6" rx="2" fill="#8D6E63"/>`;
    const hs = hats.length > 6 ? 22 : 30;
    hats.forEach((h, i) => { const x = 118 + i * hs; s += `<g data-wear="${h}" style="cursor:pointer"><rect x="${x}" y="64" width="32" height="34" fill="transparent"/><svg x="${x}" y="64" width="32" height="34" viewBox="62 ${h === "wizard" || h === "diamond" ? -6 : 8} 76 ${h === "wizard" || h === "diamond" ? 76 : 62}">${hatPart(h, 60)}</svg></g>`; });
  }
  // paint tins for skins (on a little shelf, right)
  const skins = SHOP.filter((i) => i.slot === "skin" && owned.has(i.id)).map((i) => i.id);
  const tinCol = { spots: "#8D6E63", stripes: "#6D7A8C", stars: "#3D7BFF", rainbow: "#FF5E8A", gold: "#F2B705", galaxy: "#5B2BD9" };
  if (skins.length) s += `<rect x="300" y="108" width="52" height="5" rx="2" fill="#8D6E63"/>`;
  const ts = skins.length > 4 ? 8.5 : 12.5, tw = skins.length > 4 ? 7.5 : 11;
  skins.forEach((k, i) => { const x = 302 + i * ts; s += `<g data-wear="${k}" style="cursor:pointer"><rect x="${x}" y="92" width="${tw}" height="16" rx="2" fill="${tinCol[k]}"/><rect x="${x}" y="92" width="${tw}" height="4" rx="1.5" fill="#DDD"/></g>`; });
  // furniture, back to front
  Object.keys(FURNI_ART).forEach((id) => { if (owned.has(id)) s += furniPic(id); });
  // coat stand with accessories
  const accs = SHOP.filter((i) => i.slot === "acc" && owned.has(i.id)).map((i) => i.id);
  if (accs.length) {
    s += `<path d="M132 116 V206" stroke="#6D4C41" stroke-width="4"/><ellipse cx="132" cy="208" rx="16" ry="4" fill="#6D4C41"/><path d="M120 122 H144" stroke="#6D4C41" stroke-width="4" stroke-linecap="round"/>`;
    const spots = [[132, 110], [118, 136], [146, 136], [132, 166], [118, 188], [146, 188], [132, 88]];
    accs.forEach((a, i) => { const [x, y] = spots[i]; s += `<g data-wear="${a}" style="cursor:pointer"><g transform="translate(${x} ${y}) scale(.75)">${accIcon(a)}</g><rect x="${x - 14}" y="${y - 12}" width="28" height="26" fill="transparent"/></g>`; });
  }
  // the monster
  if (o.monster !== false) s += `<g data-monster="1" style="cursor:pointer"><svg x="148" y="106" width="114" height="114" style="width:114px;height:114px" viewBox="0 0 200 200">${monsterSvg(o.look, Object.assign({}, o.equip, { bg: null }), o.level)}</svg></g>`;
  // pets: the sidekick sits by the monster, the rest play around the room
  const spots = [[290, 222], [140, 230], [56, 230], [250, 234], [330, 234], [176, 236], [216, 232], [100, 222], [272, 206], [24, 228], [314, 214], [196, 222]];
  PET_IDS.filter((p) => owned.has(p) && p !== (o.equip || {}).pet).forEach((p, i) => { const [x, y] = spots[i % spots.length]; s += `<g data-wear="${p}" style="cursor:pointer"><g transform="translate(${x} ${y - 14}) scale(.85)">${petSvg(p)}</g></g>`; });
  return s + `</g></svg>`;
}

window.HD = { artUrl, shopArt, star, LIB, BONUS, SHOP, PRICE_TIERS, priceTier, FURNI_ART, furniCloseup, SLOTS, LEVELS, COLORS, SHAPES, TOPS, SPECIES, MOUTHS, EYESTYLES, BROWS, NOSES, CHEEKS, ARMS, BELLIES, LOOK_DEFAULTS, monsterSvg, shade, trophySvg, medalSvg, badgeSvg, HOUSE, FURNI, houseTier, houseSvg, houseOutsideSvg, hatPart, accIcon, petSvg, PET_IDS };
})();
