import { cn } from "@/lib/utils";

interface ReviewCardProps {
  review: {
    author_id: string;
    firstName: string;
    initial: string;
    color: string;
    review_text: string;
    review_link: string;
  };
  isActive?: boolean;
  index?: number;
  opacity?: number;
              scale?: number;
              rotateY?: number;
              translateX?: number;
              zIndex?: number;
              shadow?: string;
}

export const ReviewCard = ({ review, isActive = true, index = 0, opacity,scale,rotateY, translateX , zIndex,shadow}: ReviewCardProps) => {
  // const opacity = isActive ? 1 : 0.4;
  // const scale = isActive ? 1 : 0.9;
  // const zIndex = isActive ? 10 : 1;
  // const shadow = isActive ? "0 4px 16px rgba(0,0,0,0.1)" : "0 2px 8px rgba(0,0,0,0.04)";

  return (
    <a
      key={`${review.author_id}-${index}`}
      href={review.review_link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative flex flex-col items-center transition-all duration-500 cursor-pointer hover:shadow-xl"
      )}
          style={{
        boxShadow: shadow,
        // Mismo redondeo que los banners. No tenia ninguno, por eso resaltaba
        // como la unica esquina viva de la seccion.
        borderRadius: 24,
        border: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "24px 16px",
        height: "340px",
        maxWidth: "280px",
        width: "100%",
        opacity,
        zIndex,
        transform: `
  perspective(1200px)
  translateX(${translateX}px)
  scale(${scale})
  rotateY(${rotateY}deg)
`,
transition: `
  transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
  box-shadow 0.4s ease,
  opacity 0.4s ease
`,
      }}
    >
      {/* Avatar con inicial */}
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-3",
          review.color
        )}
        style={{
          fontFamily: "Samsung Sharp Sans, sans-serif",
          fontSize: "1.35rem",
        }}
      >
        {review.initial}
      </div>

      {/* Nombre */}
      <div
        className="font-bold text-gray-800 mb-2 text-center text-lg"
        style={{
          fontFamily: "Samsung Sharp Sans, sans-serif",
          fontSize: "1.15rem",
        }}
      >
        {review.firstName}
      </div>

      {/* Estrellas */}
      <div className="flex justify-center mb-3">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            width="24"
            height="24"
            fill="#FFD700"
            stroke="#FFD700"
            strokeWidth="1"
            viewBox="0 0 24 24"
            className="mx-0.5"
          >
            <polygon points="12,2 15,8.5 22,9.3 17,14.1 18.5,21 12,17.7 5.5,21 7,14.1 2,9.3 9,8.5" />
          </svg>
        ))}
      </div>

      {/* Texto de la reseña */}
      <div
        className="text-base text-gray-700 text-center leading-relaxed mt-2 overflow-hidden"
        style={{
          fontFamily: "Samsung Sharp Sans, sans-serif",
          fontSize: "1.08rem",
          marginTop: 8,
          lineHeight: 1.4,
          maxWidth: 260,
          height: "120px",
          display: "-webkit-box",
          WebkitLineClamp: 5,
          WebkitBoxOrient: "vertical",
          textOverflow: "ellipsis",
        }}
      >
        {review.review_text}
      </div>
    </a>
  );
};
