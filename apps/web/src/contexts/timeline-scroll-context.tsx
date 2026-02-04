"use client";

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
	type RefObject,
} from "react";

interface TimelineScrollContextValue {
	scrollLeft: number;
}

const TimelineScrollContext = createContext<TimelineScrollContextValue>({
	scrollLeft: 0,
});

export function useTimelineScroll() {
	return useContext(TimelineScrollContext);
}

interface TimelineScrollProviderProps {
	children: ReactNode;
	scrollRef: RefObject<HTMLDivElement | null>;
}

export function TimelineScrollProvider({
	children,
	scrollRef,
}: TimelineScrollProviderProps) {
	const [scrollLeft, setScrollLeft] = useState(0);

	const handleScroll = useCallback(() => {
		if (scrollRef.current) {
			setScrollLeft(scrollRef.current.scrollLeft);
		}
	}, [scrollRef]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		// Set initial scroll position
		setScrollLeft(element.scrollLeft);

		// Add scroll listener
		element.addEventListener("scroll", handleScroll);

		return () => {
			element.removeEventListener("scroll", handleScroll);
		};
	}, [scrollRef, handleScroll]);

	return (
		<TimelineScrollContext.Provider value={{ scrollLeft }}>
			{children}
		</TimelineScrollContext.Provider>
	);
}
