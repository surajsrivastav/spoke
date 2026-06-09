locals {
  service_env_vars = {
    "slack-edge" = [
      {
        name   = "SLACK_BOT_TOKEN"
        secret = "slack-bot-token"
      },
      {
        name   = "SLACK_SIGNING_SECRET"
        secret = "slack-signing-secret"
      },
      {
        name   = "GH_TOKEN"
        secret = "gh-token"
      },
    ],
    "whatsapp-edge" = [
      {
        name   = "WHATSAPP_ACCESS_TOKEN"
        secret = "whatsapp-access-token"
      },
      {
        name   = "WHATSAPP_PHONE_NUMBER_ID"
        secret = "whatsapp-phone-number-id"
      },
      {
        name   = "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
        secret = "whatsapp-webhook-verify-token"
      },
    ],
    "orchestrator" = [
      {
        name   = "E2B_API_KEY"
        secret = "e2b-api-key"
      },
      {
        name   = "ANTHROPIC_API_KEY"
        secret = "anthropic-api-key"
      },
      {
        name   = "GH_TOKEN"
        secret = "gh-token"
      },
    ],
    "operator-ui" = [],
  }

  service_plain_env_vars = {
    "slack-edge" = [
      {
        name  = "DATABASE_URL"
        value = var.database_url
      },
    ],
    "whatsapp-edge" = [],
    "orchestrator" = [
      {
        name  = "DATABASE_URL"
        value = var.database_url
      },
      {
        name  = "TEMPORAL_NAMESPACE"
        value = var.temporal_namespace
      },
      {
        name  = "TEMPORAL_ADDRESS"
        value = var.temporal_address
      },
    ],
    "operator-ui" = [
      {
        name  = "DATABASE_URL"
        value = var.database_url
      },
    ],
  }
}

resource "google_cloud_run_v2_service" "services" {
  for_each = toset(local.cloud_run_services)

  name     = each.key
  location = var.region
  client   = "terraform"

  template {
    scaling {
      min_instance_count = 0
    }

    startup_cpu_boost = true

    containers {
      image = "${local.image_base}/${each.key}:${var.image_tag}"

      ports {
        container_port = local.cloud_run_ports[each.key]
      }

      env {
        name  = "PORT"
        value = tostring(local.cloud_run_ports[each.key])
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      dynamic "env" {
        for_each = local.service_plain_env_vars[each.key]
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = local.service_env_vars[each.key]
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets[env.value.secret].id
              version = "latest"
            }
          }
        }
      }
    }

    service_account = google_service_account.cloud_run_sa[each.key].email
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

resource "google_service_account" "cloud_run_sa" {
  for_each = toset(local.cloud_run_services)

  account_id   = "harness-${each.key}-sa"
  display_name = "Service Account for ${each.key}"
}
