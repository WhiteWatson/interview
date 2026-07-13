import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mic, Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureAnalysis } from '@/features/analysis/analyze-client';
import { startRecording, stopRecording } from '@/features/asr/asr-client';
import { cn } from '@/lib/utils';
import { useAppStore, type Message } from '@/store';

export function ConversationView() {
  const status = useAppStore((s) => s.status);
  const messages = useAppStore((s) => s.messages);
  const partial = useAppStore((s) => s.partial);
  const asrError = useAppStore((s) => s.asrError);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partial]);

  const recording = status === 'recording' || status === 'connecting' || status === 'stopping';

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-foreground" />
          <h1 className="text-sm font-semibold tracking-tight">Interview Copilot</h1>
        </div>
        <StatusBadge />
      </header>

      {/* 消息区 */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-6 py-6 pb-32">
          {messages.length === 0 && !partial && (
            <div className="mt-24 text-center">
              <p className="text-sm text-muted-foreground">
                点击下方麦克风开始录音，面试官的提问会实时转写到这里
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                每条转写支持复制，或交给 AI 生成回答建议
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
          {partial && (
            <div className="rounded-lg border border-dashed px-4 py-3">
              <p className="text-sm text-muted-foreground">{partial}</p>
            </div>
          )}
          {asrError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{asrError}</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 底部麦克风控制 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/90 to-transparent pb-8 pt-16">
        <div className="pointer-events-auto flex justify-center">
          <button
            onClick={() => (recording ? void stopRecording() : void startRecording())}
            disabled={status === 'stopping'}
            aria-label={recording ? '停止录音' : '开始录音'}
            className={cn(
              'flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              recording
                ? 'recording-pulse border-destructive bg-destructive text-destructive-foreground'
                : 'border-border bg-primary text-primary-foreground hover:scale-105',
            )}
          >
            {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge() {
  const status = useAppStore((s) => s.status);
  const label = {
    idle: '空闲',
    connecting: '连接中…',
    recording: '录音中',
    stopping: '收尾中…',
  }[status];
  return (
    <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'recording'
            ? 'animate-pulse bg-destructive'
            : status === 'idle'
              ? 'bg-muted-foreground/40'
              : 'animate-pulse bg-foreground/70',
        )}
      />
      {label}
    </span>
  );
}

function MessageRow({ message }: { message: Message }) {
  const openAnalysis = useAppStore((s) => s.openAnalysis);
  const hasAnalysis = useAppStore((s) => s.analysis[message.id]?.status === 'done');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板权限受限时静默失败
    }
  };

  const search = () => {
    openAnalysis(message.id);
    ensureAnalysis(message.id);
  };

  return (
    <div className="group rounded-lg border bg-card px-4 py-3 transition-colors hover:border-ring/60">
      <p className="text-sm leading-relaxed">{message.text}</p>
      {/* 桌面端 hover 显示操作；触屏设备（无 hover）常显 */}
      <div className="mt-2 flex items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="text-green-500" /> : <Copy />}
          {copied ? '已复制' : '复制'}
        </Button>
        <Button variant="ghost" size="sm" onClick={search}>
          <Search />
          {hasAnalysis ? '查看分析' : '搜索'}
        </Button>
      </div>
    </div>
  );
}
