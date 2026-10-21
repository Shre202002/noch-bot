
"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Portal } from "@ark-ui/react/portal";
import { ColorPicker, parseColor, ColorPickerValueChangeDetails, type Color } from "@ark-ui/react/color-picker";
import { PipetteIcon } from "lucide-react";
import { createFrameThrottle, normalizeHex } from "@/lib/colorInput";

export interface BasicColorPickerProps {
  value: string;
  onValueChange: (details: ColorPickerValueChangeDetails) => void;
}

export function BasicColorPicker({ value, onValueChange }: BasicColorPickerProps) {
  const safeValue = value ? parseColor(value) : parseColor("#000000");

  return (
    <div className="w-fit">
      <ColorPicker.Root value={safeValue} onValueChange={onValueChange}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ColorPicker.Control className="hidden sm:block flex-1 min-w-24">
              <ColorPicker.ChannelInput
                channel="hex"
                className="w-full px-3 py-1.5 text-xs border border-white/10 rounded-md bg-black/40 text-white focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </ColorPicker.Control>
            <ColorPicker.Trigger className="w-10 h-8 rounded-md border-2 border-white/10 overflow-hidden cursor-pointer hover:border-white/20 transition-colors">
              <ColorPicker.TransparencyGrid className="w-full h-full [--size:6px] opacity-50" />
              <ColorPicker.ValueSwatch className="w-full h-full" />
            </ColorPicker.Trigger>
          </div>

          <Portal>
            <ColorPicker.Positioner>
              <ColorPicker.Content className="bg-[#1f2228] border border-[#2a2d35] rounded-lg p-4 shadow-2xl space-y-4 z-50 w-72">
                <ColorPicker.Area className="w-full h-32 rounded-md overflow-hidden relative">
                  <ColorPicker.AreaBackground className="w-full h-full" />
                  <ColorPicker.AreaThumb className="absolute w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-x-1/2 -translate-y-1/2" />
                </ColorPicker.Area>

                <div className="flex items-center gap-3">
                  <ColorPicker.EyeDropperTrigger className="p-2 text-gray-400 hover:text-white border border-[#2a2d35] rounded-md hover:bg-[#2a2d35] transition-colors">
                    <PipetteIcon className="w-4 h-4" />
                  </ColorPicker.EyeDropperTrigger>

                  <div className="flex-1 space-y-2">
                    <ColorPicker.ChannelSlider
                      channel="hue"
                      className="relative w-full h-2 rounded-full overflow-hidden"
                    >
                      <ColorPicker.ChannelSliderTrack className="w-full h-full bg-linear-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500" />
                      <ColorPicker.ChannelSliderThumb className="absolute top-1/2 w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-y-1/2 -translate-x-1/2" />
                    </ColorPicker.ChannelSlider>

                    <ColorPicker.ChannelSlider
                      channel="alpha"
                      className="relative w-full h-2 rounded-full overflow-hidden"
                    >
                      <ColorPicker.TransparencyGrid className="w-full h-full [--size:8px]" />
                      <ColorPicker.ChannelSliderTrack className="w-full h-full" />
                      <ColorPicker.ChannelSliderThumb className="absolute top-1/2 w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-y-1/2 -translate-x-1/2" />
                    </ColorPicker.ChannelSlider>
                  </div>
                </div>

                <div className="flex gap-2">
                  <ColorPicker.ChannelInput
                    channel="hex"
                    className="flex-1 px-3 py-2 text-sm border border-[#2a2d35] rounded-md bg-black/40 text-white focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </ColorPicker.Content>
            </ColorPicker.Positioner>
          </Portal>
        </div>
        <ColorPicker.HiddenInput />
      </ColorPicker.Root>
    </div>
  );
}

export function InlineColorPicker({ value, onValueChange }: BasicColorPickerProps) {
  const presets = [
    "#e74c3c",
    "#f1c40f",
    "#2ecc71",
    "#1abc9c",
    "#3498db",
    "#4a90e2",
    "#5b67d1",
    "#663399",
    "#9b59b6",
    "#e91e63",
  ];

  const safeValue = value ? parseColor(value) : parseColor("#000000");

  return (
    <ColorPicker.Root value={safeValue} onValueChange={onValueChange}>
      <ColorPicker.Content className="bg-[#1f2228] border border-[#2a2d35] rounded-lg p-4 shadow-lg space-y-4 w-full max-w-sm">
        <ColorPicker.Area className="w-full h-36 rounded-md overflow-hidden relative">
          <ColorPicker.AreaBackground className="w-full h-full" />
          <ColorPicker.AreaThumb className="absolute w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-x-1/2 -translate-y-1/2" />
        </ColorPicker.Area>

        <div className="flex items-center gap-3">
          <ColorPicker.EyeDropperTrigger className="p-2 text-gray-400 hover:text-white border border-[#2a2d35] rounded-md hover:bg-[#2a2d35] transition-colors">
            <PipetteIcon className="w-4 h-4" />
          </ColorPicker.EyeDropperTrigger>

          <div className="flex-1 space-y-2">
            <ColorPicker.ChannelSlider
              channel="hue"
              className="relative w-full h-3 rounded-full overflow-hidden"
            >
              <ColorPicker.ChannelSliderTrack className="w-full h-full bg-linear-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500" />
              <ColorPicker.ChannelSliderThumb className="absolute top-1/2 w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-y-1/2 -translate-x-1/2" />
            </ColorPicker.ChannelSlider>

            <ColorPicker.ChannelSlider
              channel="alpha"
              className="relative w-full h-3 rounded-full overflow-hidden"
            >
              <ColorPicker.TransparencyGrid className="w-full h-full [--size:8px]" />
              <ColorPicker.ChannelSliderTrack className="w-full h-full" />
              <ColorPicker.ChannelSliderThumb className="absolute top-1/2 w-3 h-3 bg-white border-2 border-black rounded-full shadow-xs -translate-y-1/2 -translate-x-1/2" />
            </ColorPicker.ChannelSlider>
          </div>
        </div>

        <div className="flex gap-2">
          <ColorPicker.ChannelInput
            channel="hex"
            className="flex-1 px-3 py-2 text-sm border border-[#2a2d35] rounded-md bg-black/40 text-white focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">
            Saved Colors
          </h4>
          <ColorPicker.SwatchGroup className="grid grid-cols-5 gap-2">
            {presets.map((color) => (
              <ColorPicker.SwatchTrigger key={color} value={color}>
                <ColorPicker.Swatch
                  value={color}
                  className="w-full aspect-square rounded-md border border-white/10 cursor-pointer hover:scale-110 transition-transform"
                >
                  <ColorPicker.SwatchIndicator className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                    âœ“
                  </ColorPicker.SwatchIndicator>
                </ColorPicker.Swatch>
              </ColorPicker.SwatchTrigger>
            ))}
          </ColorPicker.SwatchGroup>
        </div>
      </ColorPicker.Content>
      <ColorPicker.HiddenInput />
    </ColorPicker.Root>
  );
}



// ── Ticket colour field ──────────────────────────────────────────────────────────────────────────────────
// Built for live editing: it keeps its own colour while someone drags (so the thumb never jumps back), reports the
// colour to the page at most once per animation frame, and reports a single "commit" when the gesture ends.

const NEUTRAL_SWATCHES = ["#FFFFFF", "#F8FAFC", "#E2E8F0", "#64748B", "#1E293B", "#0F172A", "#000000"];

const toHsb = (hex: string): Color => parseColor(normalizeHex(hex) ?? "#000000").toFormat("hsba");

export interface TicketColorFieldProps {
  label: string;
  /** The saved colour, `#RRGGBB`. Changes from outside (a new design, reset) replace the field's colour. */
  value: string;
  /** Extra quick colours, usually the current design's palette. */
  swatches?: string[];
  /** Live: at most once per frame while dragging or typing. Update the preview here. */
  onChange: (hex: string) => void;
  /** Once per finished gesture (drag released, hex typed, swatch picked). Save here. */
  onCommit: (hex: string) => void;
}

export const TicketColorField = memo(function TicketColorField({ label, value, swatches = [], onChange, onCommit }: TicketColorFieldProps) {
  // HSB keeps the hue steady when the colour passes through white, grey or black, which RGB cannot.
  const [color, setColor] = useState<Color>(() => toHsb(value));
  const [text, setText] = useState(() => normalizeHex(value) ?? value);
  const [invalid, setInvalid] = useState(false);
  const editing = useRef(false);

  // The page always sees the latest callbacks without the throttle being rebuilt.
  const callbacks = useRef({ onChange, onCommit });
  callbacks.current = { onChange, onCommit };
  const throttle = useMemo(() => createFrameThrottle<string>((hex) => callbacks.current.onChange(hex)), []);
  useEffect(() => () => throttle.cancel(), [throttle]);

  // A colour set from outside (switching design, reset) replaces ours, but never in the middle of an edit.
  useEffect(() => {
    if (editing.current) return;
    const hex = normalizeHex(value);
    if (!hex) return;
    setColor(toHsb(hex));
    setText(hex);
    setInvalid(false);
  }, [value]);

  const hexOf = (c: Color) => normalizeHex(c.toString("hex")) ?? "#000000";

  const live = (c: Color) => {
    const hex = hexOf(c);
    setColor(c);
    setText(hex);
    setInvalid(false);
    throttle.push(hex);
  };

  const commit = (c: Color) => {
    const hex = hexOf(c);
    editing.current = false;
    throttle.flush();
    setText(hex);
    callbacks.current.onCommit(hex);
  };

  const applyHex = (raw: string, finish: boolean) => {
    const hex = normalizeHex(raw);
    if (!hex) {
      if (finish) {
        setInvalid(false);
        setText(hexOf(color));
      } else {
        setInvalid(true);
      }
      return;
    }
    const next = toHsb(hex);
    if (finish) commit(next);
    else {
      editing.current = true;
      setColor(next);
      setInvalid(false);
      throttle.push(hex);
    }
  };

  const quick = Array.from(new Set([...swatches, ...NEUTRAL_SWATCHES].map((c) => normalizeHex(c)).filter((c): c is string => !!c))).slice(0, 12);
  const current = hexOf(color);

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">{label}</span>
      <ColorPicker.Root
        value={color}
        onValueChange={(details) => {
          editing.current = true;
          live(details.value);
        }}
        onValueChangeEnd={(details) => commit(details.value)}
        onOpenChange={(details) => {
          if (!details.open) editing.current = false;
        }}
        positioning={{ placement: "bottom-start", gutter: 8, flip: true, shift: 8 }}
        lazyMount
        unmountOnExit
      >
        <div className="flex items-center gap-2">
          <input
            aria-label={`${label} hex colour`}
            aria-invalid={invalid}
            value={text}
            spellCheck={false}
            maxLength={9}
            onChange={(e) => {
              setText(e.target.value);
              applyHex(e.target.value, false);
            }}
            onBlur={() => applyHex(text, true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyHex(text, true);
            }}
            className={`min-w-0 flex-1 rounded-md border bg-black/40 px-3 py-1.5 font-mono text-xs text-white focus:outline-hidden focus:ring-2 ${
              invalid ? "border-red-500/70 focus:ring-red-500/60" : "border-white/10 focus:ring-primary"
            }`}
          />
          <ColorPicker.Control>
            <ColorPicker.Trigger
              aria-label={`Pick ${label} colour`}
              className="h-8 w-10 cursor-pointer overflow-hidden rounded-md border-2 border-white/10 transition-colors hover:border-white/30"
            >
              <span className="block h-full w-full" style={{ backgroundColor: current }} />
            </ColorPicker.Trigger>
          </ColorPicker.Control>
        </div>

        <Portal>
          <ColorPicker.Positioner>
            <ColorPicker.Content className="z-50 w-64 space-y-3 rounded-xl border border-[#2a2d35] bg-[#1f2228] p-3 shadow-2xl">
              <ColorPicker.Area className="relative h-36 w-full touch-none overflow-hidden rounded-lg">
                <ColorPicker.AreaBackground className="h-full w-full" />
                <ColorPicker.AreaThumb className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />
              </ColorPicker.Area>

              <div className="flex items-center gap-3">
                <ColorPicker.EyeDropperTrigger
                  aria-label="Pick a colour from the screen"
                  className="rounded-md border border-[#2a2d35] p-2 text-gray-400 transition-colors hover:bg-[#2a2d35] hover:text-white"
                >
                  <PipetteIcon className="h-4 w-4" />
                </ColorPicker.EyeDropperTrigger>
                <ColorPicker.ChannelSlider channel="hue" className="relative h-3 flex-1 touch-none rounded-full">
                  <ColorPicker.ChannelSliderTrack className="h-full w-full rounded-full" />
                  <ColorPicker.ChannelSliderThumb className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />
                </ColorPicker.ChannelSlider>
              </div>

              <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Quick colours">
                {quick.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={hex}
                    title={hex}
                    onClick={() => commit(toHsb(hex))}
                    className={`aspect-square rounded-md border transition-transform hover:scale-110 ${
                      hex === current ? "border-white ring-1 ring-white/60" : "border-white/15"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </ColorPicker.Content>
          </ColorPicker.Positioner>
        </Portal>
        <ColorPicker.HiddenInput />
      </ColorPicker.Root>
    </div>
  );
});
