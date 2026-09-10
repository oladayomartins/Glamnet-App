import { GuideHeader, Hero } from "@/components/guide/sections/hero";
import {
  BrandMarksSection,
  ColourSection,
  IconsSection,
  SpaceSection,
  TypographySection,
} from "@/components/guide/sections/foundations";
import {
  BookingFlowSection,
  ControlsSection,
} from "@/components/guide/sections/controls";
import {
  CalendarSection,
  EmergencySection,
  StatusSection,
} from "@/components/guide/sections/emergency";
import {
  GuideFooter,
  MotionSection,
  StackSection,
  VoiceSection,
} from "@/components/guide/sections/system";

/**
 * The GlamNet brand guide.
 *
 * Every specimen on this page is the real component from `components/`, not a
 * picture of one — so the guide cannot drift from what the app ships. If a
 * component changes, this page changes with it.
 */
export default function BrandGuidePage() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-28">
      <GuideHeader />
      <Hero />
      <BrandMarksSection />
      <ColourSection />
      <TypographySection />
      <SpaceSection />
      <IconsSection />
      <ControlsSection />
      <BookingFlowSection />
      <EmergencySection />
      <CalendarSection />
      <StatusSection />
      <MotionSection />
      <StackSection />
      <VoiceSection />
      <GuideFooter />
    </div>
  );
}
