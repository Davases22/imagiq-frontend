interface NavigationButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
}

export const NavigationButton = ({ direction, onClick }: NavigationButtonProps) => {
  const isPrev = direction === "prev";
  const label = isPrev ? "Anterior" : "Siguiente";

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center shadow-lg hover:brightness-95 transition rounded-full flex-shrink-0"
      style={{
        zIndex: 30,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        width: 40,
        height: 40,
        backgroundColor: "#ffffff",
        color: "#222",
        border: "1px solid #e5e7eb",
      }}
    >
      <svg
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          d={isPrev ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
          stroke="#222"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};
