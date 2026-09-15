# omp-autoresume.zsh — re-enter the last OMP session in this pane when omp exits.
#
# After an interactive `omp` session ends (quit, interrupt, crash), wait 3s and
# relaunch `omp --continue` (cwd-scoped: resumes this directory's last session).
# Press any key during the window to stay in the shell.
#
# Bypassed entirely (plain `command omp`) when:
#   - OMP_NO_AUTORESUME is set
#   - stdin/stdout is not a TTY (scripts, pipelines, tool calls)
#   - OMP_PROFILE is set or --profile is passed (PRD lanes use --profile prd-lane)
#   - AUTONOMY_* env is present (crew/PRD spawned workers; see autonomy_crew.launch_env)
#   - OTEL_RESOURCE_ATTRIBUTES carries prd.* lane identity
#   - any positional arg (subcommand, initial prompt, @file) or an exit-only flag
#     (-p/--print, --mode, --export, --alias, --help, --version, --no-session,
#     --from-claude, --from-codex) is given
#
# Crash guard: if a (re)launched session exits in under 8s twice in a row, stay
# in the shell instead of looping.

omp() {
  if [[ -n "$OMP_NO_AUTORESUME" || -n "$OMP_PROFILE" \
      || -n "$AUTONOMY_RUN_DIR" || -n "$AUTONOMY_LANE_ID" || -n "$AUTONOMY_ENGINE" \
      || "$OTEL_RESOURCE_ATTRIBUTES" == *prd.* \
      || ! -t 0 || ! -t 1 ]]; then
    command omp "$@"
    return
  fi

  local -a resume_args=()
  local arg consume=0 keep=1 bypass=0
  for arg in "$@"; do
    if (( consume )); then
      consume=0
      (( keep )) && resume_args+=("$arg")
      continue
    fi
    keep=1
    case "$arg" in
      --) bypass=1; break ;;
      -c|--continue) keep=0 ;;
      -r|--resume) keep=0; consume=1 ;;
      --resume=*) keep=0 ;;
      -p|--print|--mode|--export|--alias|--help|-h|--version|--no-session|--from-claude|--from-codex|--profile)
        bypass=1; break ;;
      --mode=*|--print=*|--alias=*|--export=*|--profile=*)
        bypass=1; break ;;
      --model|--smol|--slow|--plan|--prewalk-into|--plan-yolo-into|--provider|--api-key|--system-prompt|--append-system-prompt|--cwd|--config|--add-dir|--session-dir|--models|--tools|--thinking|--service-tier|--approval-mode|--max-time|--hook|-e|--extension|--skills|--plugin-dir)
        consume=1 ;;
      -*) ;;
      *) bypass=1; break ;;
    esac
    (( keep )) && resume_args+=("$arg")
  done

  if (( bypass )); then
    command omp "$@"
    return
  fi

  local -a run_args=("$@")
  local started rc fast_exits=0 t0
  while true; do
    started=$SECONDS
    command omp "${run_args[@]}"
    rc=$?
    run_args=(--continue "${resume_args[@]}")
    if (( SECONDS - started < 8 )); then
      (( ++fast_exits >= 2 )) && {
        print -r -- "omp: session exited immediately again — staying in shell (OMP_NO_AUTORESUME=1 disables auto-resume)."
        return $rc
      }
    else
      fast_exits=0
    fi
    [[ -t 0 ]] || return $rc
    printf 'omp session ended — resuming in 3s (press any key to stay in shell) '
    t0=$SECONDS
    if read -k1 -t 3 -s; then
      print -- '· stayed.'
      return $rc
    fi
    (( SECONDS - t0 < 2 )) && return $rc   # EOF/interrupt, not a timeout
    print -- '· resuming.'
  done
}
