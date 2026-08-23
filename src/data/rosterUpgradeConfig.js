// Copy for the stat-upgrade controls on the roster card. Player-facing prose lives in data/ and
// never in a component (house rule — see data/feedMessages.js, data/toastMessages.js and
// CAMP_SWAP_COPY in data/campProgramsConfig.js, which is the closest sibling: a handful of strings
// belonging to one control, kept out of the component that draws it).
//
// SEPARATE FROM data/balanceConfig.js ON PURPOSE. That file is the numbers a run is tuned with,
// read by half a dozen engines; this is wording read by exactly one component. They change for
// completely different reasons, which is the rule this repo splits config files on.
//
// ---------------------------------------------------------------------------------------------
// The disabled bulk chip, and why it says a price instead of nothing
// ---------------------------------------------------------------------------------------------
// components/roster/UpgradeButton.js renders the bulk-buy chip whenever a stat has two or more
// upgrades left before the cap, and disables it when the wallet cannot cover two. Its presence is
// therefore a fact about the STAT and never about the balance — which is what stops sixty rows
// re-laying out mid-click every time a purchase drops the balance past a threshold.
//
// A disabled control with no number on it would be the exact problem the MAX chip was introduced to
// avoid: a player looking at a greyed button and having to work out whether they are broke or done.
// So the disabled state carries the number that turns it back on.
//
// NOT THE WORD "MAX", in either string. The chip that means "this stat is at the ceiling" owns that
// word on the same row, and a second MAX meaning "spend everything" would put back the ambiguity
// those two controls were separated to remove.
const UPGRADE_COPY = {
  // Short enough to sit in an 88px chip beside a formatted price without wrapping.
  bulkSavingLabel: (cash) => `ALL AT ${cash}`,
  bulkSavingTitle: (cash, stat) =>
    `Two ${stat} upgrades at once costs ${cash} — this buys as many as you can afford once you have it`,
};

module.exports = { UPGRADE_COPY };
