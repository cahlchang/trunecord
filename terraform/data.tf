locals {
  auth_server_dir  = "${path.module}/../auth-server"
  lambda_build_dir = "${path.module}/../auth-server/dist-lambda"
}

resource "null_resource" "build_lambda_package" {
  triggers = {
    package_lock = filesha256("${local.auth_server_dir}/package-lock.json")
    package_json = filesha256("${local.auth_server_dir}/package.json")
    index_js     = filesha256("${local.auth_server_dir}/index.js")
    lambda_js    = filesha256("${local.auth_server_dir}/lambda.js")
    build_script = filesha256("${local.auth_server_dir}/scripts/build-lambda.sh")
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-lc"]
    command     = "cd ${local.auth_server_dir} && npm run build:lambda"
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
