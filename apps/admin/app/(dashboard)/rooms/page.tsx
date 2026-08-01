"use client";

import { LabelManager } from "@/components/label-manager";
import { PageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";

export default function RoomsPage() {
  const utils = trpc.useUtils();
  const rooms = trpc.admin.rooms.list.useQuery();

  const invalidate = () => utils.admin.rooms.invalidate();

  const create = trpc.admin.rooms.create.useMutation({ onSuccess: invalidate });
  const update = trpc.admin.rooms.update.useMutation({ onSuccess: invalidate });
  const setActive = trpc.admin.rooms.setActive.useMutation({
    onSuccess: invalidate,
  });
  const remove = trpc.admin.rooms.delete.useMutation({ onSuccess: invalidate });

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="The storefront's “shop by room” navigation is generated from this list, so it can never disagree with what is here."
      />

      <LabelManager
        entityLabel="room"
        sortOrderHint="Display order on the storefront. Lower comes first."
        items={rooms.data}
        isLoading={rooms.isLoading}
        error={
          rooms.error ??
          create.error ??
          update.error ??
          setActive.error ??
          remove.error
        }
        pending={
          create.isPending ||
          update.isPending ||
          setActive.isPending ||
          remove.isPending
        }
        onCreate={(values) => create.mutate(values)}
        onUpdate={(id, values) => update.mutate({ id, ...values })}
        onSetActive={(id, isActive) => setActive.mutate({ id, isActive })}
        onDelete={(id) => remove.mutate({ id })}
      />
    </div>
  );
}
