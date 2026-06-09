resource "google_sql_database_instance" "harness" {
  name             = "harness-dev-${random_id.suffix.hex}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier                        = "db-custom-1-3840"
    enable_dataplex_integration = false

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_service_networking_connection.private_vpc_connection.network
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "harness_dev" {
  name     = "harness_dev"
  instance = google_sql_database_instance.harness.name
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "google_sql_user" "harness" {
  name     = "harness"
  instance = google_sql_database_instance.harness.name
  password = var.db_password != "" ? var.db_password : random_password.db_password.result
}

resource "google_compute_network" "harness_vpc" {
  name                    = "harness-dev-vpc"
  auto_create_subnetworks = true
}

resource "google_compute_global_address" "private_ip_block" {
  name          = "harness-dev-private-ip-block"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.harness_vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.harness_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_block.name]
}

resource "random_id" "suffix" {
  byte_length = 4
}
