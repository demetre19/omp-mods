# Work in progress — do not activate

These files preserve the paused automatic OMP post-update reinstaller prototype.

Verified:

- shell syntax,
- staged official `omp update --check`,
- clean three-way application of both patches at source commit `65f79e7`.

Not verified:

- complete dependency installation without degrading interactive sessions,
- focused tests/check/build inside the automatic flow,
- versioned binary activation,
- official-binary fallback after customization failure,
- full version-upgrade simulation.

The proof run was cancelled during `bun install` because it made current sessions feel slower. The active workstation launcher and LaunchAgent were subsequently disabled; OMP was restored to a normal directly updatable binary.

Resume from [`../../docs/omp-update-reinstaller-pending.md`](../../docs/omp-update-reinstaller-pending.md). Do not install or run these scripts unchanged.
