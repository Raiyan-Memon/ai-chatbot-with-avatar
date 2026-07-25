"use client";

import { useEffect, useRef, useState } from "react";

// `createMediaElementSource` may only ever be called once for a given element —
// a second call throws. React Strict Mode runs effects twice in development, and
// the element also survives remounts, so the graph is cached against the node
// itself rather than rebuilt.
const graphs = new WeakMap();

function getGraph(element) {
  let graph = graphs.get(element);

  if (!graph) {
    const context = new AudioContext();
    const analyser = context.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;

    context
      .createMediaElementSource(element)
      .connect(analyser)
      // Routing the analyser on to the destination is what keeps the audio
      // audible. Without it the element "plays" in silence.
      .connect(context.destination);

    graph = { context, analyser };
    graphs.set(element, graph);
  }

  return graph;
}

/**
 * Taps the audio coming out of an <audio> element so it can be measured while
 * it plays. Returns the AnalyserNode once the graph exists, plus a `resume`
 * to call from a click — browsers start every AudioContext suspended.
 */
export function useAudioAnalyser(audioRef) {
  const [analyser, setAnalyser] = useState(null);
  const contextRef = useRef(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const graph = getGraph(element);

    contextRef.current = graph.context;
    setAnalyser(graph.analyser);
  }, [audioRef]);

  async function resume() {
    const context = contextRef.current;
    if (context?.state === "suspended") await context.resume();
  }

  return { analyser, resume };
}
