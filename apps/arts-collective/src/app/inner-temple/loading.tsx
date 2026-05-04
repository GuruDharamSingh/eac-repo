export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: 'rgba(255,255,255,0.3)',
        fontFamily: 'serif',
        letterSpacing: '0.3em',
        fontSize: '0.75rem',
      }}
    >
      ◯
    </div>
  );
}
