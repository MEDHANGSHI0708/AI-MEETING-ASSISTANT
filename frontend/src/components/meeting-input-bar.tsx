"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Mic01Icon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutoGrowComposer } from "@/components/composer/use-auto-grow-composer";
import type { Language } from "@/lib/api";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "english", label: "English" },
  { value: "hinglish", label: "Hinglish" },
];

export type MeetingInputBarHandle = { focus: () => void };

type MeetingInputBarProps = {
  onSubmit: (value: string, language: Language) => void;
  onAttachClick?: () => void;
  disabled?: boolean;
};

export const MeetingInputBar = forwardRef<MeetingInputBarHandle, MeetingInputBarProps>(
  function MeetingInputBar({ onSubmit, onAttachClick, disabled }, ref) {
    const [value, setValue] = useState("");
    const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>(LANGUAGES[0]);
    const { formRef, textareaRef, expanded, resize, collapse } = useAutoGrowComposer();

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    function submit() {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed, language.value);
      setValue("");
      collapse();
    }

    function handleSubmit(e: FormEvent) {
      e.preventDefault();
      submit();
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    }

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        data-expanded={expanded}
        className={cn(
          "flex items-end gap-2 rounded-full border bg-card px-4 py-3 shadow-sm",
          "border-border focus-within:border-input",
          "transition-[border-radius,border-color] duration-200 ease-out-quart motion-reduce:transition-none"
        )}
      >
        <button
          type="button"
          aria-label="Upload a recording"
          onClick={onAttachClick}
          disabled={disabled}
          className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Paste a YouTube link, or ask about a meeting…"
          className={cn(
            "min-w-0 flex-1 resize-none bg-transparent py-0.5 text-sm leading-6",
            "text-foreground placeholder:text-muted-foreground focus:outline-none",
            "transition-[height] duration-200 ease-out-quart motion-reduce:transition-none",
            "disabled:opacity-50"
          )}
          style={{ maxHeight: 200, overflowY: "hidden" }}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
                "transition-colors hover:border-input hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {language.label}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem key={lang.value} onSelect={() => setLanguage(lang)}>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          aria-label="Record audio"
          disabled={disabled}
          className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <HugeiconsIcon icon={Mic01Icon} size={16} strokeWidth={2} />
        </button>
      </form>
    );
  }
);
