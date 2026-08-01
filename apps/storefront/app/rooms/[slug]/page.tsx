import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogResults } from "@/components/catalog-results";
import { api } from "@/lib/api";
import { parseProductSearchParams } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const rooms = await api.catalog.taxonomy.rooms.query();
  const room = rooms.find((entry) => entry.slug === slug);
  return {
    title: room ? `${room.name} materials` : "Room",
    description: room?.description ?? undefined,
  };
}

/** A real, addressable page per room — see the note in stages/[slug]/page.tsx. */
export default async function RoomPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);

  // Rooms are a short list, so the whole set is fetched and matched locally rather
  // than adding a single-room endpoint nothing else would use.
  const rooms = await api.catalog.taxonomy.rooms.query();
  const room = rooms.find((entry) => entry.slug === slug);
  if (!room) notFound();

  const query = parseProductSearchParams(search, { roomSlugs: [slug] });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-concrete-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-signal-700">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/rooms" className="hover:text-signal-700">
              Rooms
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-concrete-900">{room.name}</li>
        </ol>
      </nav>

      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-signal-700">
          Room
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{room.name}</h1>
        {room.description ? (
          <p className="mt-2 max-w-2xl text-concrete-600">{room.description}</p>
        ) : null}
      </header>

      <CatalogResults
        basePath={`/rooms/${slug}`}
        query={query}
        hide={["room"]}
      />
    </div>
  );
}
