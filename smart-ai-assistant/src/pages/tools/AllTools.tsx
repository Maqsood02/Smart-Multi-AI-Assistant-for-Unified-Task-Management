import { ToolPage }              from './ToolPage';
import { ImageCreatorPage }      from './ImageCreatorPage';
import { ImageSummarizerPage }   from './ImageSummarizerPage';
import { ALL_TOOLS }             from '../../utils/helpers';

const t = (id: string) => ALL_TOOLS.find(x => x.id === id)!;

export const ContentGeneratorPage  = () => <ToolPage config={t('content')} />;
export const CodeAssistantPage     = () => <ToolPage config={t('code')} />;
export { ImageCreatorPage };
export const TaskManagerAIPage     = () => <ToolPage config={t('task')} />;
export const StoryCreatorPage      = () => <ToolPage config={t('story')} />;
export const TextSummarizerPage    = () => <ToolPage config={t('summary')} />;
export { ImageSummarizerPage };
export const CodeCheckerPage       = () => <ToolPage config={t('codeCheck')} />;
export const TextHumanizerPage     = () => <ToolPage config={t('humanize')} />;
export const GrammarFixerPage      = () => <ToolPage config={t('grammar')} />;
