import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "@/lib/i18n";
import { installCrashHandlers, showCrash } from "./lib/crash";
import { installCache } from "./lib/cache";
import { detectSystemLocale } from "./lib/locale";
import "./styles.css";

installCrashHandlers();
installCache();

window.addEventListener("keydown", (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "-" ||
      event.key === "=" ||
      event.key === "+" ||
      event.key === "0")
  )
    event.preventDefault();
});
window.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest("input, textarea, [data-selectable]"))
    event.preventDefault();
});

const initialLocale = await detectSystemLocale();

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) =>
    showCrash(
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error),
    ),
}).render(
  <StrictMode>
    <I18nProvider initialLocale={initialLocale}>
      <App />
    </I18nProvider>
  </StrictMode>,
);