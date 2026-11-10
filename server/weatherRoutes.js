// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// weatherRoutes.js - GET /api/weather?city=colombo for the Endless Voyage.
const express = require("express");
const { getWeather, listCities, DEFAULT_CITY } = require("./weather");

const router = express.Router();

router.get("/weather", async (req, res) => {
  const city = String(req.query.city || DEFAULT_CITY).toLowerCase();
  try {
    res.json(await getWeather(city));
  } catch (error) {
    console.error("Weather:", error.message);
    // The game still works: it simply sails in normal weather.
    res.status(502).json({ error: "The weather could not be read right now.", cities: listCities() });
  }
});

// GET /api/weather/cities - the places a captain can choose in Settings.
router.get("/weather/cities", (req, res) => {
  res.json({ cities: listCities(), defaultCity: DEFAULT_CITY });
});

module.exports = router;
