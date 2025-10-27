variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for credentials (leave empty for default)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "trunecord"
}

variable "discord_client_id" {
  description = "Discord OAuth2 Client ID"
  type        = string
  sensitive   = true
}

variable "discord_client_secret" {
  description = "Discord OAuth2 Client Secret"
  type        = string
  sensitive   = true
}

variable "discord_bot_token" {
  description = "Discord Bot Token"
  type        = string
  sensitive   = true
}

variable "frontend_url" {
  description = "Frontend URL for OAuth redirects"
  type        = string
  default     = "http://localhost:48766"
}

variable "jwt_secret" {
  description = "JWT Secret for token signing"
  type        = string
  sensitive   = true
}

variable "enable_bot_token_endpoint" {
  description = "Enable bot token endpoint (set to \"false\" only when distributing the bot token through other means)"
  type        = string
  default     = "true"
}

variable "go_client_latest_version" {
  description = "Latest version of the Go client distributed to users"
  type        = string
  default     = "1.3.4"
}

variable "go_client_min_version" {
  description = "Minimum supported Go client version before forcing an update"
  type        = string
  default     = "1.3.4"
}

variable "go_client_download_url" {
  description = "URL where users can download the latest Go client"
  type        = string
  default     = "https://github.com/cahlchang/trunecord/releases/latest"
}

variable "go_client_release_notes" {
  description = "Optional release notes or update summary for the Go client"
  type        = string
  default     = ""
}

variable "extension_latest_version" {
  description = "Latest version of the Chrome extension distributed to users"
  type        = string
  default     = "1.3.4"
}

variable "extension_min_version" {
  description = "Minimum supported Chrome extension version before forcing an update"
  type        = string
  default     = "1.3.4"
}

variable "extension_download_url" {
  description = "URL where users can install or update the Chrome extension"
  type        = string
  default     = "https://chromewebstore.google.com/detail/trunecord/dhmegdkoembgmlhekieedhkilbnjmjee"
}

variable "extension_release_notes" {
  description = "Optional release notes or update summary for the Chrome extension"
  type        = string
  default     = ""
}
