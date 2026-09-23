import { Fragment, type ReactNode } from "react";
export function rich(
  template: string,
  slots: Record<string, ReactNode> = {},
  strongClassName = "font-semibold text-white"
): ReactNode[] {
  const out: ReactNode[] = [];
  const tokens = template.split(/(\*\*[^*]+\*\*|\{\w+\})/g).filter(Boolean);

  tokens.forEach((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      out.push(
        <strong key={index} className={strongClassName}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("{") && token.endsWith("}")) {
      const name = token.slice(1, -1);
      out.push(<Fragment key={index}>{name in slots ? slots[name] : token}</Fragment>);
    } else {
      out.push(token);
    }
  });

  return out;
}
