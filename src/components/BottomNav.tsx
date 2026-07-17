import { BookOpen, History, Play } from 'lucide-react';

export type AppTab = 'play' | 'courses' | 'history';

interface BottomNavProps {
  activeTab: AppTab;
  onSelect(tab: AppTab): void;
}

export function BottomNav({ activeTab, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button className={activeTab === 'play' ? 'active' : ''} onClick={() => onSelect('play')}>
        <Play size={18} /> Play
      </button>
      <button className={activeTab === 'courses' ? 'active' : ''} onClick={() => onSelect('courses')}>
        <BookOpen size={18} /> Courses
      </button>
      <button className={activeTab === 'history' ? 'active' : ''} onClick={() => onSelect('history')}>
        <History size={18} /> History
      </button>
    </nav>
  );
}
