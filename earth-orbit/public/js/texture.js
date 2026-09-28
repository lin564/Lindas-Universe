// Procedurally drawn Earth textures.
//
// The whole app ships with no image assets, so the globe is rasterised at
// runtime onto a 2D canvas from a coarse set of hand-simplified coastlines and
// then used as an equirectangular map. It is a schematic Earth, not a survey —
// accurate enough to find your city on, deliberately not a basemap.

// Continent outlines as [longitude, latitude] rings.
const LAND = {
    northAmerica: [
        [-168,65.5],[-166,60],[-162,58],[-158,56],[-153,57],[-150,59],[-145,60],
        [-140,59],[-135,57],[-130,54],[-126,50],[-124,46],[-124,40],[-121,36],
        [-117,32],[-114,28],[-110,24],[-106,22],[-100,18],[-95,16],[-92,15],
        [-88,16],[-84,10],[-81,9],[-79,9],[-83,13],[-87,16],[-91,19],[-95,19],
        [-97,22],[-97,26],[-94,29],[-90,29],[-88,30],[-84,30],[-82,27],[-80,25],
        [-81,29],[-79,33],[-76,35],[-75,38],[-74,40],[-71,41],[-70,43],[-67,45],
        [-65,44],[-64,47],[-60,47],[-56,51],[-58,54],[-64,58],[-68,58],[-78,62],
        [-80,65],[-85,67],[-95,68],[-105,69],[-115,70],[-125,70],[-135,69],
        [-145,70],[-156,71],[-165,68],
    ],
    southAmerica: [
        [-81,-4],[-80,0],[-77,1],[-75,4],[-72,8],[-68,11],[-62,10],[-60,8],
        [-55,5],[-51,4],[-50,0],[-44,-2],[-38,-5],[-35,-8],[-38,-12],[-39,-16],
        [-41,-22],[-48,-25],[-53,-33],[-57,-38],[-62,-39],[-63,-42],[-65,-45],
        [-68,-50],[-70,-54],[-73,-53],[-75,-47],[-74,-42],[-73,-37],[-71,-30],
        [-70,-23],[-71,-18],[-76,-14],[-79,-8],
    ],
    africa: [
        [-17,15],[-16,20],[-13,24],[-10,27],[-6,32],[-2,35],[3,37],[10,34],
        [15,32],[20,31],[25,32],[30,31],[33,28],[35,24],[37,20],[39,15],[43,12],
        [48,12],[51,11],[51,6],[45,3],[42,-1],[40,-5],[39,-10],[35,-17],
        [35,-22],[32,-26],[30,-31],[26,-34],[20,-35],[18,-33],[15,-27],[13,-23],
        [12,-17],[9,-1],[9,4],[5,5],[0,5],[-5,5],[-10,6],[-13,9],[-16,12],
    ],
    eurasia: [
        [-9,38],[-9,43],[-2,43],[0,47],[-4,48],[2,51],[7,54],[8,57],[11,59],
        [15,62],[18,65],[22,66],[16,69],[22,70],[28,71],[36,68],[44,66],[52,69],
        [60,71],[68,73],[76,73],[84,74],[92,76],[100,77],[108,76],[115,74],
        [124,73],[132,72],[140,72],[148,70],[156,71],[164,70],[172,68],[180,65],
        [176,63],[170,61],[164,60],[160,58],[155,55],[150,53],[143,52],[141,48],
        [135,44],[131,43],[128,38],[126,35],[122,31],[120,27],[116,23],[112,21],
        [108,18],[106,10],[104,2],[100,7],[98,12],[95,16],[92,21],[88,22],
        [84,19],[80,14],[77,8],[74,16],[70,21],[67,24],[62,25],[57,26],[53,25],
        [50,29],[48,30],[44,29],[40,22],[37,26],[35,30],[36,36],[30,37],[26,40],
        [23,40],[19,41],[16,42],[13,45],[12,44],[15,40],[16,38],[12,38],[11,42],
        [8,44],[3,43],[0,40],[-2,36],[-6,37],
    ],
    australia: [
        [113,-22],[114,-26],[115,-32],[118,-35],[123,-34],[129,-32],[134,-33],
        [138,-35],[141,-38],[146,-39],[150,-37],[153,-32],[153,-27],[149,-21],
        [146,-19],[143,-14],[142,-11],[137,-12],[133,-11],[130,-12],[126,-14],
        [122,-17],[117,-21],
    ],
    greenland: [
        [-45,60],[-50,64],[-53,67],[-55,70],[-58,74],[-62,77],[-58,81],[-45,83],
        [-30,82],[-22,77],[-20,73],[-25,70],[-32,67],[-38,64],[-42,61],
    ],
    antarctica: [
        [-180,-78],[-150,-76],[-120,-74],[-90,-72],[-60,-70],[-45,-64],[-30,-70],
        [0,-70],[30,-68],[60,-67],[90,-66],[120,-66],[150,-70],[180,-78],
        [180,-90],[-180,-90],
    ],
    britain:    [[-5,50],[-6,52],[-5,55],[-6,58],[-3,58],[-2,56],[0,53],[1,51],[-2,50]],
    ireland:    [[-10,52],[-10,55],[-7,55],[-6,53],[-8,51]],
    iceland:    [[-24,65],[-22,66],[-15,66],[-14,65],[-19,63]],
    japan:      [[130,31],[132,34],[136,35],[139,35],[141,39],[141,43],[145,44],[144,42],[140,38],[137,36],[133,34],[131,33]],
    madagascar: [[43,-16],[44,-20],[45,-25],[47,-25],[50,-19],[49,-15],[47,-13]],
    newZealand: [[166,-46],[168,-44],[171,-42],[174,-41],[173,-38],[176,-38],[178,-37],[176,-40],[174,-43],[170,-46]],
    sumatra:    [[95,5],[97,3],[101,0],[104,-3],[106,-6],[103,-5],[100,-1],[97,2]],
    java:       [[105,-6],[110,-7],[114,-8],[112,-8.5],[107,-7.5]],
    borneo:     [[109,2],[110,-2],[114,-4],[117,-3],[119,1],[117,5],[113,4]],
    newGuinea:  [[131,-1],[135,-3],[140,-4],[145,-6],[150,-9],[147,-9],[141,-8],[136,-6],[132,-4]],
    philippines:[[121,18],[124,13],[126,9],[125,6],[122,7],[120,13],[119,16]],
    sriLanka:   [[80,6],[82,7],[81,9],[80,9]],
    cuba:       [[-85,22],[-80,23],[-75,20],[-79,21],[-83,21]],
    sulawesi:   [[119,-5],[120,-2],[123,-1],[125,1],[124,-2],[121,-4]],
};

// Ocean drawn back over the land — inland seas and large lakes.
const WATER = {
    hudsonBay:  [[-95,60],[-92,55],[-82,55],[-78,60],[-80,64],[-88,64],[-94,63]],
    greatLakes: [[-92,47],[-84,49],[-76,45],[-82,41],[-88,43]],
    caspian:    [[47,37],[51,38],[53,42],[51,46],[48,45],[47,41]],
    blackSea:   [[28,41],[41,42],[40,45],[31,46],[28,44]],
    baltic:     [[12,55],[20,55],[25,60],[21,64],[18,60],[13,57]],
    redSea:     [[33,28],[43,13],[40,12],[32,26]],
    mediterranean: [[-5,36],[10,38],[20,36],[28,36],[35,35],[33,32],[20,31],[10,33],[0,36]],
    persianGulf:[[48,30],[56,26],[54,24],[47,28]],
};

const equirect = (lon, lat, w, h) => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
];

function tracePath(ctx, ring, w, h) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
        const [x, y] = equirect(lon, lat, w, h);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
}

// Cheap value noise, for mottling the surface so it does not read as flat vinyl.
function noise(x, y, seed) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
    return s - Math.floor(s);
}

// Land colour by latitude: ice, tundra, boreal, temperate, desert, tropics.
function landColor(lat) {
    const a = Math.abs(lat);
    if (a > 72) return [232, 238, 245];
    if (a > 62) return [150, 165, 150];
    if (a > 48) return [86, 118, 82];
    if (a > 36) return [104, 132, 76];
    if (a > 28) return [176, 158, 106];   // the desert belts
    if (a > 20) return [156, 150, 92];
    if (a > 10) return [96, 130, 68];
    return [72, 118, 60];                  // equatorial forest
}

// The daylight-side map: oceans, land, ice caps.
export function earthDayTexture(width = 2048) {
    const w = width, h = width / 2;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');

    // Ocean, deepening away from the equator.
    const ocean = ctx.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0.00, '#13355e');
    ocean.addColorStop(0.30, '#12457c');
    ocean.addColorStop(0.50, '#1a5c96');
    ocean.addColorStop(0.70, '#12457c');
    ocean.addColorStop(1.00, '#13355e');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);

    // Land. Each ring is drawn three times — at -360°, 0° and +360° — so
    // shapes crossing the antimeridian wrap instead of being clipped.
    for (const ring of Object.values(LAND)) {
        for (const shift of [-360, 0, 360]) {
            const shifted = ring.map(([lon, lat]) => [lon + shift, lat]);
            const lats = ring.map(p => p[1]);
            const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
            const [r, g, b] = landColor(mid);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            tracePath(ctx, shifted, w, h);
            ctx.fill();
        }
    }

    // Latitude-banded tint over the land, so a single continent still shows
    // desert, forest and tundra rather than one flat colour.
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    for (let y = 0; y < h; y++) {
        const lat = 90 - (y / h) * 180;
        const [lr, lg, lb] = landColor(lat);
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const isLand = px[i + 1] > px[i + 2];   // land is green-dominant, ocean blue
            const n = noise(x * 0.35, y * 0.35, 1) * 0.16 + 0.92;
            if (isLand) {
                px[i]     = Math.min(255, lr * n);
                px[i + 1] = Math.min(255, lg * n);
                px[i + 2] = Math.min(255, lb * n);
            } else {
                const m = noise(x * 0.12, y * 0.12, 7) * 0.10 + 0.95;
                px[i]     *= m;
                px[i + 1] *= m;
                px[i + 2] *= m;
            }
        }
    }
    ctx.putImageData(img, 0, 0);

    // Inland seas, painted back over the land.
    ctx.fillStyle = '#17527f';
    for (const ring of Object.values(WATER)) {
        tracePath(ctx, ring, w, h);
        ctx.fill();
    }

    // Polar ice, faded in toward the poles.
    for (const pole of [1, -1]) {
        const [, y0] = equirect(0, pole * 58, w, h);
        const [, y1] = equirect(0, pole * 90, w, h);
        const cap = ctx.createLinearGradient(0, y0, 0, y1);
        cap.addColorStop(0, 'rgba(240,246,252,0)');
        cap.addColorStop(0.45, 'rgba(240,246,252,0.55)');
        cap.addColorStop(1, 'rgba(248,252,255,0.96)');
        ctx.fillStyle = cap;
        ctx.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0));
    }

    return cv;
}

// A dark map with warm pinpricks where the land is, for the night side.
export function earthNightTexture(width = 1024) {
    const w = width, h = width / 2;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000205';
    ctx.fillRect(0, 0, w, h);

    // Mask to the land, then scatter lights inside it.
    ctx.save();
    ctx.beginPath();
    for (const ring of Object.values(LAND)) {
        if (ring === LAND.antarctica) continue;
        for (const shift of [-360, 0, 360]) {
            ring.forEach(([lon, lat], i) => {
                const [x, y] = equirect(lon + shift, lat, w, h);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.closePath();
        }
    }
    ctx.clip();

    for (let i = 0; i < 9000; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const lat = 90 - (y / h) * 180;
        // Cities cluster in the mid-latitudes and thin out toward the poles.
        if (Math.random() > Math.cos(lat * Math.PI / 180) ** 1.5) continue;
        const r = Math.random() * 1.6 + 0.3;
        const a = Math.random() * 0.5 + 0.25;
        ctx.fillStyle = `rgba(255,${190 + Math.random() * 50 | 0},120,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    return cv;
}

// Grey, cratered Moon.
export function moonTexture(width = 512) {
    const w = width, h = width / 2;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#9a968f';
    ctx.fillRect(0, 0, w, h);

    // Maria — the dark basaltic plains, mostly on the near side.
    for (let i = 0; i < 14; i++) {
        const x = w * (0.18 + Math.random() * 0.42);
        const y = h * (0.2 + Math.random() * 0.5);
        const r = w * (0.03 + Math.random() * 0.07);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(88,86,84,0.85)');
        g.addColorStop(1, 'rgba(88,86,84,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Craters.
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = Math.random() * 5 + 1;
        ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.18})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(60,58,56,${Math.random() * 0.22})`;
        ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    return cv;
}
