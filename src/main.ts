// main.ts
import "./style.css";

import { UI } from "@peasy-lib/peasy-ui";
import { Engine, DisplayMode, Actor, Color } from "excalibur";
import { model, template } from "./UI/UI";
import { NPC } from "./Actors/NPC";
import { Player } from "./Actors/Player";

await UI.create(document.body, model, template).attached;

const game = new Engine({
  width: 800, // the width of the canvas
  height: 600, // the height of the canvas
  canvasElementId: "cnv", // the DOM canvas element ID, if you are providing your own
  displayMode: DisplayMode.Fixed, // the display mode
  pixelArt: true,
});

await game.start();
export const player = new Player();
export const npc = new NPC(player);

game.add(npc);
game.add(player);
