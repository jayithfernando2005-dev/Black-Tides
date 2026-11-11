// saveFile.js - Settings: download your progress as a save file, or load one back.
// The server signs the file, so an edited file is refused (see server/saveRoutes.js).
import * as api from "./api.js";
import { emit } from "./events.js";

const $ = (id) => document.getElementById(id);

$("save-file").addEventListener("change", async () => {
  const file = $("save-file").files[0];
  $("save-file").value = "";
  if (!file) return;
  const say = (text) => { $("save-message").textContent = text; };
  if (file.size > 50000) {
    say("That file is too big to be a Black Tides save.");
    return;
  }
  let save;
  try {
    save = JSON.parse(await file.text());
  } catch (error) {
    say("That file is not a save file (it is not JSON).");
    return;
  }
  try {
    const result = await api.importSave(save);
    say("Save loaded (from " + new Date(result.from).toLocaleDateString() + "): " + result.progress.gold + " gold, campaign stage " + Math.min(9, result.campaign) + ".");
    emit("save:loaded", result);
  } catch (error) {
    say(error.message);
  }
});
