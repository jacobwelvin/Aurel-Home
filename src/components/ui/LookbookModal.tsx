"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Play, Film, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export function LookbookModal() {
  const { isLookbookOpen, setLookbookOpen } = useUIStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!isLookbookOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#18181B]/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={() => setLookbookOpen(false)}
      />

      <div className="relative w-full max-w-4xl bg-[#18181B] text-white rounded-xl shadow-2xl overflow-hidden z-10 border border-white/10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-4 bg-[#18181B] flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#FFDBD0] font-semibold">
            <Film className="w-4 h-4 text-[#C25E3E]" />
            <span>AUREL 2026 Narrative Cinema • Kyoto & Flanders</span>
          </div>
          <button
            type="button"
            onClick={() => setLookbookOpen(false)}
            className="p-1 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas / Simulator */}
        <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center group">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI4M8WNezAKqjlEehPib9JRCI-QezeerVraHuY9JTwfuTivvSw4zoNgED8AzBEBjrUSBCg5BiJ-I6Nur0gEZAujKWJoBiD-WSBgBxKIbhk7X7p8k3J7_ljJeWQVTUctwG5Nbfm7mfoxIwhGmxC71Rx-3rJjqVpMiktOYYPSm8492BbHGtnVI4zk1FayHCRt4dsawrkIVTauNaX5TNsiTNmuw9SUlQjm-8BLs4OwyXAurSkLdKkZdYkTA"
            alt="Lookbook 35mm film still"
            fill
            className={`object-cover transition-all duration-700 ${isPlaying ? "scale-105 opacity-90" : "opacity-60"}`}
          />

          {!isPlaying ? (
            <div className="relative z-10 flex flex-col items-center text-center p-6">
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="w-16 h-16 rounded-full bg-white text-[#18181B] shadow-2xl flex items-center justify-center hover:scale-110 transition-transform mb-4"
                aria-label="Play lookbook film"
              >
                <Play className="w-7 h-7 text-[#C25E3E] fill-current ml-1" />
              </button>
              <h3 className="font-serif text-2xl sm:text-3xl font-normal tracking-wide text-white">
                &ldquo;The Architecture of Stillness&rdquo;
              </h3>
              <p className="text-xs text-white/80 mt-2 font-sans tracking-wider uppercase">
                Directed on 35mm stock • Original score by Ryuichi Sakamoto Archive
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-black/80 via-transparent to-black/30">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-white/90">
                  <Sparkles className="w-3.5 h-3.5 text-[#C25E3E]" /> 35mm Film Archive In Playback
                </span>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <div className="text-center">
                <p className="font-serif text-xl sm:text-2xl text-white">
                  &ldquo;When wood is cut with humility, it breathes for centuries.&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setIsPlaying(false)}
                  className="mt-4 text-xs tracking-widest uppercase bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-full transition-colors"
                >
                  Pause Cinema
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#18181B] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-white/70 gap-2">
          <span>Captured in Kyoto Sashimono ateliers and Ghent linen mills.</span>
          <button
            type="button"
            onClick={() => setLookbookOpen(false)}
            className="text-xs uppercase tracking-wider text-[#FFDBD0] hover:text-white transition-colors"
          >
            Return to Collection →
          </button>
        </div>
      </div>
    </div>
  );
}
