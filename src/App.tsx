import { DataLoader } from './components/DataLoader';
import { Dashboard } from './components/Dashboard';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const profile = useAppStore((state) => state.profile);
  return profile ? <Dashboard /> : <DataLoader />;
}
