'use client';

export default function Modal({ open, title, message, value, onChange, placeholder, inputType, confirmText, cancelText, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        {message && <p className="modal-message">{message}</p>}
        {onChange && (
          <input
            autoFocus
            className="input"
            type={inputType || 'text'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || ''}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm && onConfirm(); }}
          />
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>{cancelText || 'Batal'}</button>
          <button className="btn success" onClick={onConfirm}>{confirmText || 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
