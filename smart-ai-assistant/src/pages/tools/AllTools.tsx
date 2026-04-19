// ════════════════════════════════════════════════════════════
//  ALL 10 TOOL PAGES
//  Image Creator uses dedicated ImageCreatorPage (image pipeline)
//  Other 9 tools use shared ToolPage template (text pipeline)
// ════════════════════════════════════════════════════════════
import { ToolPage }         from './ToolPage';
import { ImageCreatorPage } from './ImageCreatorPage';
import { ALL_TOOLS }        from '../../utils/helpers';

const t = (id: string) => ALL_TOOLS.find(x => x.id === id)!;

// Existing 4
export const ContentGeneratorPage  = () => <ToolPage config={t('content')} />;
export const CodeAssistantPage     = () => <ToolPage config={t('code')} />;
export { ImageCreatorPage };                              // dedicated image pipeline
export const TaskManagerAIPage     = () => <ToolPage config={t('task')} />;

// New 6
export const StoryCreatorPage      = () => <ToolPage config={t('story')} />;
export const TextSummarizerPage    = () => <ToolPage config={t('summary')} />;
export const ImageSummarizerPage   = () => <ToolPage config={t('imageSummary')} />;
export const CodeCheckerPage       = () => <ToolPage config={t('codeCheck')} />;
export const TextHumanizerPage     = () => <ToolPage config={t('humanize')} />;
export const GrammarFixerPage      = () => <ToolPage config={t('grammar')} />;
