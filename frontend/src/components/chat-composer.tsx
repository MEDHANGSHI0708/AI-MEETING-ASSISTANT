"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useAutoGrowComposer } from "@/components/composer/use-auto-grow-composer";
import { cn } from "@/lib/utils";

export type ChatComposerHandle = { focus: () => void };

type ChatComposerProps = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({ onSubmit, disabled, placeholder }, ref) {
    const [value, setValue] = useState("");
    const { formRef, textareaRef, expanded, resize, collapse } = useAutoGrowComposer();

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    function submit() {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
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

    const canSend = value.trim().length > 0 && !disabled;

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
          placeholder={placeholder ?? "Ask about this meeting…"}
          className={cn(
            "min-w-0 flex-1 resize-none bg-transparent py-0.5 text-sm leading-6",
            "text-foreground placeholder:text-muted-foreground focus:outline-none",
            "transition-[height] duration-200 ease-out-quart motion-reduce:transition-none",
            "disabled:opacity-50"
          )}
          style={{ maxHeight: 200, overflowY: "hidden" }}
        />

        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:bg-secondary disabled:text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={2.2} />
        </button>
      </form>
    );
  }
);
