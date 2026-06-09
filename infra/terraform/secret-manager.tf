resource "google_secret_manager_secret" "secrets" {
  for_each = toset(local.secrets)

  secret_id = "${each.key}-${random_id.suffix.hex}"

  replication {
    auto {}
  }

  labels = {
    environment = "dev"
    service     = each.key
  }
}
