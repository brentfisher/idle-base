const React = require('react');
const { CREW_RESPECT_THRESHOLDS } = require('../../data/wallBallConfig');

const STAT_LABELS = {
  power: 'Power',
  contact: 'Contact',
  speed: 'Speed',
  defense: 'Glove',
  pitching: 'Arm',
};

// A crew member is a full player entity with exactly one stat surfaced — the roster
// concept, three acts before RosterPanel appears.
function CrewList({ crew, respect }) {
  const nextThreshold = CREW_RESPECT_THRESHOLDS.find((t) => respect < t) || null;

  return (
    <div className="crew-list">
      <h3>Crew ({crew.length}/3)</h3>
      {crew.length === 0 && <p className="muted">Nobody wants to be seen with you yet. Win something.</p>}
      <div className="card-grid">
        {crew.map((member) => (
          <div className="card crew-card" key={member.id}>
            <strong>{member.name}</strong>
            <div className="crew-position">{member.position}</div>
            <div className="crew-stat">
              {STAT_LABELS[member.visibleStat] || member.visibleStat} {member.stats[member.visibleStat]}
            </div>
          </div>
        ))}
      </div>
      {nextThreshold !== null && (
        <p className="muted">
          Next kid joins at {nextThreshold} Respect — {nextThreshold - respect} to go.
        </p>
      )}
    </div>
  );
}

module.exports = CrewList;
