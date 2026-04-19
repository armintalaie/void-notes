import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { TbChevronRight } from "react-icons/tb";

export type DropdownItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  children?: DropdownItem[];
};

type CustomDropdownProps = {
  label: string;
  items: DropdownItem[];
  onAction?: (item: DropdownItem) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerContent?: ReactNode;
  triggerAriaLabel?: string;
  triggerBare?: boolean;
  rootClassName?: string;
  rootStyle?: CSSProperties;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

type PopoverWithSource = HTMLElement & {
  showPopover: (options?: { source?: HTMLElement }) => void;
};

function showPopoverCompat(
  popover: HTMLElement,
  source?: HTMLElement,
): void {
  try {
    (popover as PopoverWithSource).showPopover(
      source ? { source } : undefined,
    );
    return;
  } catch {
    // Fall through to no-arg invocation for browsers that don't support options.
  }

  try {
    popover.showPopover();
  } catch {
    // Ignore if popover is already open or not available.
  }
}

function toStableId(value: string): string {
  return value.replaceAll(":", "");
}

function closeOpenMenus(ownerId: string): void {
  const selector = `[data-dropdown-owner="${ownerId}"]:popover-open`;

  document.querySelectorAll<HTMLElement>(selector).forEach((popover) => {
    try {
      popover.hidePopover();
    } catch {
      // If a popover closes between query and hide call, ignore safely.
    }
  });
}

function positionPopover(
  invoker: HTMLElement,
  popover: HTMLElement,
  placement: "root" | "submenu",
): void {
  popover.style.position = "fixed";
  popover.style.inset = "auto";

  const viewportPadding = 10;
  const rootGap = 2;
  const submenuGap = 6;

  requestAnimationFrame(() => {
    if (!popover.matches(":popover-open")) {
      return;
    }

    const invokerRect = invoker.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const maxX = globalThis.innerWidth - popoverRect.width - viewportPadding;
    const maxY = globalThis.innerHeight - popoverRect.height - viewportPadding;
    let targetX = invokerRect.left;
    let targetY = invokerRect.bottom + rootGap;
    let sideX: "left" | "right" = "left";
    let sideY: "top" | "bottom" = "bottom";

    if (placement === "root") {
      const startAlignedX = invokerRect.left;
      const endAlignedX = invokerRect.right - popoverRect.width;
      const startFits = startAlignedX + popoverRect.width <=
        globalThis.innerWidth - viewportPadding;
      const endFits = endAlignedX >= viewportPadding;

      if (!startFits && endFits) {
        targetX = endAlignedX;
        sideX = "right";
      } else if (!startFits && !endFits) {
        const spaceAtStart = globalThis.innerWidth - invokerRect.left -
          viewportPadding;
        const spaceAtEnd = invokerRect.right - viewportPadding;
        if (spaceAtEnd > spaceAtStart) {
          targetX = endAlignedX;
          sideX = "right";
        } else {
          targetX = startAlignedX;
          sideX = "left";
        }
      } else {
        targetX = startAlignedX;
      }

      const belowY = invokerRect.bottom + rootGap;
      const aboveY = invokerRect.top - popoverRect.height - rootGap;
      const belowFits =
        belowY + popoverRect.height <= globalThis.innerHeight - viewportPadding;
      const aboveFits = aboveY >= viewportPadding;

      if (!belowFits && aboveFits) {
        targetY = aboveY;
        sideY = "top";
      } else if (!belowFits && !aboveFits) {
        const spaceBelow = globalThis.innerHeight - invokerRect.bottom -
          viewportPadding;
        const spaceAbove = invokerRect.top - viewportPadding;
        if (spaceAbove > spaceBelow) {
          targetY = aboveY;
          sideY = "top";
        } else {
          targetY = belowY;
          sideY = "bottom";
        }
      } else {
        targetY = belowY;
      }
    } else {
      const openRightX = invokerRect.right + submenuGap;
      const openLeftX = invokerRect.left - popoverRect.width - submenuGap;
      const spaceRight = globalThis.innerWidth - invokerRect.right -
        viewportPadding;
      const spaceLeft = invokerRect.left - viewportPadding;
      const preferRight = spaceRight >= popoverRect.width + submenuGap ||
        spaceRight >= spaceLeft;

      if (preferRight) {
        targetX = openRightX;
        sideX = "right";
      } else {
        targetX = openLeftX;
        sideX = "left";
      }

      const topAlignedY = invokerRect.top - 2;
      const bottomAlignedY = invokerRect.bottom - popoverRect.height + 2;
      const topFits = topAlignedY >= viewportPadding &&
        topAlignedY + popoverRect.height <=
          globalThis.innerHeight - viewportPadding;
      const bottomFits = bottomAlignedY >= viewportPadding &&
        bottomAlignedY + popoverRect.height <=
          globalThis.innerHeight - viewportPadding;

      if (!topFits && bottomFits) {
        targetY = bottomAlignedY;
        sideY = "bottom";
      } else if (!topFits && !bottomFits) {
        const spaceBelow = globalThis.innerHeight - invokerRect.bottom -
          viewportPadding;
        const spaceAbove = invokerRect.top - viewportPadding;
        if (spaceAbove > spaceBelow) {
          targetY = bottomAlignedY;
          sideY = "bottom";
        } else {
          targetY = topAlignedY;
          sideY = "top";
        }
      } else {
        targetY = topAlignedY;
        sideY = "top";
      }
    }

    const clampedX = Math.max(viewportPadding, Math.min(targetX, maxX));
    const clampedY = Math.max(viewportPadding, Math.min(targetY, maxY));

    popover.style.left = `${clampedX}px`;
    popover.style.top = `${clampedY}px`;
    popover.dataset.sideX = sideX;
    popover.dataset.sideY = sideY;
  });
}

type DropdownListProps = {
  ownerId: string;
  items: DropdownItem[];
  path: number[];
  onAction?: (item: DropdownItem) => void;
  scheduleOpenSubmenu: (
    submenuId: string,
    trigger: HTMLButtonElement,
  ) => void;
  scheduleCloseSubmenu: (submenuId: string) => void;
  cancelCloseSubmenu: (submenuId: string) => void;
};

function DropdownList({
  ownerId,
  items,
  path,
  onAction,
  scheduleOpenSubmenu,
  scheduleCloseSubmenu,
  cancelCloseSubmenu,
}: DropdownListProps) {
  const pathId = path.join("-");

  return (
    <ul className="dropdown-list" role="menu" aria-label={`Menu ${pathId}`}>
      {items.map((item, index) => {
        const itemPath = [...path, index];
        const hasChildren = Boolean(item.children?.length);
        const submenuId = `dropdown-${ownerId}-${itemPath.join("-")}`;

        const handleAction = (event: React.MouseEvent<HTMLButtonElement>) => {
          if (item.disabled) {
            return;
          }

          if (hasChildren) {
            const trigger = event.currentTarget;
            const popover = document.getElementById(submenuId);

            if (!(popover instanceof HTMLElement)) {
              return;
            }

            positionPopover(trigger, popover, "submenu");
            return;
          }

          onAction?.(item);
          closeOpenMenus(ownerId);
        };

        return (
          <li className="dropdown-item" key={item.id} role="none">
            <button
              type="button"
              className="dropdown-entry"
              disabled={item.disabled}
              role="menuitem"
              aria-haspopup={hasChildren ? "menu" : undefined}
              aria-label={item.label}
              popoverTarget={hasChildren ? submenuId : undefined}
              popoverTargetAction={hasChildren ? "show" : undefined}
              onPointerEnter={(event) => {
                if (!hasChildren || item.disabled) {
                  return;
                }

                scheduleOpenSubmenu(submenuId, event.currentTarget);
              }}
              onPointerLeave={() => {
                if (!hasChildren) {
                  return;
                }

                scheduleCloseSubmenu(submenuId);
              }}
              onClick={handleAction}
            >
              {item.icon
                ? <span className="dropdown-entry-icon">{item.icon}</span>
                : null}
              <span className="dropdown-entry-label">{item.label}</span>
              {item.shortcut
                ? <span className="dropdown-shortcut">{item.shortcut}</span>
                : null}
              {hasChildren
                ? (
                  <TbChevronRight
                    className="dropdown-chevron"
                    aria-hidden="true"
                  />
                )
                : null}
            </button>

            {hasChildren
              ? (
                <div
                  id={submenuId}
                  popover="auto"
                  className="dropdown-menu dropdown-menu--submenu"
                  data-dropdown-owner={ownerId}
                  onPointerEnter={() => cancelCloseSubmenu(submenuId)}
                  onPointerLeave={() =>
                    scheduleCloseSubmenu(submenuId)}
                >
                  <DropdownList
                    ownerId={ownerId}
                    items={item.children ?? []}
                    path={itemPath}
                    onAction={onAction}
                    scheduleOpenSubmenu={scheduleOpenSubmenu}
                    scheduleCloseSubmenu={scheduleCloseSubmenu}
                    cancelCloseSubmenu={cancelCloseSubmenu}
                  />
                </div>
              )
              : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CustomDropdown({
  label,
  items,
  onAction,
  open,
  onOpenChange,
  triggerContent,
  triggerAriaLabel,
  triggerBare,
  rootClassName,
  rootStyle,
  triggerClassName,
  triggerStyle,
}: CustomDropdownProps) {
  const ownerId = toStableId(useId());
  const rootPopoverId = `dropdown-root-${ownerId}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootPopoverRef = useRef<HTMLDivElement | null>(null);
  const openTimersRef = useRef<Map<string, number>>(new Map());
  const closeTimersRef = useRef<Map<string, number>>(new Map());

  const clearTimer = (store: Map<string, number>, key: string): void => {
    const timer = store.get(key);

    if (typeof timer !== "number") {
      return;
    }

    globalThis.clearTimeout(timer);
    store.delete(key);
  };

  const cancelCloseSubmenu = (submenuId: string): void => {
    clearTimer(closeTimersRef.current, submenuId);
  };

  const openSubmenu = (
    submenuId: string,
    trigger: HTMLButtonElement,
  ): void => {
    clearTimer(openTimersRef.current, submenuId);
    clearTimer(closeTimersRef.current, submenuId);

    const popover = document.getElementById(submenuId);

    if (!(popover instanceof HTMLElement)) {
      return;
    }

    showPopoverCompat(popover, trigger);
    positionPopover(trigger, popover, "submenu");
  };

  const closeSubmenu = (submenuId: string): void => {
    clearTimer(openTimersRef.current, submenuId);
    clearTimer(closeTimersRef.current, submenuId);

    const popover = document.getElementById(submenuId);

    if (
      !(popover instanceof HTMLElement) || !popover.matches(":popover-open")
    ) {
      return;
    }

    try {
      popover.hidePopover();
    } catch {
      // Ignore if submenu closes before hide executes.
    }
  };

  const scheduleOpenSubmenu = (
    submenuId: string,
    trigger: HTMLButtonElement,
  ): void => {
    clearTimer(closeTimersRef.current, submenuId);
    clearTimer(openTimersRef.current, submenuId);

    const timer = globalThis.setTimeout(
      () => openSubmenu(submenuId, trigger),
      90,
    );
    openTimersRef.current.set(submenuId, timer);
  };

  const scheduleCloseSubmenu = (submenuId: string): void => {
    clearTimer(openTimersRef.current, submenuId);
    clearTimer(closeTimersRef.current, submenuId);

    const timer = globalThis.setTimeout(() => closeSubmenu(submenuId), 130);
    closeTimersRef.current.set(submenuId, timer);
  };

  useEffect(() => {
    return () => {
      openTimersRef.current.forEach((timer) => globalThis.clearTimeout(timer));
      closeTimersRef.current.forEach((timer) => globalThis.clearTimeout(timer));
      openTimersRef.current.clear();
      closeTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const popover = rootPopoverRef.current;
    const trigger = triggerRef.current;

    if (
      !(popover instanceof HTMLElement) || !(trigger instanceof HTMLElement)
    ) {
      return;
    }

    if (open) {
      showPopoverCompat(popover, trigger);
      positionPopover(trigger, popover, "root");

      return;
    }

    if (popover.matches(":popover-open")) {
      try {
        popover.hidePopover();
      } catch {
        // Ignore if closed between checks.
      }
    }
  }, [open]);

  useEffect(() => {
    const popover = rootPopoverRef.current;
    if (!(popover instanceof HTMLElement) || !onOpenChange) {
      return;
    }

    const handleToggle = () => {
      onOpenChange(popover.matches(":popover-open"));
    };

    popover.addEventListener("toggle", handleToggle);

    return () => {
      popover.removeEventListener("toggle", handleToggle);
    };
  }, [onOpenChange]);

  const handleRootTriggerClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const trigger = event.currentTarget;
    const popover = document.getElementById(rootPopoverId);

    if (!(popover instanceof HTMLElement)) {
      return;
    }

    positionPopover(trigger, popover, "root");
  };

  return (
    <div
      className={["dropdown-root", rootClassName].filter(Boolean).join(" ")}
      style={rootStyle}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerBare
          ? triggerClassName
          : ["dropdown-trigger", triggerClassName].filter(Boolean).join(" ")}
        popoverTarget={rootPopoverId}
        popoverTargetAction="toggle"
        aria-haspopup="menu"
        aria-label={triggerAriaLabel ?? label}
        onClick={handleRootTriggerClick}
        style={triggerStyle}
      >
        {triggerContent ?? label}
      </button>

      <div
        ref={rootPopoverRef}
        id={rootPopoverId}
        popover="auto"
        className="dropdown-menu dropdown-menu--root"
        data-dropdown-owner={ownerId}
      >
        <DropdownList
          ownerId={ownerId}
          items={items}
          path={[0]}
          onAction={onAction}
          scheduleOpenSubmenu={scheduleOpenSubmenu}
          scheduleCloseSubmenu={scheduleCloseSubmenu}
          cancelCloseSubmenu={cancelCloseSubmenu}
        />
      </div>
    </div>
  );
}
