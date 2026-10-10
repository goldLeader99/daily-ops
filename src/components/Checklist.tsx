import { useState } from 'react';
import type { ChecklistItem } from '../domain/model';
import { Icon } from './Icon';
type Props = {
  items: ChecklistItem[];
  onAdd: (text: string) => boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => boolean;
  onDelete: (id: string) => void;
  noun?: string;
};
export function Checklist({ items, onAdd, onToggle, onEdit, onDelete, noun = 'task' }: Props) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <div className="checklist-editor">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (onAdd(text)) setText('');
        }}
      >
        <label className="sr-only" htmlFor={'new-' + noun}>
          New {noun}
        </label>
        <input
          id={'new-' + noun}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          required
          placeholder={'Add a ' + noun + '…'}
        />
        <button className="primary" type="submit">
          <Icon name="plus" /> ADD
        </button>
      </form>
      {items.length === 0 && (
        <p className="empty">Nothing on this list. Add your first {noun} above.</p>
      )}
      <div className="detail-list">
        {items.map((item) => (
          <div className="editable-row" key={item.id}>
            {editing === item.id ? (
              <form
                className="edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (onEdit(item.id, draft)) setEditing(null);
                }}
              >
                <input
                  value={draft}
                  autoFocus
                  aria-label={'Edit ' + noun}
                  maxLength={120}
                  required
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit">SAVE</button>
                <button type="button" onClick={() => setEditing(null)}>
                  CANCEL
                </button>
              </form>
            ) : (
              <>
                <label className={'check-row ' + (item.completed ? 'completed' : '')}>
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggle(item.id)}
                  />
                  <span>{item.text}</span>
                </label>
                <button
                  className="icon-button"
                  aria-label={'Edit ' + item.text}
                  onClick={() => {
                    setEditing(item.id);
                    setDraft(item.text);
                  }}
                >
                  <Icon name="edit" size={17} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={'Delete ' + item.text}
                  onClick={() => onDelete(item.id)}
                >
                  <Icon name="trash" size={17} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
