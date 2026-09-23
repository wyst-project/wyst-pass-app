import {
  StrictMode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Bell,
  Check,
  Download,
  ExternalLink,
  LockKeyhole,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { playChime } from "./chime";
import "./styles.css";

interface Notification {
  id: string;
  kind: string;
  caption?: string | null;
  title: string;
  body: string;
  image?: string | null;
  actionLabel?: string | null;
  action?: string | null;
  sound: boolean;
  durationMs: number;
}

const MAX_VISIBLE = 3;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Bell,
  success: Check,
  lock: LockKeyhole,
  danger: Trash2,
  update: Download,
  account: UserRound,
};

function App() {
  const [items, setItems] = useState<(Notification & { leaving?: boolean })[]>(
    [],
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<Notification>("wyst-pass:notification", (event) => {
      const next = event.payload;
      setItems((current) =>
        [...current.filter((item) => item.id !== next.id), next].slice(
          -MAX_VISIBLE,
        ),
      );
      if (next.sound) void playChime();
    }).then((fn) => {
      unlisten = fn;
      void invoke("notification_ready");
    });
    return () => unlisten?.();
  }, []);

  useLayoutEffect(() => {
    if (items.length === 0) {
      void invoke("notification_done");
      return;
    }
    const height = rootRef.current?.getBoundingClientRect().height ?? 120;
    void invoke("notification_layout", { height: Math.ceil(height) });
  }, [items]);

  const dismiss = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, leaving: true } : item,
      ),
    );
    setTimeout(
      () => setItems((current) => current.filter((item) => item.id !== id)),
      180,
    );
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-2.5 p-3">
      {items.map((item) => (
        <Card key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}

function Card({
  item,
  onDismiss,
}: {
  item: Notification & { leaving?: boolean };
  onDismiss: () => void;
}) {
  const [hover, setHover] = useState(false);
  const started = useRef(performance.now());
  const remaining = useRef(item.durationMs);
  const timer = useRef<number | null>(null);
  const Icon = ICONS[item.kind] ?? Bell;

  useEffect(() => {
    if (hover) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      remaining.current -= performance.now() - started.current;
      return;
    }
    started.current = performance.now();
    timer.current = window.setTimeout(
      onDismiss,
      Math.max(400, remaining.current),
    );
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [hover]);

  const act = () => {
    if (item.action)
      void invoke("notification_action", { action: item.action });
    onDismiss();
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`notif-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${item.leaving ? "notif-out" : "notif-in"}`}
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          draggable={false}
          className="block h-40 w-full border-b border-white/[0.06] object-cover"
        />
      )}
      <div className="flex items-start gap-3 p-4">
        {!item.image && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 ring-1 ring-inset ring-white/[0.08]">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug text-white">
            {item.title}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
            {item.body}
          </p>
          {item.action && item.actionLabel && (
            <button
              type="button"
              onClick={act}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12.5px] font-medium text-white/70 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
            >
              <ExternalLink className="size-3.5" />
              {item.actionLabel}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="close"
          className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);