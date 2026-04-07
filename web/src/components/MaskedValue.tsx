import { usePrivacy } from "../hooks/usePrivacy";
import { useCurrency } from "../hooks/useCurrency";

interface MaskedValueProps {
  value: number | string;
  currency?: boolean;
  className?: string;
  revealKey: string;
  allowReveal?: boolean;
}

export function MaskedValue({
  value,
  currency = false,
  className = "",
  revealKey,
  allowReveal = true,
}: MaskedValueProps) {
  const { privacyMode, isRevealed, revealValue, hideValue } = usePrivacy();
  const { formatAmount } = useCurrency();

  const revealed = isRevealed(revealKey);
  const shouldMask = privacyMode && !revealed;

  const displayValue = currency
    ? formatAmount(Number(value))
    : typeof value === "number"
      ? value.toLocaleString()
      : value;

  const maskedDisplay = currency ? "••••" : "••••";

  const handleClick = () => {
    if (!allowReveal || !privacyMode) return;
    if (revealed) {
      hideValue(revealKey);
    } else {
      revealValue(revealKey);
    }
  };

  return (
    <span
      onClick={handleClick}
      className={`
        ${shouldMask ? "select-none" : ""}
        ${allowReveal && privacyMode ? "cursor-pointer hover:opacity-80" : ""}
        ${className}
      `}
      title={allowReveal && privacyMode ? "Click to reveal" : undefined}
    >
      {shouldMask ? maskedDisplay : displayValue}
    </span>
  );
}

// Simple version without currency formatting
interface SimpleMaskedValueProps {
  value: string | number;
  className?: string;
  revealKey: string;
  maskLength?: number;
}

export function SimpleMaskedValue({
  value,
  className = "",
  revealKey,
  maskLength = 4,
}: SimpleMaskedValueProps) {
  const { privacyMode, isRevealed, revealValue, hideValue } = usePrivacy();

  const revealed = isRevealed(revealKey);
  const shouldMask = privacyMode && !revealed;

  const displayValue = String(value);
  const maskedDisplay = "•".repeat(maskLength);

  const handleClick = () => {
    if (!privacyMode) return;
    if (revealed) {
      hideValue(revealKey);
    } else {
      revealValue(revealKey);
    }
  };

  return (
    <span
      onClick={handleClick}
      className={`
        ${shouldMask ? "select-none" : ""}
        ${privacyMode ? "cursor-pointer hover:opacity-80" : ""}
        ${className}
      `}
      title={privacyMode ? "Click to reveal" : undefined}
    >
      {shouldMask ? maskedDisplay : displayValue}
    </span>
  );
}
