const React = require('react');

// The crew, three acts before RosterPanel exists. These are ordinary player entities
// (engine/playerFactory.js) shown the simplified way their `simplified` flag asks for:
// a name, a position and the one stat they are known for.
function CrewList({ crew, crewRequired }) {
  const slots = [];
  for (let i = 0; i < Math.max(crewRequired, crew.length); i += 1) slots.push(crew[i] || null);

  return (
    <div className="wb-crew">
      <span className="wb-section-label">Your crew</span>
      <div className="wb-crew-grid">
        {slots.map((member, index) =>
          member ? (
            <div className="wb-crew-card" key={member.id}>
              <span className="wb-crew-name">{member.name}</span>
              <span className="wb-crew-position">{member.position}</span>
              <span className="wb-crew-stat">
                {member.signatureStat} {member.stats[member.signatureStat]}
              </span>
            </div>
          ) : (
            <div className="wb-crew-card empty" key={`empty-${index}`}>
              <span className="wb-crew-name">—</span>
              <span className="wb-crew-position">nobody yet</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

module.exports = CrewList;
