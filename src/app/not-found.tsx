import Link from "next/link";
import { ExplorerPenguin } from "@/components/penguin/explorer-penguin";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <ExplorerPenguin className="h-auto w-36" title="" aria-hidden="true" />
      <p className="mt-6 font-mono text-sm text-accent">ERROR 404 // EVIDENCE NOT FOUND</p>
      <h1 className="mt-2 text-3xl font-bold">This trail goes cold.</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist or is not public.</p>
      <div className="mt-6 flex gap-4 font-mono text-sm">
        <Link href="/" className="text-accent hover:text-accent-hover">Home</Link>
        <Link href="/#map" className="text-muted hover:text-fg">Evidence map</Link>
        <Link href="/challenges" className="text-muted hover:text-fg">Challenges</Link>
      </div>
    </div>
  );
}
