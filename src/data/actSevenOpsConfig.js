// The Ops panel's prose (PRD §6.4) — the standing directive, and every word of furniture the
// terminal wears.
//
// WHY THIS IS A SEPARATE FILE FROM data/actSevenPanels.js. That file is the TAB BAR: seven ids,
// seven labels, and the placeholder line each panel shows while it is unbuilt. This is one panel's
// CONTENT. They change for different reasons — a tab reorder touches that file and never this one,
// and a rewrite of the act's objectives touches this one and never that — and the `ops` row over
// there keeps its `blurb` for the same reason the `board` row does: the field is part of that
// list's shape, and it is what a reader of the tab list expects to find.
//
// EVERY STRING THE PANEL RENDERS IS HERE. That is `conventions.md`'s rule and not a stylistic
// preference: a sentence typed into a component is a sentence that cannot be found by whoever is
// rewriting the act's voice, and Act VII's voice is the act's entire content.

// ---------------------------------------------------------------------------------------------
// THE STANDING DIRECTIVE — one per phase, keyed by `expedition.phase`.
//
// VOICE: the Office, in the register data/actSevenContractsConfig.js fixes — administrative,
// unhurried, and entirely uninterested in whether you succeed. A directive is not encouragement and
// it is not a tutorial hint. It is the line at the top of a work order: what this site is currently
// for. The player is told the objective and pointedly not told how to reach it.
//
// AN ENTRY FOR EVERY PHASE IN EXPEDITION_PHASES, INCLUDING `majors`, AND THE LAST ONE IS THE ONE
// THAT WOULD HAVE BEEN FORGOTTEN. STORY-032 shipped the post-game: the act does not end when it is
// won, `seasonFrozen` stays set, the colony keeps solving and `ops` stays open — so `majors` is a
// phase the player can sit in indefinitely, staring at this panel. A missing key there would render
// the directive line blank on the ONE screen a finished run spends the most time on, and nothing in
// `npm run build` would notice. getDirective() returns null rather than a default for an
// unrecognized id, and the panel omits the block; see the note there.
//
// `phase` IS THE DISPLAY NAME FOR THE PILL, AND IT IS DELIBERATELY A SECOND TABLE FROM THE ONE IN
// components/layout/HeaderStats.js. That file states the argument for keeping its own —
// "they are the header's own vocabulary for a state, not prose the narrative owns" — and it is
// right: the header names a state in a chip that also says "Era" in six other acts, whereas this
// names the period the Office has filed these orders under. They agree today and they are allowed
// to stop agreeing. What must NOT be duplicated is the COLOUR, which is why the pill's `{ bg, ink }`
// is read from data/actSevenPalette.js by both surfaces through the same accessor.
//
// A SIXTH PHASE WOULD NEED A ROW HERE. It would also need one in actSevenPalette.js and one in
// HeaderStats.js, and none of the three is caught by the build — which is why EXPEDITION_PHASES is
// the single ordered list all of them are keyed by, and why the verification for this story walks
// it rather than spot-checking.
// ---------------------------------------------------------------------------------------------
const ACT_SEVEN_DIRECTIVES = {
  // The act's first 20-30 minutes, and the only tab open. Everything the player can do is the
  // Salvage click, which AppShell renders outside the tab switch entirely — so this line has to
  // carry the whole screen. It echoes the act intro's objective ("Bring the site back online")
  // rather than restating it, because the intro card is read once and this is read for half an
  // hour.
  aftermath: {
    phase: 'Aftermath',
    directive:
      'Bring the site back online. There is a generator design in the fabrication index and '
      + 'sufficient wreckage within walking distance to build it. The Office does not require a '
      + 'schedule for this.',
    // Names the one non-zero row a brand new save actually shows, because a note claiming
    // "everything reads zero" would be contradicted by the panel three lines under it: Home Plate
    // is colonized from the first second and its 2.0 O2/s is free atmosphere that takes neither
    // throttle. Measured, not assumed — see the note over `pinned` in engine/colonyReadout.js.
    note: 'Home Plate still makes its own air. Every other line reads zero until you build something.',
  },
  // The first generator is up, which is what this phase is defined by. The interlock — Power buys
  // Provisions and Provisions buy Power — becomes the whole game here, so the directive names the
  // two buses rather than the destination.
  lifeSupport: {
    phase: 'Life Support',
    directive:
      'Hold the site indefinitely. Power and Provisions each buy the other; the Office regards a '
      + 'network that cannot survive being left alone overnight as not yet a network. Then build '
      + 'something that can hold fuel, and leave.',
    note: 'A ration under 100% means the colony asked for more than it made.',
  },
  // The Moon. Reached, not necessarily colonized — the phase is granted on arrival, and paying to
  // keep a colony there is a separate decision with a running cost, which is exactly what the
  // upkeep line in the net rates is about.
  lunar: {
    phase: 'Lunar',
    directive:
      'You are off the affiliate. Colonize what you can afford to keep alive and no more — every '
      + 'site you light draws life support forever, and the Office has seen a great many networks '
      + 'lost to a base nobody was using.',
    note: 'Upkeep is charged against the same buses your modules draw from.',
  },
  // The last leg. Second Base's commit is what grants this phase, so by the time the player reads
  // this line the burn that matters is the one still ahead of them.
  deepSpace: {
    phase: 'Deep Space',
    directive:
      'One crossing remains and it is the long one. Fill the tank past the threshold and commit; '
      + 'the Office notes that overshoot is not wasted and undershoot is not survivable.',
    note: 'Fuel is the only rate on this screen that still matters.',
  },
  // THE POST-GAME. The act is won and does not end. There is nothing left to reach, so the
  // directive stops giving orders — which is the point of it: the Office has no further
  // assignments specific to you, and says so in the same flat voice it used to send you away.
  majors: {
    phase: 'The Majors',
    directive:
      'The crossing is complete and the file is closed. The network is yours to run; the Office '
      + 'will continue to accept standing orders and will continue not to comment on them.',
    note: 'Nothing on this screen is waiting for you any more.',
  },
};

// ---------------------------------------------------------------------------------------------
// THE NEXT STEP — one concrete thing to do, and where to do it.
// ---------------------------------------------------------------------------------------------
// The directives above are the Office talking, and the Office does not give instructions; it files
// orders and expects you to work it out. That voice is correct and it is kept — but it is not
// enough on its own, which was reported plainly: "I can't do anything right after the call up. I
// can sift the wreck but it's not clear what's next."
//
// Half of that was a real deadlock (the fabrication tab was gated behind a phase only a purchase
// inside it could reach — see the note in data/acts.js). The other half is this: a player who has
// just been handed six new nouns needs one sentence saying which button, on which tab, moves the
// act forward. So the terminal answers in its OWN voice, underneath the directive, the way a status
// line does — which is also why it is not written as more prose from the Office.
//
// `action` is the button or purchase. `where` is the tab it is on, named exactly as
// data/actSevenPanels.js labels it — a hint pointing at a tab that does not exist yet would be
// worse than no hint, so every entry here names a tab that is unlocked in its own phase (checked in
// verification against getUnlockedFeatures, since nothing else would catch it).
//
// `majors` has no next step and says so: the act is won, and inventing an objective for the
// post-game would be the one thing the ending is careful not to do.
const ACT_SEVEN_NEXT_STEPS = {
  aftermath: {
    action: 'Sift the wreck for Salvage, then build your first module.',
    where: 'Fab',
  },
  lifeSupport: {
    action: 'Get every bus to a net you can leave alone, then build a fuel tank and launch.',
    where: 'Fab',
  },
  lunar: {
    action: 'Colonize what the buses can carry, and build toward the next burn.',
    where: 'Sites',
  },
  deepSpace: {
    action: 'Fill the tank past the threshold, then commit the burn.',
    where: 'Launch',
  },
  majors: null,
};

const nextStepCopy = {
  heading: 'Next',
  // The tab hint. A sentence fragment rather than "Go to the Fab tab", because it sits beside the
  // tab bar that already has the word on it.
  where: (tab) => `on ${tab}`,
  // The progress line, shown only when the next step has a price the engine can put a number on.
  // "have / need", in that order, because the question being asked is "how far off am I".
  progress: (have, need, currency) => `${have} / ${need} ${currency}`,
  // What the number is for. Names the thing being saved for, so a bare pair of numbers is never on
  // screen without a subject.
  progressFor: (name) => `toward ${name}`,
  // When the cheapest thing on the shop is already affordable. The progress bar would read 100% and
  // say nothing, so it says the thing worth saying instead.
  affordable: (name) => `You can afford the ${name} now.`,
};

// Returns the next step for a phase, or null — both for an unrecognized id and for `majors`, which
// legitimately has none. The panel omits the block either way, so the two cases need not be
// distinguished here; see getDirective() below for the argument about not inventing a default.
function getNextStep(phaseId) {
  return ACT_SEVEN_NEXT_STEPS[phaseId] || null;
}

// Returns the directive for a phase, or null when the id is unrecognized.
//
// NULL RATHER THAN A DEFAULT LINE, matching getPhasePill() in data/actSevenPalette.js exactly —
// and for its reason, which applies verbatim here. `expedition.phase` is self-healing: engine/
// sites.js recomputes it from a predicate ladder every tick and writes only on a difference, so a
// corrupt id is one tick from repair. A fallback directive would put words in the Office's mouth
// about a phase that does not exist; omitting the block for that one tick says nothing, which is
// the truthful thing to say. The panel is built to render without it.
function getDirective(phaseId) {
  return ACT_SEVEN_DIRECTIVES[phaseId] || null;
}

// ---------------------------------------------------------------------------------------------
// THE PANEL'S FURNITURE.
//
// Headings, labels and the two sentences that explain the pin. Flatter than the directives above on
// purpose: the directive is the Office talking, and these are the terminal's own labels — the same
// separation data/actSevenPanels.js draws when it says its placeholder note "is deliberately not
// written in the act's voice".
// ---------------------------------------------------------------------------------------------
const opsCopy = {
  title: 'Ops',
  subtitle: 'The frequency is open. Everything below is measured, not estimated.',

  ratesTitle: 'Net rates',
  // Under the rates table. States the one thing about this screen a player cannot infer from it:
  // that these are NET figures out of a single solve, so a rate of zero beside a working generator
  // is not a bug.
  ratesNote: 'Production less draw, per second, after rationing. One solve, every line.',

  // The two throttles. Named as the two different things they are — see the note over
  // opsReadout() in engine/colonyReadout.js — because "efficiency" would cover both and describe
  // neither.
  rationLabel: 'Ration',
  rationHelp: 'How much of what the colony asked for it could actually supply. The tightest bus sets it.',
  throttleLabel: 'Supply throttle',
  // Deliberately does NOT promise that nothing is wasted. Modules that back off really do waste
  // nothing, but a full tank fed by SITE production is venting the surplus — Home Plate's 2.0 O2/s
  // takes no throttle — and this label sits directly above the row that says so.
  throttleHelp: 'How far producers backed off because a tank is already full.',
  salvageLabel: 'Salvage',
  salvageHelp: 'Recovered per second, at the ration above. The header reads the same solve.',
  // Salvage's tile does not name a tightest bus of its own, and that is the honest thing rather
  // than the lazy one: engine/colony.js throttles each drone by the minimum satisfaction among ITS
  // OWN inputs, which is not necessarily the network's worst bus. "After rationing" is exactly what
  // is being claimed and no more.
  salvageDetail: 'after rationing',

  // What the tightest bus is called when nothing is tight. Both throttles read 1 with no resource
  // id attached for a colony under no pressure, and "—" is the honest label for a constraint that
  // does not exist. Naming a resource anyway would invent a bottleneck.
  tightestNone: 'unconstrained',
  tightestOn: (label) => 'set by ' + label,

  directiveTitle: 'Standing directive',

  // The runway, shown only on rows engine/colonyReadout.js has already flagged `warning` — its
  // threshold is 90 seconds and it is derived (the measured time to afford the relieving purchase),
  // so the sentence is only ever shown while the player can still act on it.
  emptiesIn: (duration) => 'empties in ' + duration,

  // THE PIN, IN WORDS. `--v7-alert` says something is clamped; these say which end and what it
  // means, because the two ends are opposite problems wearing the same colour and a player who
  // reads "0/s" in red on a full tank should not think their farm has failed.
  //
  // Keyed by the engine's own `pinned` values so the panel does no mapping — a component choosing
  // between two sentences on `pinned === 'empty'` is a component deciding which state this is, and
  // the engine already decided.
  pinNote: {
    empty: 'Empty and held there. The draw is unmet, so the rate is clamped to zero rather than run negative — nothing was destroyed and nothing was removed. It lifts when you build.',
    capacity: 'Full. Producers have backed off to match draw and the remainder is being discarded; more storage would keep it.',
  },
  // The short badge beside the rate, where the sentence above will not fit. Same keys, same source.
  pinBadge: {
    empty: 'pinned empty',
    capacity: 'pinned full',
  },

  // THE FULL TANK THE CAPACITY PIN DOES NOT COVER. A bus filled by MODULES never trips
  // `pinned = 'capacity'`: load-follow throttles its producers until the surplus is exactly zero,
  // so the pin branch in engine/colony.js never fires and the row used to render nothing — a rate
  // of 0/s beside a bar at 100%, which reads as a colony at rest rather than as a colony whose
  // generation is being thrown away. The rate now shows what is being made; this says where it is
  // going, which is nowhere.
  //
  // Worded as the FIX rather than as the fault, because unlike the empty pin this is not a crisis:
  // a full tank is a colony that outgrew its storage, and the answer is a purchase the player can
  // already afford more often than not.
  // NO TANK AT ALL, which is a different sentence from a full one and needed its own. The vent note
  // below tells a player their surplus is overflowing and to build storage; this tells a player
  // whose capacity is ZERO that the resource cannot be held at all yet, which is the state Fuel
  // starts Act VII in and the one that reads as "I have no Fuel and no way to get any".
  //
  // It names the shop, because the answer is a purchase and the player has no reason to guess which
  // screen it is on. It does not name the module: which tank is next is the Fab panel's to say, and
  // it says it there beside the price and the gate.
  unbankedBadge: 'nowhere to put it',
  unbankedNote: 'Being made and thrown away — nothing on the wreck can hold it yet. The Fab shop has the tank that lets it start counting.',

  ventBadge: 'not banked',
  ventNote: 'Full, so this is being made and thrown away — the producers have throttled back to match the draw. Storage, or anything that spends it, keeps it.',

};

module.exports = { ACT_SEVEN_DIRECTIVES, getDirective, opsCopy, ACT_SEVEN_NEXT_STEPS, getNextStep, nextStepCopy };
