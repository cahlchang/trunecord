variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
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