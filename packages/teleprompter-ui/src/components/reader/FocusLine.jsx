export function FocusLine({ position }) {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none z-10"
      style={{
        top:          `calc(${position}% - 2.5em)`,
        height:       '5em',
        background:   'rgba(232, 168, 56, 0.12)',
        borderTop:    '1px solid rgba(232, 168, 56, 0.25)',
        borderBottom: '1px solid rgba(232, 168, 56, 0.25)',
      }}
    />
  );
}
