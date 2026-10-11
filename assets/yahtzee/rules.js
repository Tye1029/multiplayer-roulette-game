/* YAHTZEE_ONLINE_V1_20261011 — shared, deterministic scoring. */
(function(root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.YahtzeeRules = rules;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const categories = [
    ['ones', 'Ones', 'Add all ones'], ['twos', 'Twos', 'Add all twos'],
    ['threes', 'Threes', 'Add all threes'], ['fours', 'Fours', 'Add all fours'],
    ['fives', 'Fives', 'Add all fives'], ['sixes', 'Sixes', 'Add all sixes'],
    ['three', 'Three of a kind', '3 matching · total of all dice'],
    ['four', 'Four of a kind', '4 matching · total of all dice'],
    ['house', 'Full house', 'A pair + a trio · 25 points'],
    ['small', 'Small straight', '4 in a row · 30 points'],
    ['large', 'Large straight', '5 in a row · 40 points'],
    ['yahtzee', 'Yahtzee', 'All 5 matching · 50 points'],
    ['chance', 'Chance', 'Anything goes · total of all dice']
  ];
  const keys = categories.map(c => c[0]);
  function score(dice, key, joker = false) {
    if (dice.length !== 5 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) return 0;
    const counts = Array(7).fill(0); dice.forEach(n => counts[n]++);
    const sum = dice.reduce((a, b) => a + b, 0), upper = keys.indexOf(key);
    if (upper >= 0 && upper < 6) return counts[upper + 1] * (upper + 1);
    const run = length => [1, 2, 3].some(start => Array.from({length}, (_, i) => start + i).every(n => counts[n]));
    switch (key) {
      case 'three': return Math.max(...counts) >= 3 ? sum : 0;
      case 'four': return Math.max(...counts) >= 4 ? sum : 0;
      case 'house': return joker || (counts.includes(2) && counts.includes(3)) ? 25 : 0;
      case 'small': return joker || run(4) ? 30 : 0;
      case 'large': return joker || run(5) ? 40 : 0;
      case 'yahtzee': return counts.includes(5) ? 50 : 0;
      case 'chance': return sum;
      default: return 0;
    }
  }
  function options(dice, card) {
    let available = keys.filter(k => card[k] == null);
    const repeat = score(dice, 'yahtzee') === 50 && card.yahtzee != null;
    if (repeat) {
      const upper = keys[dice[0] - 1];
      if (card[upper] == null) available = [upper];
      else { const lower = available.filter(k => keys.indexOf(k) >= 6); if (lower.length) available = lower; }
    }
    return Object.fromEntries(available.map(k => [k, score(dice, k, repeat)]));
  }
  function totals(player) {
    const upper = keys.slice(0, 6).reduce((n, k) => n + (player.card[k] || 0), 0);
    const bonus = upper >= 63 ? 35 : 0;
    return {upper, bonus, total: Object.values(player.card).reduce((a,b) => a+b, 0) + bonus + player.bonus};
  }
  return {categories, keys, score, options, totals};
});
