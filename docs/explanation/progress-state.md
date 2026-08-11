# Progress State

Progress lives in two places at once. This page explains why, what the merge rule
is, and the one case where it surprises you.

## Two places

| Where                        | Why it is there                                    |
| ---------------------------- | -------------------------------------------------- |
| The browser's `localStorage` | The dashboard responds without waiting for a write |
| `content/.marga/state.json`  | Progress stays versioned alongside the notes       |

Every change goes to both. The browser copy is what the page reads, and the file
is the copy you can commit, diff, and carry to another machine.

Neither is authoritative on its own, which is what the merge rule is for.

## The merge rule

On load the two are merged rather than one replacing the other.

Completed lessons, activity days, milestones, plan reviews, and evidence entries
are unioned. Where both sides hold the same evidence entry, the browser copy wins,
as the one you edited most recently.

Nothing is dropped because a write failed. A refused or unreachable mirror is
remembered, and the next successful change pushes the whole state back to the
file. So editing progress while the mirror is unavailable, then coming back, does
not lose the edit.

`src/lib/progress-state.ts` holds the shape, the limits, and the merge rule that
both sides share, and its tests cover the rule directly.

## Where a union surprises you

A union cannot tell a deletion from an absence.

Delete an entry in one place while the other side is offline, and the next merge
brings it back once: the offline side still has it, and the union keeps what
either side holds. Delete it again, with both sides reachable, and it stays gone.

The alternative would be recording tombstones for every deletion and keeping them
forever, which is a larger and more fragile design than personal learning state
justifies. Losing an entry silently is the failure worth preventing here;
resurrecting one costs a second click.

## Switching storage roots

Each storage root carries its own `state.json`, so pointing Marga at a different
notes folder shows the progress recorded under that one, which may be older or
empty. The browser copy is not cleared, so it merges with whatever the new root
holds on the next load.

## Changing the storage prefix

The prefix names this site's keys in the browser. Change it after recording
progress and the dashboard reads a different set of keys, so it looks empty. The
old progress is still there under the old prefix, and setting the old value back
brings it into view. See
[Configure your site](../how-to/configure-your-site.md#do-not-change-the-storage-prefix-later).
