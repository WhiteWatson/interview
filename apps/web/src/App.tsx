import { ConversationView } from '@/components/ConversationView';
import { AnalysisOverlay } from '@/features/analysis/AnalysisOverlay';

export default function App() {
  return (
    <>
      <ConversationView />
      <AnalysisOverlay />
    </>
  );
}
