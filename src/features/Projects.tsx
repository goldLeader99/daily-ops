import { useState } from 'react';
import type { DashboardData, Project } from '../domain/model';
import { cleanText, createItem, deleteItem, editItem, newId, toggleItem } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { Checklist } from '../components/Checklist';
import { Icon } from '../components/Icon';
export function Projects({
  data,
  commit,
  notify,
}: {
  data: DashboardData;
  commit: Commit;
  notify: (text: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(data.projects[0]?.id ?? '');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const selected = data.projects.find((p) => p.id === selectedId);
  const update = (change: (project: Project) => Project) =>
    commit((d) => ({
      ...d,
      projects: d.projects.map((p) => (p.id === selectedId ? change(p) : p)),
    }));
  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const id = newId();
          if (
            commit((d) => ({
              ...d,
              projects: [
                ...d.projects,
                { id, name: cleanText(name, 80), status: 'Active', tasks: [] },
              ],
            }))
          ) {
            setName('');
            setSelectedId(id);
            setDeleting(false);
          }
        }}
      >
        <input
          aria-label="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name…"
          maxLength={80}
          required
        />
        <button type="submit" className="primary">
          <Icon name="plus" /> ADD
        </button>
      </form>
      <div className="project-selector">
        {data.projects.map((p) => (
          <button
            key={p.id}
            aria-pressed={selectedId === p.id}
            onClick={() => {
              setSelectedId(p.id);
              setDeleting(false);
            }}
          >
            <span>{p.name}</span>
            <small>{p.status.toUpperCase()}</small>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="project-detail">
          <ProjectForm
            key={selected.id}
            project={selected}
            onSave={(name, status) => {
              if (update((p) => ({ ...p, name: cleanText(name, 80), status })))
                notify('Project updated.');
            }}
          />
          <div className="detail-section-title">
            <h3>Project tasks</h3>
            <span>
              {selected.tasks.filter((t) => t.completed).length} / {selected.tasks.length}
            </span>
          </div>
          <Checklist
            items={selected.tasks}
            onAdd={(text) => update((p) => ({ ...p, tasks: [...p.tasks, createItem(text)] }))}
            onToggle={(id) => update((p) => ({ ...p, tasks: toggleItem(p.tasks, id) }))}
            onEdit={(id, text) => update((p) => ({ ...p, tasks: editItem(p.tasks, id, text) }))}
            onDelete={(id) => update((p) => ({ ...p, tasks: deleteItem(p.tasks, id) }))}
          />
          {deleting ? (
            <div className="confirm-box">
              <p>Delete “{selected.name}” and its tasks?</p>
              <div className="form-actions">
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      commit((d) => ({
                        ...d,
                        projects: d.projects.filter((p) => p.id !== selectedId),
                      }))
                    ) {
                      setSelectedId('');
                      setDeleting(false);
                    }
                  }}
                >
                  DELETE PROJECT
                </button>
                <button onClick={() => setDeleting(false)}>KEEP PROJECT</button>
              </div>
            </div>
          ) : (
            <button className="text-button danger delete-project" onClick={() => setDeleting(true)}>
              <Icon name="trash" size={16} /> DELETE PROJECT
            </button>
          )}
        </div>
      ) : (
        <p className="empty">Select a project or add a new one.</p>
      )}
    </>
  );
}
function ProjectForm({
  project,
  onSave,
}: {
  project: Project;
  onSave: (name: string, status: Project['status']) => void;
}) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name, status);
      }}
    >
      <label className="field">
        PROJECT NAME
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        STATUS
        <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
          <option>Active</option>
          <option>Paused</option>
          <option>Complete</option>
        </select>
      </label>
      <button type="submit">SAVE PROJECT</button>
    </form>
  );
}
