resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = "spoke-github-pool-${random_id.suffix.hex}"
  display_name              = "Spoke GitHub Actions Pool"
  description               = "Workload Identity Pool for GitHub Actions deployments"
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "spoke-github-provider-${random_id.suffix.hex}"
  display_name                       = "Spoke GitHub Actions Provider"
  description                        = "OIDC provider bound to ${var.github_org}/${var.github_repo}"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_condition = "assertion.repository_owner == '${var.github_org}'"
}

resource "google_service_account" "github_actions_deployer" {
  account_id   = "spoke-gh-deployer"
  display_name = "GitHub Actions Deployer"
  description  = "Used by GitHub Actions for GCP deployments"
}
