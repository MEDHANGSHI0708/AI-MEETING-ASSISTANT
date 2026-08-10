import { cn } from "@/lib/utils";

// Deterministic star field so server and client render identical markup — no Math.random().
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  top: number;
  left: number;
  size: number;
  opacity: number;
  pulse: boolean;
  delay: number;
  duration: number;
};

const STAR_COUNT = 46;

function generateStars(): Star[] {
  const rand = mulberry32(1337);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      top: rand() * 100,
      left: rand() * 100,
      size: 1 + rand() * 1.4,
      opacity: 0.15 + rand() * 0.45,
      pulse: rand() < 0.22,
      delay: rand() * 8,
      duration: 5 + rand() * 5,
    });
  }
  return stars;
}

const stars = generateStars();

export function GalaxyBackground({ nebula = false }: { nebula?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      {nebula && (
        <div
          className="absolute -top-[8%] -right-[6%] h-[55vmax] w-[55vmax] rounded-full opacity-[0.22] blur-[110px]"
          style={{
            background:
              "radial-gradient(circle, var(--nebula) 0%, transparent 68%)",
          }}
        />
      )}
      {stars.map((star, i) => (
        <span
          key={i}
          className={cn(
            "absolute rounded-full bg-star",
            star.pulse && "animate-star-pulse motion-reduce:animate-none"
          )}
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.pulse ? `${star.delay}s` : undefined,
            animationDuration: star.pulse ? `${star.duration}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
