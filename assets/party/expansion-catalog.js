/* Original festival challenges. Rules are enforced by the party server. */
(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.PartyExpansionCatalog = value;
})(globalThis, () =>
  [
    {
      id: "basket",
      name: "Midway Hoops",
      tag: "MOVING HOOPS",
      color: "#f3b16d",
      description: "Read the swing. Sink the shot.",
      rules:
        "The hoop swings from side to side. Release when it will cross the center shooting line as your ball arrives. Clean baskets score 300; perfect swishes score 500. Rim hits bounce out. You can shoot again once the ball returns.",
      controls: [["shoot", "Shoot"]],
      duration: 45000,
    },
    {
      id: "band",
      name: "Boardwalk Band",
      tag: "FOUR-PIECE RHYTHM",
      color: "#c6a3ef",
      description: "One song. Four instruments. Find your groove.",
      rules:
        "Press 1–4, D F J K, or the four colored pads as notes reach the line. Everyone plays the same chart with their own instrument. Perfect notes score 150, good notes 80; streaks add a bonus. Wrong notes break your streak. Watch the whole band react!",
      controls: [
        [0, "D · Blue"],
        [1, "F · Pink"],
        [2, "J · Mint"],
        [3, "K · Gold"],
      ],
      duration: 45000,
    },
    {
      id: "bumper",
      name: "Bumper Bluff",
      tag: "MOMENTUM + SURVIVAL",
      color: "#ed9baf",
      description: "Build speed. Hold your ground.",
      rules:
        "Drag on the arena to steer, or hold the arrow keys / WASD. Your car accelerates toward that direction; release to coast and brake. Fast collisions push both cars. Avoid the two holes and the open cliff edge. Last car on the platform wins.",
      controls: [],
      drag: true,
      duration: 60000,
    },
    {
      id: "volcano",
      name: "Cinder Sprint",
      tag: "DRAG + DODGE",
      color: "#f1a282",
      description: "Read the shadows. Keep moving.",
      rules:
        "Drag to move, or use the arrow keys / WASD. Growing shadows show where lava rocks will land. Stay outside them when they flash. A hit knocks you out. The eruption gets faster; last survivor wins.",
      controls: [],
      drag: true,
      duration: 50000,
    },
    {
      id: "baseball",
      name: "Sunset Sluggers",
      tag: "BATTING TIMING",
      color: "#9acdab",
      description: "Fastball, curve, or change-up?",
      rules:
        "Swing as the ball reaches the plate. Perfect contact scores 500; other fair hits score 200. Early and late swings miss. Twelve pitches mix fastballs, curves, and slower change-ups. Watch the ball, not a fixed rhythm.",
      controls: [["swing", "Swing!"]],
      duration: 48000,
    },
    {
      id: "math",
      name: "Professor Poppy’s Pop Quiz",
      tag: "QUICK THINKING",
      color: "#e6c275",
      description: "Five questions. Think fast.",
      rules:
        "Choose one of four answers to the teacher’s arithmetic card. Each question lasts 10 seconds, followed by 3 seconds to reveal points. Correct answers earn 100–500 points: faster is better. One answer per question; five questions decide the class champion.",
      controls: [
        [0, "1"],
        [1, "2"],
        [2, "3"],
        [3, "4"],
      ],
      duration: 65000,
    },
    {
      id: "puzzle",
      name: "Postcard Shuffle",
      tag: "SLIDING PUZZLE",
      color: "#83c9ce",
      description: "Slide the festival back together.",
      rules:
        "Tap a tile next to the empty square to slide it. Arrange 1–8 in reading order, leaving the bottom-right square empty. Everyone gets the same solvable puzzle and 60 seconds. Earlier completions score more; unfinished boards score for correctly placed tiles.",
      controls: [],
      duration: 60000,
    },
    {
      id: "safe-panel",
      name: "Poppy’s Pit Crew",
      tag: "TOOL MATCHING",
      color: "#9ccbd5",
      description: "Right tool. Quick turn.",
      rules:
        "Choose a screwdriver, then tap a matching screw. Open three panels, eight screws each. A wrong tool strips that screw: it then takes three correct turns to remove. Finish all three panels within 90 seconds; faster finishes score more.",
      controls: [],
      duration: 90000,
    },
    {
      id: "safe-wires",
      name: "Crossed Wires",
      tag: "MEMORY + COLOR WORDS",
      color: "#e5a3c0",
      description: "Read the word. Remember the order.",
      rules:
        "Open the note and remember the COLOR WORDS in order, ignoring their ink colors. Close it before cutting wires. A wrong cut stays cut and adds a fault; skip that color later. Five faults end your game. Complete two ten-wire panels in 90 seconds. You may reopen the note.",
      controls: [],
      duration: 90000,
    },
    {
      id: "safe-dial",
      name: "Tumbler Trouble",
      tag: "WARM + COLD",
      color: "#c4afe5",
      description: "Listen for the click. Crack six locks.",
      rules:
        "Choose a digit on the 0–9 dial and check it. Green opens the lock, yellow is one click away, orange two or three, red four or five. Distance wraps around from 9 to 0. Solve six different digits in 90 seconds; your previous guesses stay visible for the current lock.",
      controls: [],
      duration: 90000,
    },
  ].map((g) => ({ ...g, engine: "expansion", unit: "points" })),
);
