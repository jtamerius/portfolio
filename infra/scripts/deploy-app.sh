#!/usr/bin/env bash
# deploy-app.sh — Deploy infrastructure for a single app, then trigger its Amplify build.
#
# Usage: ./infra/scripts/deploy-app.sh <app-name> <environment>
#
# Example:
#   ./infra/scripts/deploy-app.sh landing-page staging
#
# The script:
#   1. Validates that infra/apps/<app-name>/template.yaml exists.
#   2. Deploys the app-specific CloudFormation stack.
#   3. Optionally triggers an Amplify deployment job (if AMPLIFY_APP_ID is set).
#
# Environment variable AMPLIFY_APP_ID can be pre-set, or the script reads it
# from the SSM parameter /tools/<env>/amplify/<app-name>/app-id if it exists.

set -euo pipefail

# ─── Args ────────────────────────────────────────────────────────────────────
APP_NAME="${1:-}"
ENV="${2:-}"

if [[ -z "$APP_NAME" || -z "$ENV" ]]; then
  echo "Usage: $0 <app-name> <environment>"
  echo "  app-name:    e.g. landing-page"
  echo "  environment: staging | production"
  exit 1
fi

if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "ERROR: environment must be 'staging' or 'production', got: $ENV"
  exit 1
fi

# ─── Config ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
TEMPLATE_FILE="$INFRA_DIR/apps/$APP_NAME/template.yaml"
PARAMS_FILE="$INFRA_DIR/environments/$ENV/params.json"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="tools-app-$APP_NAME-$ENV"

# Amplify branch matches the environment name
AMPLIFY_BRANCH="$ENV"

# ─── Helpers ─────────────────────────────────────────────────────────────────
log()  { echo "[$(date -u '+%H:%M:%S')] $*"; }
info() { log "INFO  $*"; }
ok()   { log "OK    $*"; }
err()  { log "ERROR $*" >&2; }

# ─── Validate template exists ─────────────────────────────────────────────────
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  err "CloudFormation template not found: $TEMPLATE_FILE"
  err "Create infra/apps/$APP_NAME/template.yaml first."
  exit 1
fi

# ─── Fetch Cognito params from shared stack outputs ───────────────────────────
info "Reading Cognito outputs from shared stack..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "tools-shared-cognito-$ENV" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text 2>/dev/null || true)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "tools-shared-cognito-$ENV" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text 2>/dev/null || true)

# ─── Deploy app infra stack ───────────────────────────────────────────────────
info "Deploying app infrastructure stack: $STACK_NAME"

PARAM_OVERRIDES=(
  "ParameterKey=Environment,ParameterValue=$ENV"
)

if [[ -n "$USER_POOL_ID" ]]; then
  PARAM_OVERRIDES+=("ParameterKey=UserPoolId,ParameterValue=$USER_POOL_ID")
fi
if [[ -n "$USER_POOL_CLIENT_ID" ]]; then
  PARAM_OVERRIDES+=("ParameterKey=UserPoolClientId,ParameterValue=$USER_POOL_CLIENT_ID")
fi

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

ok "Stack '$STACK_NAME' deployed."

# ─── Trigger Amplify deployment ───────────────────────────────────────────────
# Resolve AMPLIFY_APP_ID: prefer env var, fall back to SSM
if [[ -z "${AMPLIFY_APP_ID:-}" ]]; then
  SSM_KEY="/tools/$ENV/amplify/$APP_NAME/app-id"
  info "AMPLIFY_APP_ID not set; trying SSM parameter: $SSM_KEY"
  AMPLIFY_APP_ID=$(aws ssm get-parameter \
    --name "$SSM_KEY" \
    --region "$REGION" \
    --query "Parameter.Value" \
    --output text 2>/dev/null || true)
fi

if [[ -z "${AMPLIFY_APP_ID:-}" ]]; then
  info "No Amplify App ID found — skipping frontend deployment trigger."
  info "Set AMPLIFY_APP_ID env var or create SSM parameter /tools/$ENV/amplify/$APP_NAME/app-id"
  exit 0
fi

info "Triggering Amplify deployment for app '$AMPLIFY_APP_ID' branch '$AMPLIFY_BRANCH'..."
JOB_ID=$(aws amplify start-job \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$AMPLIFY_BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query "jobSummary.jobId" \
  --output text)

info "Amplify job started: $JOB_ID"
info "Polling for job completion..."

POLL_INTERVAL=15
MAX_WAIT=900  # 15 minutes
ELAPSED=0

while true; do
  STATUS=$(aws amplify get-job \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$AMPLIFY_BRANCH" \
    --job-id "$JOB_ID" \
    --region "$REGION" \
    --query "job.summary.status" \
    --output text 2>/dev/null || echo "UNKNOWN")

  info "  Job status: $STATUS (elapsed: ${ELAPSED}s)"

  case "$STATUS" in
    SUCCEED)
      ok "Amplify deployment succeeded."
      break
      ;;
    FAILED|CANCELLED)
      err "Amplify deployment $STATUS."
      err "Check the Amplify console for details: https://console.aws.amazon.com/amplify/"
      exit 1
      ;;
    RUNNING|PENDING|PROVISIONING)
      # Still in progress — keep polling
      ;;
    *)
      info "  Unknown status '$STATUS'; continuing to poll..."
      ;;
  esac

  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    err "Timed out after ${MAX_WAIT}s waiting for Amplify job to complete."
    exit 1
  fi

  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

info "=== App '$APP_NAME' deployed to $ENV ==="
