import React from 'react';

export default function BetterButton({
  border,
  color,
  children,
  height,
  onClick,
  width,
}: {
  border: string;
  color: string;
  children?: React.ReactNode;
  height: string;
  onClick: () => void;
  width: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: color,
        border,
        height,
        width,
      }}>
      {children}
    </button>
  );
}
