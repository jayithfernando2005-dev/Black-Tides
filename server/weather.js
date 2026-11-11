// weather.js - real weather for the Endless Voyage, from the free Open-Meteo API
// (https://open-meteo.com, no key needed). A thunderstorm in the real city brings a
// storm to the battle, fog brings fog, strong wind pushes the ship harder.
// This is the game's second outside API, next to the Fish API.

// Only these places can be asked for, so the browser can never make the server
// fetch any address it likes.
const CITIES = {
  colombo: { name: "Colombo", latitude: 6.93, longitude: 79.85 },
  kandy: { name: "Kandy", latitude: 7.29, longitude: 80.63 },
  galle: { name: "Galle", latitude: 6.03, longitude: 80.22 },
  jaffna: { name: "Jaffna", latitude: 9.66, longitude: 80.01 },
  trincomalee: { name: "Trincomalee", latitude: 8.59, longitude: 81.21 },
  luton: { name: "Luton (Bedfordshire)", latitude: 51.88, longitude: -0.42 },
  london: { name: "London", latitude: 51.51, longitude: -0.13 }
};
const DEFAULT_CITY = "colombo";
const CACHE_MINUTES = 10;            // the weather is asked for at most every 10 minutes per city

// The address can be changed with WEATHER_API_URL, so the automated tests can use a pretend service.
function weatherUrl() {
  return process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast";
}

// Turns Open-Meteo's weather code (WMO code) and wind speed into game effects.
// A pure function, so the automated tests can check it without the internet.
function weatherEffects(code, windKmh) {
  let label = "Clear skies";
  let storm = false;
  let fog = false;
  let rain = false;
  if (code === 1 || code === 2) label = "Partly cloudy";
  else if (code === 3) label = "Overcast";
  else if (code === 45 || code === 48) { label = "Fog"; fog = true; }
  else if (code >= 51 && code <= 57) { label = "Drizzle"; rain = true; }
  else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) { label = "Rain"; rain = true; }
  else if (code >= 71 && code <= 77) label = "Snow";
  else if (code === 85 || code === 86) label = "Snow showers";
  else if (code >= 95) { label = "Thunderstorm"; storm = true; rain = true; }

  const windy = windKmh >= 30;
  if (windy && !storm) label += ", strong wind";
  // How hard the wind pushes the ship: 1 = a normal storm, up to 1.8 in a gale.
  const windPush = Math.min(1.8, Math.max(1, windKmh / 30));
  return {
    label: label,
    storm: storm ? "always" : rain || windy ? "often" : "normal",
    fog: fog,
    windPush: Math.round(windPush * 100) / 100
  };
}

const cache = new Map();             // city key -> { at, report }

// Returns the weather report for a city key, from the cache or from Open-Meteo.
async function getWeather(cityKey) {
  const key = CITIES[cityKey] ? cityKey : DEFAULT_CITY;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MINUTES * 60 * 1000) {
    return cached.report;
  }
  const city = CITIES[key];
  const url = weatherUrl() + "?latitude=" + city.latitude + "&longitude=" + city.longitude +
    "&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto";
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error("Open-Meteo answered with status " + response.status);
  }
  const data = await response.json();
  const now = data.current || {};
  const code = Number(now.weather_code);
  const wind = Number(now.wind_speed_10m);
  if (!Number.isFinite(code) || !Number.isFinite(wind)) {
    throw new Error("Open-Meteo sent weather the game cannot read.");
  }
  const report = {
    city: key,
    cityName: city.name,
    temperature: Math.round(Number(now.temperature_2m)),
    wind: Math.round(wind),
    code: code,
    night: now.is_day === 0,
    ...weatherEffects(code, wind)
  };
  cache.set(key, { at: Date.now(), report: report });
  return report;
}

function listCities() {
  return Object.entries(CITIES).map(([key, city]) => ({ key: key, name: city.name }));
}

module.exports = { CITIES, DEFAULT_CITY, weatherEffects, getWeather, listCities };
