# Create deployment package for Lambda
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../auth-server"
  output_path = "${path.module}/lambda_function.zip"
  
  excludes = [
    ".env",
    ".gitignore",
    "README.md"
  ]
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get current AWS region
data "aws_region" "current" {}