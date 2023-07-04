import React from 'react';

export default function RetterButton({
  border,
  color,
  children,
  height,
  onClick,
  radius,
  width,
}: {
  border: string;
  color: string;
  children?: React.ReactNode;
  height: string;
  onClick: () => void;
  radius: string;
  width: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: color,
        border,
        borderRadius: radius,
        height,
        width,
      }}>
      {children}
    </button>
  );
}
