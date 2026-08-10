import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileNotFoundIcon } from "@hugeicons/core-free-icons";

export function NotFoundPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <HugeiconsIcon icon={FileNotFoundIcon} size={28} strokeWidth={1.6} className="text-muted-foreground" />
      <h1 className="mt-4 text-lg font-medium text-foreground">{title}</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back home
      </Link>
    </div>
  );
}
