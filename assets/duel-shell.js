(function xanDuelsShell() {
  "use strict";
  const listedModes = new Set(["roulette", "fishing", "safecracker", "blackjackduel"]);
  const select = document.getElementById("duelModeSelect");
  function updateModeList() {
    if (!select) return;
    for (const option of select.options) {
      option.hidden = !listedModes.has(option.value);
      option.disabled = option.hidden;
      if (option.value === "fishing") option.textContent = "Fishing Duel";
    }
    if (!listedModes.has(select.value)) select.value = "fishing";
  }
  updateModeList();
  // A legacy bootstrap may register a mode later; registration is preserved.
  if (select) new MutationObserver(updateModeList).observe(select, {childList: true});

  const wager = document.getElementById("duelWagerInput");
  const steps = [...document.querySelectorAll("[data-wager-step]")];
  function updateSteps() {
    const value = Number(wager?.value || wager?.min || 1000);
    for (const button of steps) button.disabled = !wager || wager.disabled ||
      (Number(button.dataset.wagerStep) < 0 && value <= Number(wager.min || 1000)) ||
      (Number(button.dataset.wagerStep) > 0 && wager.max !== "" && value >= Number(wager.max));
  }
  for (const button of steps) button.addEventListener("click", () => {
    if (!wager || wager.disabled) return;
    if (!Number.isFinite(wager.valueAsNumber)) wager.value = wager.min || "1000";
    if (Number(button.dataset.wagerStep) > 0) wager.stepUp(); else wager.stepDown();
    wager.dispatchEvent(new Event("input", {bubbles: true}));
    wager.dispatchEvent(new Event("change", {bubbles: true}));
    updateSteps();
  });
  wager?.addEventListener("input", updateSteps);
  wager?.addEventListener("change", updateSteps);
  if (wager) new MutationObserver(updateSteps).observe(wager, {attributes: true, attributeFilter: ["min", "max", "disabled"]});
  updateSteps();

  // Currency is a display label only. Escrow, account fields, and protected
  // Roulette rendering/logic remain unchanged.
  const active = document.getElementById("duelActive");
  function updateLegacyCurrencyLabel() {
    active?.querySelectorAll(".rr-pot small").forEach(label => {
      if (label.textContent === "Tickets") label.textContent = "Chips";
    });
  }
  if (active) new MutationObserver(updateLegacyCurrencyLabel).observe(active, {childList: true, subtree: true});
  updateLegacyCurrencyLabel();
})();
