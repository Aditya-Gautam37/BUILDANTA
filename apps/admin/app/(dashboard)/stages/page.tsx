"use client";

import { LabelManager } from "@/components/label-manager";
import { Alert, PageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";

export default function StagesPage() {
  const utils = trpc.useUtils();
  const stages = trpc.admin.stages.list.useQuery();

  const invalidate = () => utils.admin.stages.invalidate();

  const create = trpc.admin.stages.create.useMutation({ onSuccess: invalidate });
  const update = trpc.admin.stages.update.useMutation({ onSuccess: invalidate });
  const setActive = trpc.admin.stages.setActive.useMutation({
    onSuccess: invalidate,
  });
  const remove = trpc.admin.stages.delete.useMutation({ onSuccess: invalidate });

  return (
    <div>
      <PageHeader
        title="Build stages"
        description="The phases of a build. Both the storefront navigation and the stage-to-stage “what comes next” links are generated from this list."
      />

      <div className="mb-4">
        <Alert tone="info">
          Sort order here is the real chronology of work on site, not just a display
          preference — the storefront uses it to offer the previous and next stage on
          each stage page. Leave gaps (0, 10, 20…) so a stage can be inserted later
          without renumbering everything.
        </Alert>
      </div>

      <LabelManager
        entityLabel="build stage"
        sortOrderHint="Position in the build sequence. Lower happens earlier on site."
        items={stages.data}
        isLoading={stages.isLoading}
        error={
          stages.error ??
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
