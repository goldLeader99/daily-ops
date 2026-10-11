import type { Section } from '../App';
import type { DashboardData } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { createItem, deleteItem, editItem, toggleItem } from '../domain/model';
import { Checklist } from '../components/Checklist';
import { Workout } from './Workout';
import { Mileage } from './Mileage';
import { Stats } from './Stats';
import { Projects } from './Projects';
import { QuickActions } from './QuickActions';
import { Settings } from './Settings';
import { DayCounter } from './DayCounter';
import { ThemeEditor } from './ThemeEditor';
import { Clock } from './Clock';
import type { CloudSync } from '../sync/useCloudSync';
export type DetailsProps = {
  section: Section;
  data: DashboardData;
  date: string;
  now: Date;
  commit: Commit;
  restore: (raw: string) => boolean;
  exportRaw: () => string;
  notify: (text: string) => void;
  cloud: CloudSync;
};
export function Details(props: DetailsProps) {
  const { section, data, commit } = props;
  if (section === 'today' || section === 'groceries') {
    const key = section === 'today' ? 'tasks' : 'groceries';
    return (
      <Checklist
        items={data[key]}
        noun={section === 'today' ? 'task' : 'item'}
        onAdd={(text) => commit((d) => ({ ...d, [key]: [...d[key], createItem(text)] }))}
        onToggle={(id) => commit((d) => ({ ...d, [key]: toggleItem(d[key], id) }))}
        onEdit={(id, text) => commit((d) => ({ ...d, [key]: editItem(d[key], id, text) }))}
        onDelete={(id) => commit((d) => ({ ...d, [key]: deleteItem(d[key], id) }))}
      />
    );
  }
  switch (section) {
    case 'clock':
      return <Clock now={props.now} />;
    case 'theme':
      return <ThemeEditor {...props} />;
    case 'cigarettes':
    case 'alcohol':
      return <DayCounter key={section} {...props} kind={section} />;
    case 'workout':
      return <Workout {...props} />;
    case 'flex':
      return <Mileage {...props} />;
    case 'status':
      return <Stats {...props} />;
    case 'projects':
      return <Projects {...props} />;
    case 'actions':
      return <QuickActions {...props} />;
    case 'settings':
      return <Settings {...props} />;
  }
}
