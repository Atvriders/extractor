import { useState, type FormEvent } from 'react';

interface Props { onConfirm: (username: string) => void }

const USERNAME_RE = /^[a-zA-Z0-9_-]{2,20}$/;

export default function UsernameModal({ onConfirm }: Props) {
  const [value, setValue]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const valid = USERNAME_RE.test(value);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) { setError('2–20 characters: letters, numbers, _ or -'); return; }
    setLoading(true);
    onConfirm(value.trim());
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-title">⬡ EXTRACTOR</div>
        <div className="modal-subtitle">Enter your commander name</div>
        <div className="modal-hint">
          Your save is stored by name — use the same name on any device to resume.
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            className="modal-input"
            type="text"
            placeholder="e.g. StarMiner42"
            value={value}
            onChange={e => { setValue(e.target.value); setError(''); }}
            maxLength={20}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {error && <div className="modal-error">{error}</div>}
          <button className="buy-btn modal-confirm-btn" type="submit" disabled={!valid || loading}>
            {loading ? 'Loading…' : 'Begin Mission'}
          </button>
        </form>
      </div>
    </div>
  );
}
