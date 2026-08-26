const React = require('react');
const { useGame } = require('../../state/GameContext');
const { opsReadout } = require('../../engine/colonyReadout');
const { rateClass, meterClass } = require('../../data/colonyReadoutConfig');
const { getPhasePill } = require('../../data/actSevenPalette');
const { getDirective, opsCopy, nextStepCopy } = require('../../data/actSevenOpsConfig');
const { nextObjective } = require('../../engine/expeditionObjective');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');

// The terminal: net rates, the ration, the phase and the standing directive (PRD §6.4). The tab
// Act VII opens on, and for the first 20-30 minutes the only one — it carries no `unlockedBy` entry
// in data/acts.js for exactly that reason. It is the deliberate echo of Act I, where the whole game
// was one button on one screen.
//
// THIS FILE ADDS NO ARITHMETIC, AND THAT IS THE STORY'S CENTRAL RULE RATHER THAN A STYLE NOTE.
// Every figure on this screen — the stocks, the ceilings, the signed nets, the pin, the ration, the
// load-follow, Salvage/s — comes back already decided from ONE colonyRates() solve via
// engine/colonyReadout.js's opsReadout(). The screen exists to make engine/colony.js legible, so a
// screen that ran its own version of that arithmetic would be describing a colony the simulation is
// not running. That is not a hypothetical: the header's listResources() carries a long note about
// exactly this failure, and a panel disagreeing with the header about when Power runs out is worse
// than a panel with no rates on it.
//
// The only computation below is UNIT FORMATTING — a fraction to a percentage, a magnitude to one
// decimal place, seconds to a duration. That is the same line components/layout/ResourceChips.js
// draws and it is where the line belongs: turning 0.68 into "68%" decides nothing about the colony.
// Which COLOUR a rate wears is not formatting, it is a reading of the state, so it is decided in
// data/colonyReadoutConfig.js beside the header's tone table and imported here.
//
// ONE SOLVE PER RENDER. This panel is open continuously for the whole act and colonyRates() is a
// 16-pass Kleene fixed point, so the obvious construction — listResources() for the rows plus
// colonyRates() for the three scalars — would take two of them on every tick. opsReadout() exists
// to make that impossible rather than merely discouraged.
//
// WHAT IS DELIBERATELY NOT HERE:
//
//   THE SALVAGE CLICK. `SearchLotButton` lives outside the tab switch in AppShell's `.hustle-bar`
//   and §6.6 is explicit that it stays there. It was once inside LotPanel, and creating a season
//   silently deleted the act's only faucet. A copy here would be a second button that had to keep
//   agreeing with that one about cooldowns and modifiers.
//
//   THE LOG. §6.4 lists "the log" on this tab, but EventFeed already renders below the active panel
//   in every act and §6.6 keeps it there — "the only always-on signal that the simulation is
//   running". A second feed on one tab would make the act's most consistent element inconsistent.

// A fraction to a whole-number percentage. Whole numbers because the two throttles are read at a
// glance against 100%, and a ration that reads 99.4% when it is effectively unconstrained is noise
// — the engine's own convergence budget (§5.6) is 2%, so a decimal place here would be printing
// precision the solve does not claim.
function formatPercent(fraction) {
  if (!Number.isFinite(fraction)) return '—';
  return Math.round(fraction * 100) + '%';
}

// The signed rate. Deliberately the same shape as the header chip's, including the true minus sign
// — a hyphen and a plus at the same font size read as different weights, and these two are meant to
// be told apart by shape at a glance.
//
// A LOCAL COPY RATHER THAN AN IMPORT FROM ResourceChips, and the duplication is argued rather than
// accidental. It formats a number that has ALREADY been decided; the thing that must never be
// duplicated is the decision, and that lives in one place (engine/colonyReadout.js) which both
// surfaces read. Extracting three lines of string-building into a shared module would mean editing
// a header component that STORY-036 is working beside, to save nothing that can drift.
//
// Zero prints as '0/s' unsigned, and it now means what it says — nothing is happening to this
// resource. It used to be what a rate clamped at the FULL end read as too, which was the reading
// that made a colony with fifteen idle Power/s look identical to a colony with no reactors at all.
// The row below prints `shownNet`, which is the production figure on a full tank, and the vent line
// says the surplus is not being kept. The EMPTY pin still reads '0/s' and still relies on its badge
// and colour to be told apart from rest: a starved bus is producing nothing, so there is no hidden
// number there to reveal.
function formatNet(net) {
  if (!Number.isFinite(net) || net === 0) return '0/s';
  const magnitude = Math.abs(net) < 10 ? Math.abs(net).toFixed(1) : formatNumber(Math.abs(net));
  return `${net > 0 ? '+' : '−'}${magnitude}/s`;
}

// One consumable: what is in the tank, against a ceiling that is DERIVED and never stored, and the
// net rate the solve produced for it.
//
// The ceiling is always printed, including when it is 0. Fuel's base capacity is 0 until a tank is
// bought and that is a real value rather than a missing one (data/actSevenConfig.js is explicit),
// so "0/0" is the correct reading of a resource with nowhere to go — and hiding it would hide the
// single fact that gates the act's first launch.
function RateRow({ row }) {
  return (
    <div className="v7-ops-rate">
      <div className="v7-ops-rate-head">
        <span className="v7-ops-rate-name">{row.label}</span>
        <span className="v7-ops-rate-stock">
          {formatNumber(row.amount)}
          <span className="v7-ops-rate-cap">/{formatNumber(row.capacity)}</span>
        </span>
        {/* `shownNet` — the engine's choice between the pinned rate and the rate the bus would run
            at with headroom, made once in engine/colonyReadout.js so this panel and the header chip
            cannot hold different opinions about a full tank. */}
        <span className={('v7-rate ' + rateClass(row)).trim()}>{formatNet(row.shownNet)}</span>
      </div>

      {/* DIVS, NOT SPANS, AND THAT IS LOAD-BEARING RATHER THAN ARBITRARY. STORY-034's `.v7-meter`
          sets a 6px height and `position: relative` but no `display`, so on an inline element the
          height is simply ignored and the bar does not exist. Rendering block elements is the fix
          that touches nobody: adding `display: block` to the shared primitive would be forking a
          rule STORY-036 is also building on, and its own comment says to extend, not fork. */}
      <div className="v7-meter">
        <div
          className={('v7-meter-fill ' + meterClass(row)).trim()}
          style={{ width: `${(row.fraction * 100).toFixed(1)}%` }}
        />
      </div>

      {/* THE PIN, SPELLED OUT. `--v7-alert` on the rate above says something is clamped; this says
          which end and what it means, because the two ends are opposite problems wearing one
          colour. Decision 3.3's promise is that a starved colony is throttled and never broken, and
          the player can only believe that promise if the screen says it in words. The sentence is
          keyed by the engine's own `pinned` value, so nothing here chooses between them. */}
      {row.pinned ? (
        <div className="v7-ops-rate-pin">
          <span className="v7-ops-pin-badge">{opsCopy.pinBadge[row.pinned]}</span>
          <span>{opsCopy.pinNote[row.pinned]}</span>
        </div>
      ) : null}

      {/* THE VENT, WHICH IS WIDER THAN THE CAPACITY PIN AND HAD TO BE. `pinned === 'capacity'` fires
          only where production CANNOT back off — a site's atmosphere — because a bus filled by
          modules load-follows until the surplus is exactly 0 and the pin branch never runs. That is
          the commonest full tank in the act, and until this line it printed nothing at all: no
          badge, no note, and a rate of 0/s beside a bar at 100%. `venting` covers both, so the
          panel now explains every full tank rather than the rarer half of them.

          Suppressed when the capacity pin already rendered above, which says the same thing in a
          longer sentence. Two lines about one tank is the panel arguing with itself. */}
      {/* NO TANK, which the vent line below cannot say: `venting` requires a capacity to be full OF,
          so a resource whose ceiling is zero produced this panel's most confusing reading — a row
          at 0/0 with 0/s, indistinguishable from a module nobody has built. Fuel spends the opening
          of the act in exactly that state. */}
      {row.unbanked ? (
        <div className="v7-ops-rate-pin">
          <span className="v7-ops-pin-badge">{opsCopy.unbankedBadge}</span>
          <span>{opsCopy.unbankedNote}</span>
        </div>
      ) : null}

      {row.venting && row.pinned !== 'capacity' ? (
        <div className="v7-ops-rate-pin">
          <span className="v7-ops-pin-badge">{opsCopy.ventBadge}</span>
          <span>{opsCopy.ventNote}</span>
        </div>
      ) : null}

      {/* The per-bus throttles, shown only where one is actually biting. `rationed` and `backedOff`
          are the engine's `< 1` tests, not tests written here — see engine/colonyReadout.js. A row
          under no pressure at either end shows nothing at all, which is what keeps the opening
          phase's four rows readable. */}
      {row.rationed || row.backedOff || row.warning ? (
        <div className="v7-ops-rate-detail">
          {row.rationed ? (
            <span>{opsCopy.rationLabel} {formatPercent(row.satisfaction)}</span>
          ) : null}
          {row.backedOff ? (
            <span>{opsCopy.throttleLabel} {formatPercent(row.supplyThrottle)}</span>
          ) : null}
          {/* Only on rows the engine flagged. `secondsUntilEmpty` is Infinity whenever the resource
              is not actually falling — including the pinned-at-empty case — and `warning` is
              already guarded on it being finite, so this never formats an infinity. */}
          {row.warning ? <span>{opsCopy.emptiesIn(formatDuration(Math.round(row.secondsUntilEmpty)))}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// One of the three solve figures. A value, what it is called, which bus set it, and one line of
// what it means — because §5.6's ration is the act's central mechanic and it is invisible
// everywhere else in the game.
function SolveTile({ label, value, detail, help }) {
  return (
    <div className="v7-ops-tile">
      <div className="v7-ops-tile-label">{label}</div>
      <div className="v7-ops-tile-value">{value}</div>
      <div className="v7-ops-tile-detail">{detail}</div>
      <div className="v7-ops-tile-help">{help}</div>
    </div>
  );
}

function OpsPanel() {
  const { state } = useGame();
  // Reads the slice through opsReadout() -> expeditionSlice(), never `state.expedition` directly.
  // That is what makes this panel correct against a save with no `expedition` key at all — saves
  // are never migrated in this codebase, so absent must read as empty, and it does so in the
  // accessor rather than in a guard here.
  const readout = opsReadout(state);
  const directive = getDirective(readout.phase);
  const pill = getPhasePill(readout.phase);
  // The one concrete thing to do next, decided by engine/expeditionObjective.js — including which
  // shop row it is measured against and whether it can be afforded yet. Null in `majors` and for an
  // unrecognized phase, and the block is omitted either way.
  const objective = nextObjective(state);

  return (
    <div className="panel">
      <h2>{opsCopy.title}</h2>
      <p className="muted">{opsCopy.subtitle}</p>

      {/* THE DIRECTIVE FIRST, ABOVE THE NUMBERS. In `aftermath` the numbers are four zeros for
          twenty minutes and this line is the entire screen; later it is the thing the numbers are
          in service of. The phase pill sits in this block rather than beside the heading because
          the directive is what the phase MEANS, and the two read as one statement.

          The whole block is omitted when the phase id is unrecognized — getDirective() returns null
          by the same convention getPhasePill() uses, argued at both definitions: `expedition.phase`
          is self-healing and a corrupt value is one tick from repair, so saying nothing for that
          tick beats putting invented words in the Office's mouth. */}
      {directive ? (
        <div className="v7-ops-directive">
          <div className="v7-ops-directive-head">
            <h3>{opsCopy.directiveTitle}</h3>
            {/* Coloured inline from data/actSevenPalette.js by exactly the path HeaderStats uses
                for the same pill — one palette, one accessor, two surfaces. getPhasePill() returns
                null for an unrecognized id and the chip then keeps its default ground. */}
            <span
              className="v7-ops-phase-pill"
              style={pill ? { background: pill.bg, color: pill.ink } : undefined}
            >
              {directive.phase}
            </span>
          </div>
          <p className="v7-ops-directive-line">{directive.directive}</p>
          <p className="muted">{directive.note}</p>
        </div>
      ) : null}

      {/* THE NEXT STEP, UNDER THE DIRECTIVE AND IN THE TERMINAL'S OWN VOICE. The Office files orders
          and does not explain them, which is the right voice and is left alone; this is the status
          line underneath saying which button, on which tab. It exists because a player who had just
          accepted the call-up reported having nothing to do but press the Salvage button, with
          nothing on screen connecting that button to anything.

          The progress bar appears only where a price is what stands between the player and the next
          step — see engine/expeditionObjective.js for why the later phases get the sentence and no
          bar rather than a bar measuring the wrong thing. */}
      {objective && (
        <div className="v7-ops-next">
          <div className="v7-ops-next-head">
            <span className="v7-ops-next-label">{nextStepCopy.heading}</span>
            <span className="v7-ops-next-where">{objective.whereLabel}</span>
          </div>
          <p className="v7-ops-next-action">{objective.action}</p>
          {objective.ready && <p className="v7-ops-next-ready">{objective.ready}</p>}
          {objective.progress && (
            <div className="v7-ops-next-progress">
              <span className="v7-ops-next-progress-track">
                <span className="v7-ops-next-progress-fill" style={{ width: `${objective.progress.pct}%` }} />
              </span>
              <span className="v7-ops-next-progress-text">
                {objective.progress.label} <span className="muted">{objective.progress.forLabel}</span>
              </span>
            </div>
          )}
        </div>
      )}

      <h3>{opsCopy.ratesTitle}</h3>
      <p className="muted">{opsCopy.ratesNote}</p>

      {/* All four rows, always, including when every figure is zero. An empty box would be the one
          reading a player could not distinguish from a broken panel, and `aftermath` is long. The
          line that says those zeros are expected is the phase's own `note`, rendered above with the
          directive — see the removed-`quiet` note in engine/colonyReadout.js for why it is there
          and not here. */}
      {/* Wrapped rather than emitted as bare siblings, so the last row can drop its bottom rule.
          `:last-of-type` on the rows alone would never match — the solve grid below is also a div,
          and it would be the last one of that type in the panel. */}
      <div className="v7-ops-rates">
        {readout.rows.map((row) => (
          <RateRow key={row.id} row={row} />
        ))}
      </div>

      {/* The solve itself. `ration` and `throttle` are the two ends of the same clamp and are kept
          apart deliberately — one is the colony starving, the other is the colony full — and
          Salvage sits beside them because it comes out of the same solve at the same ration, which
          is why the header can never disagree with this number. */}
      <div className="v7-ops-solve">
        <SolveTile
          label={opsCopy.rationLabel}
          value={formatPercent(readout.ration.value)}
          detail={readout.ration.id ? opsCopy.tightestOn(readout.ration.label) : opsCopy.tightestNone}
          help={opsCopy.rationHelp}
        />
        <SolveTile
          label={opsCopy.throttleLabel}
          value={formatPercent(readout.throttle.value)}
          detail={readout.throttle.id ? opsCopy.tightestOn(readout.throttle.label) : opsCopy.tightestNone}
          help={opsCopy.throttleHelp}
        />
        <SolveTile
          label={opsCopy.salvageLabel}
          value={formatNet(readout.salvage)}
          detail={opsCopy.salvageDetail}
          help={opsCopy.salvageHelp}
        />
      </div>
    </div>
  );
}

module.exports = OpsPanel;
