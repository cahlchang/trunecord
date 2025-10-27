locals {
  auth_server_dir  = "${path.module}/../auth-server"
  lambda_build_dir = "${path.module}/../auth-server/dist-lambda"
}

resource "null_resource" "build_lambda_package" {
  triggers = {
    source_hash = sha256(join("", [
      for file in sort(concat(
        fileset(local.auth_server_dir, "src/**"),
        fileset(local.auth_server_dir, "scripts/**"),
        ["index.js", "lambda.js", "package.json", "package-lock.json"]
      )) : filesha256("${local.auth_server_dir}/${file}")
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-lc"]
    working_dir = local.auth_server_dir
    command     = "npm ci && npm run build:lambda"
  }
}

# Create deployment package for Lambda
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = local.lambda_build_dir
  output_path = "${path.module}/lambda_function.zip"

  depends_on = [null_resource.build_lambda_package]
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get current AWS region
data "aws_region" "current" {}
