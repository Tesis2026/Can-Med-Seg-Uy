import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary";

export type ButtonProps = {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
  to?: string;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

function buttonClass(variant: ButtonVariant, className?: string): string {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  children,
  className,
  to,
  disabled,
  type = "button",
  onClick,
}: ButtonProps) {
  const classes = buttonClass(variant, className);

  if (to !== undefined && !disabled) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || to !== undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
