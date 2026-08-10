const React = require('react');

function Modal({ title, children, onClose, closeLabel = 'Close' }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
        {onClose && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="btn secondary" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

module.exports = Modal;
