terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  cloud_run_services = [
    "slack-edge",
    "whatsapp-edge",
    "orchestrator",
    "operator-ui",
  ]

  cloud_run_ports = {
    "slack-edge"    = 3001
    "whatsapp-edge" = 3001
    "orchestrator"  = 3002
    "operator-ui"   = 3000
  }

  secrets = [
    "slack-bot-token",
    "slack-signing-secret",
    "openrouter-api-key",
    "gh-token",
    "e2b-api-key",
    "temporal-api-key",
    "whatsapp-access-token",
    "whatsapp-phone-number-id",
    "whatsapp-webhook-verify-token",
    "anthropic-api-key",
  ]

  image_base = "us-central1-docker.pkg.dev/${var.project_id}/spoke"
}
