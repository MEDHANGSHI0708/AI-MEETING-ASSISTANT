import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Link01Icon,
  Upload04Icon,
  BubbleChatQuestionIcon,
  CheckListIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

export type SuggestedActionId = "paste-link" | "upload" | "ask-past" | "action-items";

type Action = {
  id: SuggestedActionId;
  icon: IconSvgElement;
  label: string;
};

const actions: Action[] = [
  { id: "paste-link", icon: Link01Icon, label: "Paste a YouTube link" },
  { id: "upload", icon: Upload04Icon, label: "Upload a recording" },
  { id: "ask-past", icon: BubbleChatQuestionIcon, label: "Ask about a past meeting" },
  { id: "action-items", icon: CheckListIcon, label: "Review action items" },
];

export function SuggestedActions({
  onAction,
}: {
  onAction: (id: SuggestedActionId) => void;
}) {
  return (
    <div>
      <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        SUGGESTED
      </span>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            className="group flex w-full items-center gap-3 bg-card px-4 py-3.5 text-left transition-colors hover:bg-secondary"
          >
            <HugeiconsIcon
              icon={action.icon}
              size={17}
              strokeWidth={1.8}
              className="shrink-0 text-primary"
            />
            <span className="flex-1 text-sm text-foreground">
              {action.label}
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={16}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
