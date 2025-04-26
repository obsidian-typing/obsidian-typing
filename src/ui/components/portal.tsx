import { Ref, RefObject } from "preact";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

type PortalContextType = {
    node: HTMLElement | null;
    setNode: (node: HTMLElement | null) => void;
};

const PortalContext = createContext<PortalContextType | null>(null);
export const Portal = {
    Scope: ({ children }: { children: React.ReactNode }) => {
        const [node, setNode] = useState<HTMLElement | null>(null);

        return <PortalContext.Provider value={{ node, setNode }}>{children}</PortalContext.Provider>;
    },
    Receiver: ({ receiverRef }: { receiverRef?: RefObject<HTMLDivElement | null> }) => {
        const { node, setNode } = useContext(PortalContext)!;
        receiverRef = receiverRef ?? useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (receiverRef.current && !node) {
                setNode(receiverRef.current);
            }
            return () => {
                if (node === receiverRef.current) {
                    setNode(null);
                }
            };
        }, []);

        return <div ref={receiverRef as Ref<HTMLDivElement>}></div>;
    },
    Sender: React.memo(({ children }: { children: React.ReactNode }) => {
        const portalContext = useContext(PortalContext);

        if (!portalContext?.node) return children;

        return ReactDOM.createPortal(children, portalContext.node);
    }),
};
