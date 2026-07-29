export type TabKey = 'search' | 'visited' | 'planned' | 'settings';

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  visitedCount: number;
  plannedCount: number;
}

const ICONS: Record<TabKey, string> = {
  search: '🔍',
  visited: '🍕',
  planned: '📍',
  settings: '⚙️',
};

const LABELS: Record<TabKey, string> = {
  search: 'Search',
  visited: 'Visited',
  planned: 'Planned',
  settings: 'Settings',
};

const ORDER: TabKey[] = ['search', 'visited', 'planned', 'settings'];

export function TabBar({ active, onChange, visitedCount, plannedCount }: TabBarProps) {
  const counts: Partial<Record<TabKey, number>> = { visited: visitedCount, planned: plannedCount };

  return (
    <nav className="tab-bar" aria-label="Main">
      <div className="tab-bar-inner">
        {ORDER.map((tab) => {
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              className={`tab ${active === tab ? 'tab-active' : ''}`}
              onClick={() => onChange(tab)}
              aria-current={active === tab ? 'page' : undefined}
            >
              <span className="tab-icon" aria-hidden="true">
                {ICONS[tab]}
              </span>
              <span className="tab-label">
                {LABELS[tab]}
                {count !== undefined && count > 0 && <span className="tab-count">{count}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
