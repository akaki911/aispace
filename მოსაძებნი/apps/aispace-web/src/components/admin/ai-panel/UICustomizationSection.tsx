import { motion } from 'framer-motion';
import { Settings2, Wand2 } from 'lucide-react';
import Switch from '@/components/Switch';
import { animationOptions, cardVariants, themePresets } from './constants';
import type { AnimationToggleState } from './types';

interface UICustomizationSectionProps {
  primaryColor: string;
  secondaryColor: string;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  fontFamily: string;
  onFontFamilyChange: (value: string) => void;
  activeTheme: string;
  onThemeChange: (themeId: string) => void;
  themePreviewStyle: React.CSSProperties;
  animationToggles: AnimationToggleState;
  onToggleAnimation: (key: string, value: boolean) => void;
}

export function UICustomizationSection({
  primaryColor,
  secondaryColor,
  onPrimaryColorChange,
  onSecondaryColorChange,
  fontFamily,
  onFontFamilyChange,
  activeTheme,
  onThemeChange,
  themePreviewStyle,
  animationToggles,
  onToggleAnimation,
}: UICustomizationSectionProps) {
  return (
    <section id="gurulo-section-uiCustomization" className="grid gap-6 scroll-mt-28 lg:grid-cols-2">
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">UI კასტომიზაცია</h3>
          <Settings2 className="h-5 w-5 text-[#7C6CFF]" />
        </div>
        <p className="mt-2 text-sm text-[#A0A4AD]">
          მართეთ ღრუბლის ფერები, ფონტები და ანიმაციების შესრულება მომხმარებლის მოთხოვნების შესაბამისად.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <ColorField label="ფერი A" value={primaryColor} onChange={onPrimaryColorChange} />
            <ColorField label="ფერი B" value={secondaryColor} onChange={onSecondaryColorChange} />
          </div>
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.3em] text-[#6F7280]">ფონტი</label>
            <select
              value={fontFamily}
              onChange={(event) => onFontFamilyChange(event.target.value)}
              className="w-full rounded-2xl border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-3 py-2 text-sm text-[#E6E8EC] focus:outline-none focus:ring-2 focus:ring-[#7C6CFF80]"
            >
              <option value='"Noto Sans Georgian", "Inter", "Manrope", sans-serif'>Noto Sans Georgian</option>
              <option value='"Manrope", sans-serif'>Manrope</option>
              <option value='"Space Grotesk", sans-serif'>Space Grotesk</option>
              <option value='"Geist", sans-serif'>Geist</option>
            </select>
            <label className="block text-xs uppercase tracking-[0.3em] text-[#6F7280]">თემა</label>
            <div className="space-y-2">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onThemeChange(preset.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                    activeTheme === preset.id
                      ? 'border-[#7C6CFF80] bg-[#1A1F2F]/90 text-white shadow-[0_16px_40px_rgba(8,11,30,0.45)]'
                      : 'border-[#7C6CFF26] bg-[#181C2A]/70 text-[#E6E8EC]'
                  }`}
                >
                  <p className="font-semibold">{preset.name}</p>
                  <p className="text-xs text-[#A0A4AD]">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div
          className="mt-6 rounded-3xl border border-[#7C6CFF2e] bg-[#181C2A]/80 p-6 shadow-[0_18px_50px_rgba(8,11,30,0.45)]"
          style={themePreviewStyle}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">პრევიუ</p>
          <p className="mt-3 text-lg font-semibold text-white">ღრუბელი ამუშავებს თქვენს არჩევანებს რეალურ დროში</p>
          <p className="mt-2 text-sm text-white/80">Active Theme: {activeTheme}</p>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">ანიმაციების კონტროლი</h3>
          <Wand2 className="h-5 w-5 text-[#7C6CFF]" />
        </div>
        <p className="mt-2 text-sm text-[#A0A4AD]">პროდუქტიული საჭიროებების შემთხვევაში გამორთეთ მძიმე ანიმაციები.</p>
        <div className="mt-6 space-y-4">
          {animationOptions.map((option) => (
            <div key={option.key} className="flex items-center justify-between rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <p className="text-xs text-[#A0A4AD]">GPU ოპტიმიზაცია ხდება ავტომატურად</p>
              </div>
              <Switch
                checked={animationToggles[option.key]}
                onCheckedChange={(value) => onToggleAnimation(option.key, value)}
                aria-label={`${option.label} toggle`}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.3em] text-[#6F7280]">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#7C6CFF33] bg-transparent shadow-inner"
      />
    </label>
  );
}
