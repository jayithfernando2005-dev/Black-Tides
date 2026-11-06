// fishApi.js - talks to the lecturer's Fish Game API.
// This is the only file in the project that knows the API's address.

const FISH_API_URL = "https://marcconrad.com/uob/fish/api.php";

// Asks the Fish API for a new puzzle.
// Returns { image, fish, chest }: the picture link and its two answers.
async function getFishPuzzle() {
  const response = await fetch(FISH_API_URL);          // an HTTP GET request
  if (!response.ok) {
    throw new Error("Fish API answered with status " + response.status);
  }
  const data = await response.json();                  // { question, fish, chest }
  return {
    image: data.question,
    fish: Number(data.fish),
    chest: Number(data.chest)
  };
}

module.exports = { getFishPuzzle };
