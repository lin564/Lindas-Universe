# Tilt — Earth, Sun & Moon

An orbital simulation of the Earth going round the Sun, with the Moon in
attendance, in which you can **change the Earth's axial tilt** and watch what
that does to the **temperature at a place on the surface**. It opens on
Chapel Hill, NC.

The tilt slider is the point of the thing. Almost everything we call climate at
a given latitude follows from one angle, and the fastest way to feel that is to
move the angle and watch a year of temperature bend in response.

## Using it

Serve the repo root with any static server and open `earth-orbit/`:

```sh
cd Lindas-Universe
python3 -m http.server 8000
# → http://localhost:8000/earth-orbit/
```

(Opening `index.html` over `file://` won't work — ES modules need HTTP.)

- **Orbit / Earth** switches between watching the whole system and standing off
  the planet. **Drag** to orbit the camera, **scroll** to zoom.
- **Axial tilt** — 0° to 90°, with presets for Earth, Mars, Saturn and Uranus.
  The tropics and polar circles on the globe move as you drag it, because they
  are *defined* by the tilt: tropics at ±tilt, polar circles at ±(90 − tilt).
- **Day of year** and **Speed** drive time. At slow speeds you watch the planet
  turn and the day/night terminator sweep over your location; at fast speeds
  you watch the seasons.
- **Place on the surface** — ten preset cities, or type any latitude/longitude.

## What's being computed

Everything on the right-hand panel comes from `js/astro.js`, which the 3D scene
and the readouts both read from, so the picture and the numbers cannot drift
apart.

**Orbits.** The Earth's orbit is a real Kepler ellipse (e = 0.0167) solved by
Newton iteration, with perihelion on 3 January — so the Earth genuinely moves
faster in northern winter, and the Sun is 3.4% closer. Rotation runs on the
sidereal day (23h 56m), which is what makes the solar day come out to 24h:
the planet has to turn slightly more than once to bring the Sun back to the
meridian. The simulation counts 365 solar days per year, not 366.

**The Moon** orbits on its own ellipse (e = 0.055) inclined 5.14° to the
**ecliptic**, with the node regressing over 18.6 years, and is tidally locked so
the same face stays Earthward. Because that inclination is referred to the
ecliptic rather than to the equator, **changing the Earth's tilt does not tilt
the Moon's orbit** — which is correct, and visible if you look for it.

**Solar geometry.** Declination, sub-solar point, solar elevation, day length
and top-of-atmosphere insolation are derived from vectors built out of the same
tilt and spin used to orient the globe. Spot checks against published values:

| | model | published |
|---|---|---|
| Daily insolation, 35.9°N, June solstice | 481 W/m² | ~480 |
| Daily insolation, 35.9°N, December solstice | 185 W/m² | ~186 |
| Annual mean insolation, equator | 416 W/m² | ~416 |
| Annual mean insolation, North Pole | 173 W/m² | ~173 |
| Daylight at Chapel Hill, June solstice | 14.44 h | 14.6 |

(The daylight figure is geometric — it excludes atmospheric refraction and the
width of the solar disc, which together add roughly ten minutes.)

## The temperature model

This is the part to be honest about. Temperature comes from a **two-slab
energy-balance model**, not from any kind of forecast:

```
C dT/dt  =  (1−α)Q(t)  −  (A + B·T)  −  k(T − T_global)
             absorbed      outgoing        heat carried in or out
             sunlight      longwave        by winds and currents
```

`A + B·T` is the standard Budyko/North linearisation of outgoing longwave
radiation. The `k` term matters more than it looks: without poleward heat
transport, high latitudes freeze far harder than the real ones do. A deep slab
carries the seasonal cycle (and its ~1 month lag behind the solstice); a thin
surface skin, coupled to the air far more stiffly, carries the day/night cycle
and peaks in mid-afternoon rather than at noon.

Two further pieces stop it from being nonsense at the poles. **Ice-albedo
feedback**: a frozen surface reflects roughly twice as much sunlight, so cold
places stay cold. And a **latent-heat buffer near 0 °C**: melting ice absorbs a
huge amount of energy at almost constant temperature, which is why a polar
summer stalls near freezing instead of running to +25 °C as bare radiative
balance would. The buffer is asymmetric — melting soaks up much more than
re-freezing gives back — because otherwise polar winters never get cold.

Parameters were calibrated so that present-day Chapel Hill lands on its real
climate:

| | model | observed |
|---|---|---|
| Annual mean | 16.2 °C | ~15.5 |
| Warmest day | 26.5 °C, 28 Jul | ~26.5, late Jul |
| Coldest day | 4.7 °C, 25 Jan | ~5.0, mid Jan |
| July high / low | 32.7 / 21.8 °C | ~32 / 21 |
| Diurnal range, July | 11.1 K | ~11 |

### Where it is wrong, and why

The model is one column of atmosphere over one latitude. It has no oceans that
move heat sideways, no clouds, no mountains, and no distinction between the
middle of a continent and the middle of the sea. So:

| | model | observed | why |
|---|---|---|---|
| Svalbard (78°N) | −5.3 / 2.0 / −14.1 | −5.9 / 7 / −15 | good |
| Reykjavík (64°N) | −2.6 / 3.5 / −10.9 | 5.1 / 11.5 / 0 | no Gulf Stream |
| Singapore (1°N) | 22.7 / 24.0 / 21.3 | 27.5 / 28.3 / 26.5 | transport term over-cools the tropics |
| McMurdo (78°S) | −5.4 / 2.3 / −14.2 | −17 / −3 / −27 | no 2 km ice sheet, no polar vortex |

(mean / warmest / coldest, °C.) A zonally symmetric model cannot produce a
Gulf Stream, so Reykjavík will always come out as cold as Anchorage. Elevation
is not modelled either — that is why the preset list uses Belém rather than
Quito, which sits 2,850 m up and runs about 9 °C cooler than this model thinks.

None of that affects what the simulation is for. **How a place's temperature
responds to the tilt** is governed by the orbital geometry, which is exact
here, and by the seasonal heat capacity, which is calibrated. Read the absolute
numbers as approximate outside the mid-latitudes; read the *response* to the
slider as real.

## Things worth trying

- **Set the tilt to 0°.** The seasons vanish. Chapel Hill's year flattens to a
  1.7 °C spread — and what remains is the eccentricity, not the tilt.
- **Set it to 82° (Uranus).** Chapel Hill ends up inside *both* the tropics and
  the polar circle: the Sun passes overhead twice a year and also fails to rise
  for months. The dashed line on the chart is today's Earth, for comparison.
- **Cross 54°.** Past roughly there the poles collect more sunlight over a year
  than the equator does, and the readout says so.
- **Compare Belém with Longyearbyen** at any tilt — the tilt does almost
  nothing at the equator and almost everything at 78°N.
- **Slow the speed right down** in Earth view and watch the terminator cross
  your marker while the temperature turns over.

## Stack

Plain ES modules, no build step. Three.js (vendored, the same copy as
`research-universe` and `games/balance-keeper`). No external assets and no
network calls: the Earth, its city lights and the Moon are all drawn onto
canvases at load time from a coarse set of hand-simplified coastlines, and the
day/night terminator is a small custom shader.

```
earth-orbit/
├── index.html
├── css/style.css
├── js/
│   ├── astro.js     orbital mechanics, solar geometry, climate model
│   ├── scene.js     Three.js scene, Earth shader, per-frame placement
│   ├── texture.js   procedurally drawn Earth and Moon maps
│   ├── chart.js     the annual temperature plot
│   └── main.js      controls, camera, readouts, loop
└── vendor/          Three.js r160
```
