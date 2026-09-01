// Orbital mechanics, solar geometry, and the surface-temperature model.
//
// Pure math — no Three.js, no DOM. Everything here is testable in isolation
// and is the single source of truth for both the 3D scene and the readouts.
//
// Frame convention (shared with scene.js):
//   The ecliptic is the XZ plane, ecliptic north is +Y, the Sun sits at the
//   origin, and a body at ecliptic longitude L sits along
//       dir(L) = (cos L, 0, -sin L)
//   so the Earth orbits counter-clockwise seen from ecliptic north, as it does.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRUE_OBLIQUITY = 23.44;      // degrees — the real Earth, for reference
export const SOLAR_CONSTANT = 1361;       // W/m² at 1 AU
export const TROPICAL_YEAR = 365.2422;    // days
export const SIDEREAL_DAY = 0.99726968;   // days — one rotation w.r.t. the stars

const ECCENTRICITY = 0.016708;
// Ecliptic longitude of the Sun at perihelion (~Jan 3). Fixes where the
// closest approach falls relative to the solstices.
const PERIHELION_LONGITUDE = 282.9 * DEG;
// Day-of-year of perihelion passage.
const PERIHELION_DAY = 3.0;

// Moon
export const MOON_SIDEREAL_MONTH = 27.321661;   // days
const MOON_ECCENTRICITY = 0.0549;
const MOON_INCLINATION = 5.145 * DEG;           // to the ECLIPTIC, not the equator
const MOON_NODE_PERIOD = -6798.38;              // days; negative = the node regresses

// ---------------------------------------------------------------------------
// Kepler
// ---------------------------------------------------------------------------

// Solve M = E - e sin E for the eccentric anomaly, by Newton's method.
export function eccentricAnomaly(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) {
        const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= d;
        if (Math.abs(d) < 1e-12) break;
    }
    return E;
}

// True anomaly and radius (in units of the semi-major axis) at mean anomaly M.
export function keplerOrbit(M, e) {
    const E = eccentricAnomaly(M, e);
    const nu = 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2),
    );
    return { nu, r: 1 - e * Math.cos(E) };
}

// ---------------------------------------------------------------------------
// Earth's orbit
// ---------------------------------------------------------------------------

// State of the Earth-Sun pair at a given day-of-year (may be fractional and
// may run past 365 — it wraps).
//
//   sunLongitude — the Sun's apparent ecliptic longitude seen from Earth.
//                  0° = March equinox, 90° = June solstice, 180° = September
//                  equinox, 270° = December solstice.
//   earthLongitude — heliocentric longitude of the Earth (sunLongitude + 180°).
//   distance — Earth-Sun distance in AU.
export function earthOrbit(day) {
    const M = 2 * Math.PI * ((day - PERIHELION_DAY) / TROPICAL_YEAR);
    const { nu, r } = keplerOrbit(M, ECCENTRICITY);
    const sunLongitude = wrapAngle(nu + PERIHELION_LONGITUDE);
    return {
        sunLongitude,
        earthLongitude: wrapAngle(sunLongitude + Math.PI),
        distance: r,
    };
}

// Solar declination: the latitude at which the Sun is directly overhead.
// Falls straight out of the geometry — sin(dec) = sin(tilt) * sin(sunLongitude).
export function declination(sunLongitude, tiltDeg) {
    return Math.asin(Math.sin(tiltDeg * DEG) * Math.sin(sunLongitude));
}

// The Earth's spin axis, fixed in inertial space, tilted `tiltDeg` from the
// ecliptic normal. Oriented so the north pole leans sunward at the June
// solstice (sunLongitude = 90°), which is what makes June northern summer.
export function spinAxis(tiltDeg) {
    const t = tiltDeg * DEG;
    return { x: 0, y: Math.cos(t), z: -Math.sin(t) };
}

// Unit vector pointing from the Sun toward a body at ecliptic longitude L.
export function eclipticDir(L) {
    return { x: Math.cos(L), y: 0, z: -Math.sin(L) };
}

// ---------------------------------------------------------------------------
// The Moon
// ---------------------------------------------------------------------------

// Geocentric position of the Moon, in Earth radii, in the same ecliptic frame.
// The orbit is inclined to the ECLIPTIC, so it is unaffected by Earth's tilt —
// changing the tilt slider does not tilt the Moon's orbit, which is correct.
export function moonPosition(day) {
    const M = 2 * Math.PI * (day / MOON_SIDEREAL_MONTH);
    const { nu, r } = keplerOrbit(M, MOON_ECCENTRICITY);

    // Longitude of the ascending node, regressing over ~18.6 years.
    const node = 2 * Math.PI * (day / MOON_NODE_PERIOD);
    const argLat = nu;   // angle in the orbital plane, measured from the node

    // Position in the orbital plane, then rotated by the inclination about the
    // node line and by the node longitude about the ecliptic pole.
    const xo = r * Math.cos(argLat);
    const yo = r * Math.sin(argLat) * Math.cos(MOON_INCLINATION);
    const zo = r * Math.sin(argLat) * Math.sin(MOON_INCLINATION);

    const cn = Math.cos(node), sn = Math.sin(node);
    return {
        x: xo * cn - yo * sn,
        z: -(xo * sn + yo * cn),
        y: zo,
        r,
        phaseAngle: argLat + node,
    };
}

// Illuminated fraction of the Moon's disc as seen from Earth, 0 = new, 1 = full.
export function moonIllumination(moonVec, earthToSun) {
    // Angle at the Moon between the Sun and the Earth.
    const m = normalize(moonVec);
    const elong = Math.acos(clamp(-(m.x * earthToSun.x + m.y * earthToSun.y + m.z * earthToSun.z), -1, 1));
    return (1 - Math.cos(elong)) / 2;
}

// ---------------------------------------------------------------------------
// Local solar geometry
// ---------------------------------------------------------------------------

// Surface normal ("up") at a latitude/longitude, in the ecliptic frame, for an
// Earth tilted by `tiltDeg` and spun to `spinPhase` radians.
//
// `spinPhase` is measured so that at spinPhase = 0 the prime meridian faces
// ecliptic longitude 0.
export function surfaceNormal(latDeg, lonDeg, tiltDeg, spinPhase) {
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG + spinPhase;

    // Start in an Earth-fixed frame whose pole is +Y, then tilt about +X.
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.sin(lat);
    const z = -Math.cos(lat) * Math.sin(lon);

    // Rotate about -X so the pole lands exactly on spinAxis(tiltDeg) — the
    // same axis the declination formula is written against.
    const c = Math.cos(tiltDeg * DEG), s = Math.sin(tiltDeg * DEG);
    return { x, y: y * c + z * s, z: -y * s + z * c };
}

// Where on the surface the Sun is directly overhead, in Earth-fixed lat/lon.
// Found by rotating the Sun direction back out of the tilt and the spin — the
// exact inverse of surfaceNormal, so the two are guaranteed consistent.
export function subsolarPoint(tiltDeg, spinPhase, earthToSun) {
    const c = Math.cos(tiltDeg * DEG), s = Math.sin(tiltDeg * DEG);
    const x1 = earthToSun.x;
    const y1 = earthToSun.y * c - earthToSun.z * s;
    const z1 = earthToSun.y * s + earthToSun.z * c;

    const cp = Math.cos(spinPhase), sp = Math.sin(spinPhase);
    const x2 = x1 * cp - z1 * sp;
    const z2 = x1 * sp + z1 * cp;

    return {
        lat: Math.asin(clamp(y1, -1, 1)) * RAD,
        lon: Math.atan2(-z2, x2) * RAD,
    };
}

// Cosine of the solar zenith angle — the fraction of a flat surface's area
// presented to the Sun. Negative means the Sun is below the horizon.
export function cosZenith(normal, earthToSun) {
    return normal.x * earthToSun.x + normal.y * earthToSun.y + normal.z * earthToSun.z;
}

// Half-day length in radians of hour angle: how far before/after local noon the
// Sun is above the horizon. 0 = polar night, PI = polar day (Sun never sets).
export function sunriseHourAngle(latDeg, decRad) {
    const x = -Math.tan(latDeg * DEG) * Math.tan(decRad);
    if (x >= 1) return 0;          // Sun never rises
    if (x <= -1) return Math.PI;   // Sun never sets
    return Math.acos(x);
}

// Daily-mean insolation at the top of the atmosphere (W/m²). The standard
// closed-form integral of cos(zenith) over a day.
export function dailyInsolation(latDeg, day, tiltDeg) {
    const { sunLongitude, distance } = earthOrbit(day);
    const dec = declination(sunLongitude, tiltDeg);
    const H0 = sunriseHourAngle(latDeg, dec);
    const lat = latDeg * DEG;
    const flux = SOLAR_CONSTANT / (distance * distance);
    return (flux / Math.PI) * (
        H0 * Math.sin(lat) * Math.sin(dec) +
        Math.cos(lat) * Math.cos(dec) * Math.sin(H0)
    );
}

// Length of daylight in hours.
export function dayLength(latDeg, decRad) {
    return 24 * sunriseHourAngle(latDeg, decRad) / Math.PI;
}

// ---------------------------------------------------------------------------
// Temperature: a two-slab energy-balance model
// ---------------------------------------------------------------------------
//
// This is an idealised climate model, not a weather forecast. It is the
// simplest thing that gets the *physics of the tilt* right, which is the point
// of the simulation:
//
//   C dT/dt = (1-a) Q(t)  -  (A + B T)  -  k (T - T_global)
//              absorbed       outgoing      heat carried in or out by
//              sunlight       longwave      winds and ocean currents
//
// A and B linearise outgoing longwave radiation (Budyko/North: an Earth with
// this much greenhouse effect radiates A + B*T to space). The k term is the
// crucial one at high latitudes — without it, poles freeze far harder than the
// real ones do, because the real atmosphere hauls heat poleward.
//
// A second, much thinner slab is driven by the departure of the *instantaneous*
// sunlight from the daily mean. It carries the day/night cycle, and because it
// has a small heat capacity it peaks in mid-afternoon rather than at noon.

export const CLIMATE = {
    albedo: 0.30,       //           open water / vegetated land
    iceAlbedo: 0.62,    //           snow and sea ice reflect most of it back
    iceTemp: -4,        // °C        midpoint of the ice/no-ice transition
    iceWidth: 5,        // K         width of that transition
    meltHeat: 14,       //           latent-heat buffer near freezing, as a
                        //           multiple of the slab's heat capacity
    freezeFraction: 0.25,  //        how much of that buffer applies on cooling
    A: 205,             // W/m²      outgoing longwave at 0 °C
    B: 2.09,            // W/m²/K    how fast outgoing longwave grows with T
    k: 5.6,             // W/m²/K    strength of poleward heat transport
    seasonC: 0.90,      // W·yr/m²/K deep slab — sets the seasonal lag

    // The day/night skin is governed by turbulent exchange with the air
    // (convection, evaporation), which is far stiffer than radiation alone.
    // These two are calibrated rather than derived: together they reproduce a
    // ~11 K diurnal range peaking mid-afternoon at a mid-latitude land site.
    diurnalC: 0.0227,   // W·yr/m²/K
    diurnalK: 68,       // W/m²/K
};

// Surface albedo as a function of temperature — the ice-albedo feedback. A
// frozen surface reflects roughly twice as much sunlight as an unfrozen one,
// which is most of why cold places stay cold.
export function albedoAt(T) {
    const { albedo, iceAlbedo, iceTemp, iceWidth } = CLIMATE;
    const frozen = 0.5 * (1 - Math.tanh((T - iceTemp) / iceWidth));
    return albedo + (iceAlbedo - albedo) * frozen;
}

// Effective heat capacity, inflated near 0 °C.
//
// Melting ice absorbs an enormous amount of energy at a nearly fixed
// temperature, so a surface with ice on it stalls at freezing instead of
// warming through it. Smearing that latent heat over a few degrees is the
// standard apparent-heat-capacity trick, and it is what keeps polar summers
// near 0 °C instead of running to +25 °C as bare radiative balance would.
// `warming` selects the melting branch. Melting soaks up far more energy than
// re-freezing gives back over a season, because by mid-winter there is little
// liquid left to freeze — so the buffer is deliberately asymmetric. Without
// that, polar winters never get cold.
function effectiveCapacity(T, base, warming) {
    const near = Math.exp(-((T / 2.2) ** 2));
    const scale = warming ? CLIMATE.meltHeat : CLIMATE.meltHeat * CLIMATE.freezeFraction;
    return base * (1 + scale * near);
}

// Global-mean temperature the transport term relaxes toward.
function globalMeanTemperature(tiltDeg) {
    // Global mean absorbed sunlight is S0/4 regardless of tilt — tilt moves
    // sunlight around the planet, it does not change the total.
    const absorbed = (1 - CLIMATE.albedo) * SOLAR_CONSTANT / 4;
    return (absorbed - CLIMATE.A) / CLIMATE.B;
}

// Integrate the deep slab over a year, repeatedly, until the annual cycle
// stops changing — that periodic steady state is the climate.
//
// Returns an array of 365 daily-mean temperatures in °C, indexed by day-of-year.
export function annualTemperatureCurve(latDeg, tiltDeg) {
    const N = 365;
    const dt = 1 / N;                       // timestep, in years
    const Tg = globalMeanTemperature(tiltDeg);
    const { A, B, k, seasonC } = CLIMATE;

    // Precompute the year's sunlight; only the albedo applied to it varies.
    const Q = new Float64Array(N);
    for (let d = 0; d < N; d++) Q[d] = dailyInsolation(latDeg, d + 0.5, tiltDeg);

    let T = Tg;
    const curve = new Float64Array(N);
    // 20 years of spin-up: the melt buffer makes the approach to the periodic
    // steady state much slower than the bare slab's time constant.
    for (let year = 0; year < 20; year++) {
        for (let d = 0; d < N; d++) {
            const forcing = (1 - albedoAt(T)) * Q[d] - (A + B * T) - k * (T - Tg);
            T += (forcing / effectiveCapacity(T, seasonC, forcing > 0)) * dt;
            curve[d] = T;
        }
    }
    return curve;
}

// The diurnal swing, as a departure from the daily mean.
//
// Integrated over one day at 15-minute resolution, driven by how far the
// instantaneous sunlight departs from that day's average. Returns a function
// of hour-of-day (0-24) giving the anomaly in °C.
export function diurnalCycle(latDeg, day, tiltDeg, dayMeanT = 15) {
    const STEPS = 96;
    const dt = (1 / 365) / STEPS;           // timestep in years
    const { diurnalC, diurnalK } = CLIMATE;

    const { sunLongitude, distance } = earthOrbit(day);
    const dec = declination(sunLongitude, tiltDeg);
    const lat = latDeg * DEG;
    const flux = SOLAR_CONSTANT / (distance * distance);

    const mean = dailyInsolation(latDeg, day, tiltDeg);
    const inst = new Float64Array(STEPS);
    for (let i = 0; i < STEPS; i++) {
        // Hour angle: 0 at local solar noon, ±PI at midnight.
        const H = (i / STEPS) * 2 * Math.PI - Math.PI;
        const cz = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
        inst[i] = Math.max(0, cz) * flux;
    }

    // Spin up over several days to reach a repeating cycle.
    let dT = 0;
    const anomaly = new Float64Array(STEPS);
    for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < STEPS; i++) {
            const forcing = (1 - albedoAt(dayMeanT)) * (inst[i] - mean) - diurnalK * dT;
            dT += (forcing / diurnalC) * dt;
            anomaly[i] = dT;
        }
    }

    // Index 0 is midnight (hour angle -PI), so hour-of-day maps directly.
    return hour => {
        const f = ((hour / 24) * STEPS) % STEPS;
        const i = Math.floor(f), frac = f - i;
        const a = anomaly[i % STEPS], b = anomaly[(i + 1) % STEPS];
        return a + (b - a) * frac;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function wrapAngle(a) {
    const t = a % (2 * Math.PI);
    return t < 0 ? t + 2 * Math.PI : t;
}

export function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

export function normalize(v) {
    const m = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
}

// Day-of-year -> "12 Mar" style label.
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(day) {
    let d = Math.floor(((day % 365) + 365) % 365);
    for (let m = 0; m < 12; m++) {
        if (d < MONTH_DAYS[m]) return `${d + 1} ${MONTH_NAMES[m]}`;
        d -= MONTH_DAYS[m];
    }
    return '31 Dec';
}

export function monthStarts() {
    const out = [];
    let d = 0;
    for (let m = 0; m < 12; m++) { out.push({ day: d, name: MONTH_NAMES[m] }); d += MONTH_DAYS[m]; }
    return out;
}
