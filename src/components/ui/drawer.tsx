"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

type DrawerContextValue = {
  modal: DrawerPrimitive.Root.Props["modal"];
  showSwipeHandle: boolean;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function Drawer({
  modal = true,
  showSwipeHandle = false,
  swipeDirection = "down",
  ...props
}: DrawerPrimitive.Root.Props & { showSwipeHandle?: boolean }) {
  const contextValue = React.useMemo(
    () => ({ modal, showSwipeHandle }),
    [modal, showSwipeHandle],
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  const context = React.useContext(DrawerContext);
  if (!context) throw new Error("DrawerContent must be used inside Drawer.");

  return (
    <DrawerPrimitive.Portal data-slot="drawer-portal">
      {context.modal === true && (
        <DrawerPrimitive.Backdrop
          data-slot="drawer-overlay"
          className="transaction-drawer-overlay"
        />
      )}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={context.modal}
        className="transaction-drawer-viewport"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis="y"
          className={`transaction-drawer-popup${className ? ` ${className}` : ""}`}
          {...props}
        >
          {context.showSwipeHandle && (
            <div className="transaction-drawer-handle" aria-hidden="true" />
          )}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className="transaction-drawer-content"
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

function DrawerTitle(props: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title data-slot="drawer-title" {...props} />;
}

function DrawerDescription(props: DrawerPrimitive.Description.Props) {
  return <DrawerPrimitive.Description data-slot="drawer-description" {...props} />;
}

export { Drawer, DrawerContent, DrawerDescription, DrawerTitle };
