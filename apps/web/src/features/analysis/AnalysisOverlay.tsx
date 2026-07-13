/**
 * 全屏分析结果页：流式渲染 Markdown，支持关闭回对话、二次打开读缓存、失败重试。
 */
import * as Dialog from '@radix-ui/react-dialog';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ensureAnalysis } from '@/features/analysis/analyze-client';
import { useAppStore } from '@/store';

export function AnalysisOverlay() {
  const openAnalysisId = useAppStore((s) => s.openAnalysisId);
  const closeAnalysis = useAppStore((s) => s.closeAnalysis);
  const message = useAppStore((s) => s.messages.find((m) => m.id === s.openAnalysisId));
  const entry = useAppStore((s) => (s.openAnalysisId ? s.analysis[s.openAnalysisId] : undefined));
  const updateAnalysis = useAppStore((s) => s.updateAnalysis);

  const open = openAnalysisId !== null;

  const retry = () => {
    if (!openAnalysisId) return;
    // 清缓存后重新发起
    updateAnalysis(openAnalysisId, { status: 'error', content: '' });
    ensureAnalysis(openAnalysisId);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && closeAnalysis()}>
      <Dialog.Portal>
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
          aria-describedby={undefined}
        >
          {/* 顶栏：问题原文 + 关闭 */}
          <header className="flex shrink-0 items-start gap-4 border-b px-6 py-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  AI 分析
                </p>
                <Dialog.Title className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {message?.text ?? ''}
                </Dialog.Title>
              </div>
            </div>
            {entry?.status === 'done' && (
              <Button variant="outline" size="sm" onClick={retry}>
                <RotateCcw />
                重新生成
              </Button>
            )}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="关闭">
                <X />
              </Button>
            </Dialog.Close>
          </header>

          {/* 内容区：流式 Markdown */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-8">
              {!entry || (entry.status === 'streaming' && !entry.content) ? (
                <p className="animate-pulse text-sm text-muted-foreground">正在分析…</p>
              ) : entry.status === 'error' ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">分析失败：{entry.error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
                    <RotateCcw />
                    重试
                  </Button>
                </div>
              ) : (
                <article
                  className={`prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground ${
                    entry.status === 'streaming' ? 'stream-cursor' : ''
                  }`}
                >
                  <ReactMarkdown>{entry.content}</ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
