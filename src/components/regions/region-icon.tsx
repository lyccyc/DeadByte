import { AppWindow, Cloud, FileSearch, HardDrive, MemoryStick, Network, Smartphone, type LucideProps } from "lucide-react";
import type { RegionIcon as RegionIconKey } from "@/config/regions";

const ICONS = {
  memory: MemoryStick,
  disk: HardDrive,
  mobile: Smartphone,
  network: Network,
  browser: AppWindow,
  cloud: Cloud,
  file: FileSearch,
} satisfies Record<RegionIconKey, unknown>;

export function RegionIcon({ icon, ...props }: { icon: RegionIconKey } & LucideProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" {...props} />;
}
