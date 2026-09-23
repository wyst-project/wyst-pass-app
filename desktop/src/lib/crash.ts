import { invoke } from "@tauri-apps/api/core";

const report = (level: string, message: string) => {
  invoke("log_frontend", { level, message }).catch(() => {});
};

const describe = (value: unknown) => {
  if (value instanceof Error)
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function showCrash(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = "";
  const box = document.createElement("pre");
  box.setAttribute("data-selectable", "");
  box.style.cssText =
    "margin:0;padding:20px;height:100%;overflow:auto;white-space:pre-wrap;font:12px/1.5 Consolas,monospace;color:#f7a1b8;background:#050505";
  box.textContent = `Wyst Pass crashed\n\n${message}`;
  root.appendChild(box);
}

export function installCrashHandlers() {
  window.addEventListener("error", (event) => {
    const message = `${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${describe(event.error)}`;
    report("error", message);
    showCrash(message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const message = describe(event.reason);
    report("rejection", message);
  });
  const original = console.error;
  console.error = (...args: unknown[]) => {
    report("console", args.map(describe).join(" "));
    original(...args);
  };
}