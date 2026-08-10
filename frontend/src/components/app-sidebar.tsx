"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  ChevronDownIcon,
  Setting07Icon,
  Logout01Icon,
  Cancel01Icon,
  Delete02Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";
import { Wordmark } from "@/components/wordmark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChats, refreshChats } from "@/lib/chats-store";
import { deleteChat } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { chats, loading, error } = useChats();
  const pathname = usePathname();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshChats();
    return () => {
      if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
    };
  }, []);

  async function handleDelete(e: React.MouseEvent, chatId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;

    // First click arms the row (visual warning, no data lost yet); a second
    // click on the same row within the window actually deletes. Matches the
    // same pattern used on the meeting detail page's delete button.
    if (armedId !== chatId) {
      if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
      setArmedId(chatId);
      armTimeoutRef.current = setTimeout(() => setArmedId(null), 4000);
      return;
    }

    if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
    setArmedId(null);
    setDeletingId(chatId);
    try {
      await deleteChat(chatId);
      await refreshChats();
      if (pathname === `/chats/${chatId}`) router.push("/");
    } catch {
      // Best-effort: the list simply won't reflect the deletion. Nothing
      // destructive happened locally, so a silent retry-on-next-refresh is fine.
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col bg-sidebar",
        "transition-transform duration-200 ease-out motion-reduce:transition-none",
        "md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <Wordmark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground md:hidden"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="px-4">
        <Link
          href="/"
          onClick={onClose}
          className="flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={15} strokeWidth={2} />
          New meeting
        </Link>
      </div>

      <div className="mt-7 flex min-h-0 flex-1 flex-col px-4">
        <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          MEETINGS
        </span>
        <ScrollArea className="mt-2 -mx-1 flex-1 px-1">
          {loading ? (
            <ul className="flex flex-col gap-0.5 pb-4">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-2.5 py-2">
                  <div className="h-3 w-4/5 animate-pulse rounded-sm bg-sidebar-accent motion-reduce:animate-none" />
                  <div className="mt-1.5 h-2.5 w-1/3 animate-pulse rounded-sm bg-sidebar-accent motion-reduce:animate-none" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="flex flex-col items-start gap-2 px-2.5 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} />
                Couldn&apos;t load meetings
              </span>
              <button
                type="button"
                onClick={() => refreshChats()}
                className="text-[11px] text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : chats.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              No meetings yet — process one to see it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5 pb-4">
              {chats.map((chat) => {
                const href = `/chats/${chat.id}`;
                const active = pathname === href;
                return (
                  <li key={chat.id}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left transition-colors",
                        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full transition-colors",
                          active ? "bg-primary" : "bg-transparent"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-sidebar-foreground">
                          {chat.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatRelativeTime(chat.updated_at)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={armedId === chat.id ? `Confirm delete ${chat.title}` : `Delete ${chat.title}`}
                        title={armedId === chat.id ? "Click again to delete" : undefined}
                        onClick={(e) => handleDelete(e, chat.id)}
                        disabled={deletingId === chat.id}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors disabled:opacity-50",
                          armedId === chat.id
                            ? "bg-destructive/15 text-destructive opacity-100"
                            : "text-muted-foreground opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        )}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={2} />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>

      <div className="border-t border-sidebar-border px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60"
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground">
                  D
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground">
                Demo User
              </span>
              <HugeiconsIcon
                icon={ChevronDownIcon}
                size={14}
                strokeWidth={2}
                className="shrink-0 text-muted-foreground"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>
              <HugeiconsIcon icon={Setting07Icon} size={15} strokeWidth={2} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <HugeiconsIcon icon={Logout01Icon} size={15} strokeWidth={2} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
