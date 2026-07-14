import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Copy, Mic, Search, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureAnalysis } from '@/features/analysis/analyze-client';
import { startRecording, stopRecording } from '@/features/asr/asr-client';
import { fileToCompressedDataUrl } from '@/lib/image';
import { cn } from '@/lib/utils';
import { useAppStore, type Message, type PhotoMessage, type SpeechMessage } from '@/store';

export function ConversationView() {
  const status = useAppStore((s) => s.status);
  const messages = useAppStore((s) => s.messages);
  const partial = useAppStore((s) => s.partial);
  const asrError = useAppStore((s) => s.asrError);
  const addPhoto = useAppStore((s) => s.addPhoto);
  const openAnalysis = useAppStore((s) => s.openAnalysis);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partial]);

  const recording = status === 'recording' || status === 'connecting' || status === 'stopping';

  /** 拍照/选图 → 压缩 → 入对话流 → 直接打开结果页开始解题 */
  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 允许连续拍同一张图：清空 input 的 value，否则 change 不会再触发
    event.target.value = '';
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const id = addPhoto(dataUrl);
      openAnalysis(id);
      ensureAnalysis(id);
    } catch (err) {
      setPhotoError(`图片处理失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
                点击麦克风开始录音，面试官的提问会实时转写到这里
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                每条转写支持复制，或交给 AI 生成回答建议；遇到算法题可拍照直接出解题思路
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
          {photoError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{photoError}</p>
            </div>
          )}
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

      {/* 底部控制：麦克风（主）+ 拍照解题（次） */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/90 to-transparent pb-8 pt-16">
        <div className="pointer-events-auto flex items-center justify-center gap-5">
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

          {/* capture="environment"：手机上直接唤起后置摄像头拍照；桌面端退化为选图 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="拍照解算法题"
            title="拍照解算法题"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border bg-secondary text-secondary-foreground transition-all hover:scale-105 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera className="h-5 w-5" />
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
  return message.kind === 'photo' ? (
    <PhotoRow message={message} />
  ) : (
    <SpeechRow message={message} />
  );
}

/** 拍照上传的算法题：缩略图 + 解题按钮 */
function PhotoRow({ message }: { message: PhotoMessage }) {
  const openAnalysis = useAppStore((s) => s.openAnalysis);
  const entry = useAppStore((s) => s.analysis[message.id]);

  const solve = () => {
    openAnalysis(message.id);
    ensureAnalysis(message.id);
  };

  const label =
    entry?.status === 'done' ? '查看解题思路' : entry?.status === 'streaming' ? '解题中…' : '解题';

  return (
    <div className="group rounded-lg border bg-card p-3 transition-colors hover:border-ring/60">
      <button
        onClick={solve}
        className="block w-full cursor-pointer overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={message.imageDataUrl}
          alt="拍照的算法题"
          className="max-h-64 w-full bg-secondary object-contain"
        />
      </button>
      <div className="mt-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={solve}>
          <Sparkles />
          {label}
        </Button>
      </div>
    </div>
  );
}

/** 语音转写的一句话：复制 + 搜索（AI 答题建议） */
function SpeechRow({ message }: { message: SpeechMessage }) {
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
