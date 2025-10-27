provider "aws" {
  alias   = "current"
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}
