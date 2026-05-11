import type { ReactNode } from "react";

interface TooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}

const positionClasses = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left:   "right-full top-1/2 -translate-y-1/2 mr-2",
  right:  "left-full top-1/2 -translate-y-1/2 ml-2",
};

export default function Tooltip({ content, position = "top", children, className = "" }: TooltipProps) {
  return (
    <div className={`relative group inline-flex ${className}`}>
      {children}
      <div
        className={`absolute ${positionClasses[position]} z-50 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                    max-w-[220px] text-center leading-snug whitespace-normal`}
      >
        {content}
      </div>
    </div>
  );
}
