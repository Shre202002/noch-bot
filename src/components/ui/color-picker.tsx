
"use client";
import { Portal } from "@ark-ui/react/portal";
import { ColorPicker, parseColor, ColorPickerValueChangeDetails } from "@ark-ui/react/color-picker";
import { PipetteIcon } from "lucide-react";

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
    <ColorPicker.Root value={safeValue} onValueChange={onValueChange} inline>
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
                    ✓
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
